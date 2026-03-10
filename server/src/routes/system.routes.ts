import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const execAsync = promisify(exec);

export const systemRoutes = () => {
    const router = Router();

    router.get('/info', async (req, res) => {
        try {
            const pkgPath = path.join(__dirname, '../../package.json');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            res.json({
                success: true,
                version: pkg.version,
                nodeVersion: process.version,
                platform: process.platform
            });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Could not read version info' });
        }
    });

    router.get('/check-update', async (req, res) => {
        try {
            const token = process.env.GITHUB_TOKEN;
            const owner = process.env.GITHUB_OWNER || 'dodi110480';
            const repo = process.env.GITHUB_REPO || 'heritago';

            const projectRoot = path.resolve(__dirname, '../../');

            try {
                await execAsync(`git config --global --add safe.directory ${projectRoot}`);
            } catch (e) {}

            const headers: any = { 'Accept': 'application/vnd.github.v3+json' };
            if (token) {
                headers['Authorization'] = `token ${token}`;
            }

            const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
                headers
            });

            const latestRelease: any = response.data;
            const latestTag = latestRelease.tag_name;

            let currentTag = '';
            try {
                const { stdout: tagStdout } = await execAsync('git describe --tags --abbrev=0', { cwd: projectRoot });
                currentTag = tagStdout.trim();
            } catch (e) {
                try {
                    const { stdout: hashStdout } = await execAsync('git rev-parse --short HEAD', { cwd: projectRoot });
                    currentTag = hashStdout.trim();
                } catch (e2) {
                    currentTag = 'unknown';
                }
            }

            const hasUpdate = currentTag !== latestTag;

            res.json({
                success: true,
                hasUpdate,
                currentVersion: currentTag,
                latestVersion: latestTag,
                releaseName: latestRelease.name,
                details: latestRelease.body
            });
        } catch (error: any) {
            console.error('Update check error:', error.response?.data || error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to check for updates',
                error: error.response?.data?.message || error.message
            });
        }
    });

    router.post('/update', async (req, res) => {
        try {
            const { tag } = req.body;
            if (!tag) {
                return res.status(400).json({ success: false, message: 'No target tag provided' });
            }

            console.log(`[server]: Starting application update to ${tag}...`);
            await execAsync('git fetch --tags');
            const { stdout, stderr } = await execAsync(`git checkout tags/${tag}`);
            console.log('[server]: git checkout output:', stdout);

            if (stderr && !stderr.includes('HEAD is now at')) {
                console.warn('[server]: git checkout warning:', stderr);
            }

            res.json({
                success: true,
                message: `Update to ${tag} successful. Server might need a restart if backend code changed.`,
                output: stdout
            });
        } catch (error: any) {
            console.error('Update execution error:', error);
            res.status(500).json({ success: false, message: 'Update failed', error: error.message });
        }
    });

    return router;
};
