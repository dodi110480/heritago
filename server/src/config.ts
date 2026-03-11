import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

// --- STORAGE CONFIGURATION ---
export let STORAGE_ROOT = '/var/heri/media';
try {
    if (!fs.existsSync(STORAGE_ROOT)) {
        fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    }
} catch (e) {
    console.warn(`[server]: Could not use /var/heri/media (permission denied). Using local fallback.`);
    STORAGE_ROOT = path.join(__dirname, '../media-storage');
}

export const USERS_DIR = path.join(STORAGE_ROOT, 'users');
export const MEDIA_ROOT = path.join(STORAGE_ROOT, 'uploads');
export const TEMP_DIR = path.join(STORAGE_ROOT, 'temp');

// Ensure root directories exist
[STORAGE_ROOT, USERS_DIR, MEDIA_ROOT, TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[server]: Created directory ${dir}`);
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, MEDIA_ROOT);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uuid = crypto.randomUUID();
        cb(null, `${uuid}${ext}`);
    }
});

export const upload = multer({ storage });
