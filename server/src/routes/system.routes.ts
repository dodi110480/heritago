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

const GITHUB_HEADERS = { 'Accept': 'application/vnd.github.v3+json' };

/** Semver parts of a version string ("v1.2.3" -> [1, 2, 3]; null if unparsable). */
const versionParts = (version: string | null | undefined): number[] | null => {
    if (!version || !TAG_PATTERN.test(version)) return null;
    return version.replace(/^v/, '').split('.').map(Number);
};

/** Highest semver-like tag of a list (GitHub's tag order is not guaranteed). */
const highestVersion = (tags: (string | null | undefined)[]): string | null => {
    let best: string | null = null;
    let bestParts: number[] | null = null;

    for (const tag of tags) {
        const parts = versionParts(tag);
        if (!parts) continue;
        for (let i = 0; i < 3; i++) {
            if (!bestParts || parts[i] > bestParts[i]) {
                best = tag as string;
                bestParts = parts;
                break;
            }
            if (parts[i] < bestParts[i]) break;
        }
    }

    return best;
};

/**
 * Reads a resource of the configured repository from the GitHub API.
 *
 * The token is optional - the repository is public. A configured but invalid or
 * expired token must never disable the update check, so any request rejected with
 * 401/403 (bad credentials / exhausted quota) is retried without credentials.
 * Returns null when the resource does not exist (e.g. no release published yet)
 * or when the API is unreachable; write to the console then explains why.
 */
const githubGet = async (resource: string): Promise<any | null> => {
    const token = (process.env.GITHUB_TOKEN || '').trim();
    const url = `https://api.github.com/repos/${GITHUB_OWNER()}/${GITHUB_REPO()}${resource}`;

    const request = (withToken: boolean) => axios.get(url, {
        headers: withToken ? { ...GITHUB_HEADERS, 'Authorization': `token ${token}` } : GITHUB_HEADERS,
        timeout: 10000,
        // Inspect the status code here instead of letting axios throw on 4xx.
        validateStatus: () => true
    });

    try {
        let response = await request(Boolean(token));

        if (token && (response.status === 401 || response.status === 403)) {
            console.warn(`[server]: GitHub rejected GITHUB_TOKEN (HTTP ${response.status}) - retrying anonymously.`);
            response = await request(false);
        }

        if (response.status === 404) {
            console.warn(`[server]: GitHub resource ${resource} not found (HTTP 404).`);
            return null;
        }

        if (response.status >= 400) {
            console.warn(`[server]: GitHub resource ${resource} failed (HTTP ${response.status}).`);
            return null;
        }

        return response.data;
    } catch (error: any) {
        console.warn(`[server]: GitHub request ${resource} failed:`, error.message);
        return null;
    }
};

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
        // Local revision metadata - always available, independent of GitHub.
        const git = await readGitInfo();
        const installed = {
            currentVersion: git.gitTag || git.gitCommit || 'unknown',
            currentCommit: git.gitCommit,
            currentBranch: git.gitBranch,
            currentCommitDate: git.gitCommitDate,
            currentDescribe: git.gitDescribe,
            repositoryUrl: repositoryUrl()
        };

        /** The remote check is not a precondition for the installed app to work. */
        const unavailablePayload = () => ({
            success: true,
            data: {
                ...installed,
                hasUpdate: false,
                unavailable: true,
                message: 'Die Prüfung auf neue Versionen ist derzeit nicht möglich. Die installierte Version läuft unverändert weiter - bitte später erneut suchen.',
                latestVersion: null,
                releaseName: null,
                releasePublishedAt: null,
                details: null
            }
        });

        try {
            // Preferred source: the newest GitHub release (it carries the release notes).
            // Because POST /update installs a tag, an existing tag is a valid update as well -
            // a tag pushed without (or ahead of) a published GitHub release must not be hidden.
            const [release, tags] = await Promise.all([
                githubGet('/releases/latest'),
                githubGet('/tags')
            ]);

            const newestTag = Array.isArray(tags)
                ? highestVersion(tags.map((entry: any) => entry?.name))
                : null;

            const latestVersion = highestVersion([release?.tag_name, newestTag]);

            if (!latestVersion) {
                return res.json(unavailablePayload());
            }

            // Release notes describe the release - only usable when it is the newest version.
            const releaseIsLatest = Boolean(release?.tag_name) && release.tag_name === latestVersion;

            res.json({
                success: true,
                data: {
                    ...installed,
                    hasUpdate: installed.currentVersion !== latestVersion,
                    unavailable: false,
                    message: null,
                    latestVersion,
                    releaseName: releaseIsLatest ? (release.name || latestVersion) : latestVersion,
                    releasePublishedAt: releaseIsLatest ? formatDate(release.published_at) : null,
                    details: releaseIsLatest ? (release.body ?? null) : null
                }
            });
        } catch (error: any) {
            console.error('[server]: Update check failed:', error.message);
            res.json(unavailablePayload());
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
