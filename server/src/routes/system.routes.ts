import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const execFileAsync = promisify(execFile);

// Only plain semantic-version-like tags (e.g. "v1.2.3" or "1.2.3") are accepted.
// This is the primary guard against command injection via the request body.
const TAG_PATTERN = /^v?\d+\.\d+\.\d+$/;

// Repository root of this installation (contains .git and package.json).
const APP_ROOT = path.resolve(__dirname, '../../..');

const GITHUB_OWNER = () => process.env.GITHUB_OWNER || 'dodi110480';
const GITHUB_REPO = () => process.env.GITHUB_REPO || 'heritago';

/** Public GitHub URL of the repository this installation was cloned from. */
const repositoryUrl = () => `https://github.com/${GITHUB_OWNER()}/${GITHUB_REPO()}`;

/**
 * Runs a git command inside the installation and returns trimmed stdout.
 * Resolves to null when the command fails (e.g. missing .git directory).
 */
const runGit = async (args: string[]): Promise<string | null> => {
    try {
        const { stdout } = await execFileAsync('git', args, { cwd: APP_ROOT });
        return stdout.trim() || null;
    } catch {
        return null;
    }
};

/**
 * Formats an ISO timestamp in German display notation.
 * Preparing display values is a backend responsibility (see backend-first.md).
 */
const formatDate = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

/**
 * Reads the revision metadata of the installed checkout. The commit hash and tag
 * are exactly the identifiers shown on GitHub, but they are resolved locally and
 * therefore stay available even if the GitHub API is unreachable or rate limited.
 */
const readGitInfo = async () => {
    const [tag, commit, branch, commitIso, describe] = await Promise.all([
        runGit(['describe', '--tags', '--abbrev=0']),
        runGit(['rev-parse', '--short', 'HEAD']),
        runGit(['rev-parse', '--abbrev-ref', 'HEAD']),
        runGit(['log', '-1', '--format=%cI']),
        runGit(['describe', '--tags', '--always'])
    ]);

    return {
        gitTag: tag,
        gitCommit: commit,
        gitBranch: branch,
        gitCommitDate: formatDate(commitIso),
        gitDescribe: describe
    };
};

export const systemRoutes = () => {
    const router = Router();

    // Make git accept the installation directory even when it is owned by another
    // user. Idempotent (replace-all) and executed once at startup.
    execFileAsync('git', ['config', '--global', '--replace-all', 'safe.directory', APP_ROOT])
        .catch(() => {});

    router.get('/info', async (req, res) => {
        try {
            // Application version (repository root package.json).
            let version: string | null = null;
            try {
                version = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')).version ?? null;
            } catch {
                version = null;
            }

            const git = await readGitInfo();

            res.json({
                success: true,
                data: {
                    version,
                    ...git,
                    repositoryUrl: repositoryUrl(),
                    nodeVersion: process.version,
                    platform: process.platform
                }
            });
        } catch (error) {
            console.error('[server]: Failed to read version info:', error);
            res.status(500).json({ success: false, message: 'Versionsinformationen konnten nicht gelesen werden.', code: 'SYSTEM_INFO_FAILED' });
        }
    });

    router.get('/check-update', async (req, res) => {
        try {
            const token = process.env.GITHUB_TOKEN;
            const owner = GITHUB_OWNER();
            const repo = GITHUB_REPO();

            const headers: any = { 'Accept': 'application/vnd.github.v3+json' };
            if (token) {
                headers['Authorization'] = `token ${token}`;
            }

            const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
                headers
            });

            const latestRelease: any = response.data;
            const latestTag = latestRelease.tag_name;

            const git = await readGitInfo();
            const currentTag = git.gitTag || git.gitCommit || 'unknown';

            const hasUpdate = currentTag !== latestTag;

            res.json({
                success: true,
                data: {
                    hasUpdate,
                    currentVersion: currentTag,
                    currentCommit: git.gitCommit,
                    currentBranch: git.gitBranch,
                    currentCommitDate: git.gitCommitDate,
                    currentDescribe: git.gitDescribe,
                    latestVersion: latestTag,
                    releaseName: latestRelease.name,
                    releasePublishedAt: formatDate(latestRelease.published_at),
                    repositoryUrl: repositoryUrl(),
                    details: latestRelease.body
                }
            });
        } catch (error: any) {
            console.error('[server]: Update check failed:', error.response?.data?.message || error.message);
            res.status(500).json({
                success: false,
                message: 'Es konnte nicht nach Updates gesucht werden.',
                code: 'SYSTEM_UPDATE_CHECK_FAILED'
            });
        }
    });

    router.post('/update', async (req, res) => {
        try {
            const { tag } = req.body || {};

            if (typeof tag !== 'string' || !TAG_PATTERN.test(tag)) {
                return res.status(400).json({ success: false, message: 'Ungültige Ziel-Version. Erwartet wird ein Tag wie "v1.2.3".', code: 'VALIDATION_ERROR' });
            }

            console.log(`[server]: Starting application update to ${tag}...`);
            await execFileAsync('git', ['fetch', '--tags'], { cwd: APP_ROOT });
            const { stdout, stderr } = await execFileAsync('git', ['checkout', `tags/${tag}`], { cwd: APP_ROOT });
            console.log('[server]: git checkout output:', stdout.trim());

            if (stderr && !stderr.includes('HEAD is now at')) {
                console.warn('[server]: git checkout warning:', stderr);
            }

            const git = await readGitInfo();

            res.json({
                success: true,
                data: {
                    message: `Update auf ${tag} erfolgreich. Für Änderungen am Backend ist ein Neustart des Servers erforderlich.`,
                    tag,
                    commit: git.gitCommit,
                    output: stdout
                }
            });
        } catch (error: any) {
            console.error('[server]: Update execution failed:', error.message);
            res.status(500).json({ success: false, message: 'Das Update konnte nicht installiert werden.', code: 'SYSTEM_UPDATE_FAILED' });
        }
    });

    return router;
};
