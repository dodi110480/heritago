import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { GedcomService } from '../services/gedcom.service';
import { GedcomImportEngine } from '../import-phases/GedcomImportEngine.service';
import { upload } from '../config';

export const gedcomRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });

    const gedcomService = new GedcomService(prisma);

    router.get('/export', async (req: any, res) => {
        try {
            const tree = req.tree;
            const gedcom = await gedcomService.exportTree(tree.id);
            res.setHeader('Content-Type', 'text/plain');
            res.attachment(`${tree.name}.ged`);
            res.send(gedcom);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'GEDCOM_EXPORT_FAILED' });
        }
    });

    router.get('/download', async (req: any, res) => {
        try {
            const tree = req.tree;
            const gedcom = await gedcomService.exportTree(tree.id);
            const payload = Buffer.from(gedcom, 'utf8');

            res.setHeader('Content-Type', 'application/gedcom; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${tree.name}.ged"`);
            res.send(payload);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'GEDCOM_EXPORT_FAILED' });
        }
    });

    router.post('/import', upload.single('file'), async (req: any, res) => {
        const tree = req.tree;
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded', code: 'FILE_REQUIRED' });

        try {
            const engine = new GedcomImportEngine(prisma);
            const result = await engine.runImport(tree.id, req.file.path, req.file.originalname);

            // Datei nach Import löschen
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

            res.json({ success: true, data: { importId: result.importId } });
        } catch (error: any) {
            console.error('Import error:', error);
            // Auch bei Fehler löschen
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ success: false, message: error.message, code: 'GEDCOM_IMPORT_FAILED' });
        }
    });

    return router;
};
