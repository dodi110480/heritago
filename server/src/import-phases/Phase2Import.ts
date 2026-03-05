import { PrismaClient } from '@prisma/client';
import { GedcomNode } from './GedcomParser';

export class Phase2Import {
    private batchSize = 1000;
    private buffers: Record<string, any[]> = {
        INDI: [],
        FAM: [],
        EVEN: [],
        FACT: [],
        SOUR: [],
        SUBM: [],
        REPO: [],
        OBJE: [],
        NOTE: [],
        SNOTE: []
    };

    constructor(private prisma: PrismaClient, private treeId: string, private importId: string) { }

    async processNode(node: GedcomNode) {
        const tag = node.tag.toUpperCase();

        switch (tag) {
            case 'INDI':
                this.buffers.INDI.push({
                    treeId: this.treeId,
                    importId: this.importId,
                    gedcomXref: node.xref || '',
                    rawJson: node as any
                });
                break;
            case 'FAM':
                this.buffers.FAM.push({
                    treeId: this.treeId,
                    importId: this.importId,
                    gedcomXref: node.xref || '',
                    rawJson: node as any
                });
                break;
            case 'SOUR':
                this.buffers.SOUR.push({
                    treeId: this.treeId,
                    importId: this.importId,
                    gedcomXref: node.xref || '',
                    rawJson: node as any
                });
                break;
            case 'SUBM':
                this.buffers.SUBM.push({
                    treeId: this.treeId,
                    importId: this.importId,
                    gedcomXref: node.xref || '',
                    rawJson: node as any
                });
                break;
            case 'REPO':
                this.buffers.REPO.push({
                    treeId: this.treeId,
                    importId: this.importId,
                    gedcomXref: node.xref || '',
                    rawJson: node as any
                });
                break;
            case 'OBJE':
                this.buffers.OBJE.push({
                    treeId: this.treeId,
                    importId: this.importId,
                    gedcomXref: node.xref || '',
                    rawJson: node as any
                });
                break;
            case 'NOTE':
            case 'SNOTE':
                this.buffers.NOTE.push({
                    treeId: this.treeId,
                    importId: this.importId,
                    gedcomXref: node.xref || '',
                    rawJson: node as any
                });
                break;
            // EVEN/FACT am Level 0 sind seltener, aber wir fangen sie ab
            case 'EVEN':
            case 'FACT':
                this.buffers.EVEN.push({
                    treeId: this.treeId,
                    importId: this.importId,
                    gedcomXref: node.xref || '',
                    rawJson: node as any
                });
                break;
        }

        await this.flushIfFull();
    }

    private async flushIfFull() {
        for (const [tag, buffer] of Object.entries(this.buffers)) {
            if (buffer.length >= this.batchSize) {
                await this.flushBuffer(tag);
            }
        }
    }

    async flushAll() {
        for (const tag of Object.keys(this.buffers)) {
            await this.flushBuffer(tag);
        }
    }

    private async flushBuffer(tag: string) {
        const buffer = this.buffers[tag];
        if (buffer.length === 0) return;

        console.log(`Phase 2: Flushing ${buffer.length} records for ${tag}`);

        switch (tag) {
            case 'INDI':
                await this.prisma.importPerson.createMany({ data: buffer });
                break;
            case 'FAM':
                await this.prisma.importFamily.createMany({ data: buffer });
                break;
            case 'SOUR':
                await this.prisma.importSource.createMany({ data: buffer });
                break;
            case 'SUBM':
                await this.prisma.importSubmitter.createMany({ data: buffer });
                break;
            case 'REPO':
                await this.prisma.importRepository.createMany({ data: buffer });
                break;
            case 'OBJE':
                await this.prisma.importMedia.createMany({ data: buffer });
                break;
            case 'NOTE':
            case 'SNOTE':
                await this.prisma.importSharedNote.createMany({ data: buffer });
                break;
            case 'EVEN':
            case 'FACT':
                await this.prisma.importEvent.createMany({ data: buffer });
                break;
        }

        this.buffers[tag] = [];
    }
}
