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

/**
 * Outcome of a GitHub API call. `rateLimited` marks the exhausted quota (anonymously
 * only 60 requests/hour), which is the most common reason a check fails and needs a
 * different message than an unreachable API.
 */
interface GithubResult {
    data: any | null;
    status: number;
    rateLimited: boolean;
}

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
const githubGet = async (resource: string): Promise<GithubResult> => {
    const token = (process.env.GITHUB_TOKEN || '').trim();
    const url = `https://api.github.com/repos/${GITHUB_OWNER()}/${GITHUB_REPO()}${resource}`;

    const request = (withToken: boolean) => axios.get(url, {
        headers: withToken ? { ...GITHUB_HEADERS, 'Authorization': `token ${token}` } : GITHUB_HEADERS,
        timeout: 10000,
        // Inspect the status code here instead of letting axios throw on 4xx.
        validateStatus: () => true
    });

    /** GitHub answers 403/429 with `x-ratelimit-remaining: 0` once the quota is gone. */
    const isRateLimited = (response: any): boolean =>
        (response.status === 403 || response.status === 429) &&
        String(response.headers?.['x-ratelimit-remaining'] ?? '') === '0';

    try {
        let response = await request(Boolean(token));

        if (token && (response.status === 401 || response.status === 403)) {
            console.warn(`[server]: GitHub rejected GITHUB_TOKEN (HTTP ${response.status}) - retrying anonymously.`);
            response = await request(false);
        }

        if (response.status === 404) {
            console.warn(`[server]: GitHub resource ${resource} not found (HTTP 404).`);
            return { data: null, status: 404, rateLimited: false };
        }

        if (response.status >= 400) {
            const rateLimited = isRateLimited(response);
            console.warn(`[server]: GitHub resource ${resource} failed (HTTP ${response.status}${rateLimited ? ', rate limit exhausted' : ''}).`);
            return { data: null, status: response.status, rateLimited };
        }

        return { data: response.data, status: response.status, rateLimited: false };
    } catch (error: any) {
        console.warn(`[server]: GitHub request ${resource} failed:`, error.message);
        return { data: null, status: 0, rateLimited: false };
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

// ---------------------------------------------------------------------------
// Update pipeline (git checkout + build + restart)
// ---------------------------------------------------------------------------

/**
 * Directory shared between the web process and the update worker. The web process only
 * queues a request and reads progress; the worker (own systemd unit, run as root) does
 * the checkout, both builds and the service restart. Created by the installer
 * (see docs/install.md).
 */
const UPDATE_STATE_DIR = process.env.HERITAGO_STATE_DIR || '/var/lib/heritago';

const UPDATE_REQUEST_FILE = path.join(UPDATE_STATE_DIR, 'update-request.txt');
const UPDATE_STATE_FILE = path.join(UPDATE_STATE_DIR, 'update-state.txt');
const UPDATE_LOG_FILE = path.join(UPDATE_STATE_DIR, 'update.log');

/** Worker script (part of the repository) and the unit that executes it. */
const UPDATE_SCRIPT = path.join(APP_ROOT, 'scripts/update.sh');
const UPDATE_UNIT = process.env.HERITAGO_UPDATE_UNIT || 'heritago-update.service';

/**
 * Steps of the worker in execution order. The worker publishes the keys only, so the
 * German labels for the UI are defined here (single source of truth, see backend-first.md).
 */
const UPDATE_STEPS: { key: string; label: string }[] = [
    { key: 'fetch', label: 'Neue Version wird geladen' },
    { key: 'checkout', label: 'Version wird installiert' },
    { key: 'install-frontend', label: 'Frontend-Abhängigkeiten werden installiert' },
    { key: 'build-frontend', label: 'Frontend wird gebaut' },
    { key: 'install-backend', label: 'Backend-Abhängigkeiten werden installiert' },
    { key: 'prisma-generate', label: 'Datenbank-Client wird erzeugt' },
    { key: 'build-backend', label: 'Backend wird gebaut' },
    { key: 'restart', label: 'Dienst wird neu gestartet' },
    { key: 'rollback', label: 'Vorherige Version wird wiederhergestellt' }
];

const UPDATE_STEP_TOTAL = UPDATE_STEPS.length;

/** Grace period for a queued update whose worker has not published its pid yet. */
const UPDATE_QUEUE_GRACE_MS = 60 * 1000;

type UpdateState = Record<string, string>;

interface UpdateStateFile {
    state: UpdateState;
    modifiedMs: number;
}

const readUpdateStateFile = (): UpdateStateFile | null => {
    try {
        const raw = fs.readFileSync(UPDATE_STATE_FILE, 'utf8');
        const { mtimeMs } = fs.statSync(UPDATE_STATE_FILE);

        const state: UpdateState = {};
        for (const line of raw.split('\n')) {
            const separator = line.indexOf('=');
            if (separator > 0) {
                state[line.slice(0, separator)] = line.slice(separator + 1).trim();
            }
        }

        return { state, modifiedMs: mtimeMs };
    } catch {
        // No update has ever been started on this installation.
        return null;
    }
};

/** Writes the state file atomically (tmp + rename), so readers never see it half-written. */
const writeUpdateState = (state: UpdateState): void => {
    const body = Object.entries(state).map(([key, value]) => `${key}=${value}`).join('\n');
    const tmp = `${UPDATE_STATE_FILE}.api-tmp`;

    fs.writeFileSync(tmp, `${body}\n`, { mode: 0o644 });
    fs.renameSync(tmp, UPDATE_STATE_FILE);
};

/** True while a process with this pid exists (EPERM means it exists but is not ours). */
const processAlive = (pid: string | undefined): boolean => {
    const value = Number(pid);
    if (!Number.isInteger(value) || value <= 0) return false;

    try {
        process.kill(value, 0);
        return true;
    } catch (error: any) {
        return error?.code === 'EPERM';
    }
};

/** Last lines of the worker log, for the progress view in the UI. */
const readUpdateLogTail = (lines = 40): string | null => {
    try {
        const content = fs.readFileSync(UPDATE_LOG_FILE, 'utf8').trimEnd();
        return content ? content.split('\n').slice(-lines).join('\n') : null;
    } catch {
        return null;
    }
};

/**
 * Finalizes an update whose worker is gone (crash, reboot, killed process) instead of
 * leaving the UI in "running" forever. A living worker always stays authoritative, so
 * long build steps are never cut short by a timeout.
 */
const reconcileUpdateState = (file: UpdateStateFile | null): UpdateStateFile | null => {
    if (!file || file.state.status !== 'running') return file;

    const { state, modifiedMs } = file;

    if (processAlive(state.pid)) return file;

    // No pid yet: the worker was just queued and still has to take over.
    const queued = !(Number(state.pid) > 0);
    if (queued && Date.now() - modifiedMs < UPDATE_QUEUE_GRACE_MS) return file;

    // Reaching the restart step means everything was installed already, and the fact
    // that this code runs at all proves the service came back up.
    const interrupted = state.step !== 'restart';
    const finished: UpdateState = {
        ...state,
        status: interrupted ? 'failed' : 'success',
        finished: new Date().toISOString(),
        pid: '',
        error: interrupted
            ? 'Der Update-Prozess wurde unterbrochen. Details stehen im Update-Log.'
            : ''
    };

    try {
        writeUpdateState(finished);
    } catch (error: any) {
        console.warn('[server]: Could not persist update state:', error.message);
    }

    return { state: finished, modifiedMs: Date.now() };
};

/**
 * Prepared display data for the update progress. The frontend renders these values
 * as-is - no formatting or status translation in the client (see backend-first.md).
 */
const updateStatusPayload = (file: UpdateStateFile | null) => {
    if (!file) {
        return {
            status: 'idle',
            running: false,
            step: null,
            stepLabel: null,
            stepIndex: 0,
            stepTotal: UPDATE_STEP_TOTAL,
            progressPercent: 0,
            targetTag: null,
            fromVersion: null,
            startedAt: null,
            startedAtFormatted: null,
            finishedAt: null,
            finishedAtFormatted: null,
            error: null,
            message: 'Es läuft kein Update.',
            logTail: null
        };
    }

    const { state } = file;
    const status = state.status || 'idle';
    // Terminal states: no further poll, the result card stays on screen.
    const done = status === 'success' || status === 'failed' || status === 'rolled_back';
    const step = UPDATE_STEPS.find(entry => entry.key === state.step) || null;
    const index = Number(state.index) || 0;

    const stepLabel =
        status === 'success' ? 'Update abgeschlossen'
            : status === 'rolled_back' ? 'Vorherige Version wiederhergestellt'
                : status === 'failed' ? 'Update fehlgeschlagen'
                    : (step ? step.label : null);

    const message =
        status === 'success' ? `Update auf ${state.target} wurde installiert. Die neue Version ist aktiv.`
            // The worker already wrote the German sentence (it knows the failed step).
            : status === 'rolled_back' ? (state.error || `Update auf ${state.target} ist fehlgeschlagen. Die vorherige Version läuft weiter.`)
                : status === 'failed' ? (state.error || 'Das Update ist fehlgeschlagen.')
                    : (step ? `${step.label} …` : 'Update wird installiert …');

    return {
        status,
        running: status === 'running',
        step: state.step || null,
        stepLabel,
        stepIndex: index,
        stepTotal: UPDATE_STEP_TOTAL,
        progressPercent: (status === 'success' || status === 'rolled_back')
            ? 100
            : Math.round((Math.max(index, 1) - (done ? 0 : 1)) / UPDATE_STEP_TOTAL * 100),
        targetTag: state.target || null,
        fromVersion: state.from || null,
        startedAt: state.started || null,
        startedAtFormatted: formatDate(state.started),
        finishedAt: state.finished || null,
        finishedAtFormatted: formatDate(state.finished),
        error: state.error || null,
        message,
        logTail: readUpdateLogTail()
    };
};

/**
 * Finalizes an update that was interrupted while the API was down (reboot, crash).
 * Called once at API startup; the status endpoint applies the same logic on demand.
 */
export const recoverInterruptedUpdate = (): void => {
    reconcileUpdateState(readUpdateStateFile());
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
        const unavailablePayload = (rateLimited: boolean) => ({
            success: true,
            data: {
                ...installed,
                hasUpdate: false,
                unavailable: true,
                // Distinguishes "quota exhausted" from "API unreachable" so the UI can
                // point at the real cause instead of showing a generic message.
                rateLimited,
                message: rateLimited
                    ? 'Die GitHub-API ist derzeit limitiert (ohne Token sind nur 60 Anfragen pro Stunde möglich). Bitte später erneut suchen oder ein GITHUB_TOKEN in server/.env hinterlegen.'
                    : 'Die Prüfung auf neue Versionen ist derzeit nicht möglich. Die installierte Version läuft unverändert weiter - bitte später erneut suchen.',
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
            const [releaseResult, tagsResult] = await Promise.all([
                githubGet('/releases/latest'),
                githubGet('/tags')
            ]);

            const release = releaseResult.data;
            const tags = tagsResult.data;

            const newestTag = Array.isArray(tags)
                ? highestVersion(tags.map((entry: any) => entry?.name))
                : null;

            const latestVersion = highestVersion([release?.tag_name, newestTag]);

            if (!latestVersion) {
                // Both calls share the same quota, so either one flags the rate limit.
                return res.json(unavailablePayload(releaseResult.rateLimited || tagsResult.rateLimited));
            }

            // Release notes describe the release - only usable when it is the newest version.
            const releaseIsLatest = Boolean(release?.tag_name) && release.tag_name === latestVersion;

            res.json({
                success: true,
                data: {
                    ...installed,
                    hasUpdate: installed.currentVersion !== latestVersion,
                    unavailable: false,
                    rateLimited: false,
                    message: null,
                    latestVersion,
                    releaseName: releaseIsLatest ? (release.name || latestVersion) : latestVersion,
                    releasePublishedAt: releaseIsLatest ? formatDate(release.published_at) : null,
                    details: releaseIsLatest ? (release.body ?? null) : null
                }
            });
        } catch (error: any) {
            console.error('[server]: Update check failed:', error.message);
            res.json(unavailablePayload(false));
        }
    });

    // Progress of the update pipeline. Runs the same reconciliation as the startup
    // recovery, so an interrupted update never stays "running" in the UI.
    router.get('/update/status', async (req, res) => {
        try {
            const state = reconcileUpdateState(readUpdateStateFile());
            res.json({ success: true, data: updateStatusPayload(state) });
        } catch (error: any) {
            console.error('[server]: Failed to read update status:', error.message);
            res.status(500).json({ success: false, message: 'Der Update-Status konnte nicht gelesen werden.', code: 'SYSTEM_UPDATE_STATUS_FAILED' });
        }
    });

    // Installs a release tag: the heavy work (checkout, both builds, service restart) is
    // handed to the update unit, because this process is stopped by that restart.
    router.post('/update', async (req, res) => {
        const { tag } = req.body || {};

        if (typeof tag !== 'string' || !TAG_PATTERN.test(tag)) {
            return res.status(400).json({ success: false, message: 'Ungültige Ziel-Version. Erwartet wird ein Tag wie "v1.2.3".', code: 'VALIDATION_ERROR' });
        }

        const current = updateStatusPayload(reconcileUpdateState(readUpdateStateFile()));
        if (current.running) {
            return res.status(409).json({ success: false, message: `Es läuft bereits ein Update auf ${current.targetTag}. Bitte abwarten.`, code: 'SYSTEM_UPDATE_IN_PROGRESS' });
        }

        if (!fs.existsSync(UPDATE_SCRIPT)) {
            console.error(`[server]: Update script ${UPDATE_SCRIPT} is missing.`);
            return res.status(500).json({ success: false, message: 'Das automatische Update ist auf diesem Server nicht eingerichtet. Bitte die Einrichtung gemäß docs/install.md nachholen.', code: 'SYSTEM_UPDATE_UNAVAILABLE' });
        }

        const git = await readGitInfo();
        const fromVersion = git.gitTag || '';
        const startedAt = new Date().toISOString();

        // The worker reads this file; nothing is ever passed on a command line, so no
        // user input reaches the privileged unit.
        try {
            fs.mkdirSync(UPDATE_STATE_DIR, { recursive: true });
            fs.writeFileSync(UPDATE_REQUEST_FILE, `tag=${tag}\nfrom=${fromVersion}\n`, { mode: 0o644 });
        } catch (error: any) {
            console.error('[server]: Update request could not be written:', error.message);
            return res.status(500).json({ success: false, message: 'Das Update konnte nicht vorbereitet werden (Zustandsverzeichnis nicht beschreibbar).', code: 'SYSTEM_UPDATE_UNAVAILABLE' });
        }

        // Publish "queued" before the worker takes over, so the UI shows progress at once.
        // pid=0 marks the short window until the worker publishes its own pid.
        const queuedState: UpdateState = {
            status: 'running',
            step: 'fetch',
            index: '1',
            total: String(UPDATE_STEP_TOTAL),
            target: tag,
            from: fromVersion,
            started: startedAt,
            finished: '',
            pid: '0',
            error: ''
        };

        try {
            writeUpdateState(queuedState);
        } catch (error: any) {
            console.warn('[server]: Could not publish queued update state:', error.message);
        }

        try {
            await execFileAsync('sudo', ['-n', 'systemctl', 'start', '--no-block', UPDATE_UNIT], { timeout: 20000 });
        } catch (error: any) {
            console.error('[server]: Update unit could not be started:', error.message);

            try {
                fs.unlinkSync(UPDATE_REQUEST_FILE);
            } catch { /* request may already be gone */ }

            try {
                writeUpdateState({
                    ...queuedState,
                    status: 'failed',
                    finished: new Date().toISOString(),
                    pid: '',
                    error: 'Das Update konnte nicht gestartet werden.'
                });
            } catch { /* state is best effort */ }

            return res.status(500).json({ success: false, message: 'Das Update konnte nicht gestartet werden. Bitte die Einrichtung gemäß docs/install.md prüfen.', code: 'SYSTEM_UPDATE_UNAVAILABLE' });
        }

        console.log(`[server]: Update to ${tag} queued (${UPDATE_UNIT}).`);

        res.json({
            success: true,
            data: {
                ...updateStatusPayload(readUpdateStateFile()),
                targetTag: tag,
                message: `Update auf ${tag} wird installiert. Der Dienst startet dabei automatisch neu.`
            }
        });
    });

    return router;
};
