import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { GedcomManager } from '../services/gedcom.service';
import { GedcomImportEngine } from '../import-phases/GedcomImportEngine.service';
import { upload } from '../index';

export const gedcomRoutes = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/:tree/export', async (req, res) => {
        const treeName = req.params.tree as string;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const gedcom = await GedcomManager.exportTree(prisma, tree.id);
        res.json({ success: true, gedcom });
    });

    router.get('/:tree/export.ged', async (req, res) => {
        const treeName = req.params.tree as string;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).send('Tree not found');

        const gedcom = await GedcomManager.exportTree(prisma, tree.id);
        const payload = Buffer.from(gedcom, 'utf8');

        res.setHeader('Content-Type', 'application/gedcom; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${treeName}.ged"`);
        res.send(payload);
    });

    router.post('/:tree/import', upload.single('file'), async (req, res) => {
        const treeName = req.params.tree as string;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

        try {
            const engine = new GedcomImportEngine(prisma);
            const result = await engine.runImport(tree.id, req.file.path, req.file.originalname);

            // Datei nach Import löschen
            fs.unlinkSync(req.file.path);

            res.json({ success: true, importId: result.importId });
        } catch (error: any) {
            console.error('Import error:', error);
            // Auch bei Fehler löschen
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
