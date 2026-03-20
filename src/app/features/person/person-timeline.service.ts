import { Injectable, inject } from '@angular/core';
import { Individual, TimelineItem, TreeData } from '../../core/models/models';
import { TreeService } from '../../core/services/tree.service';


import { MediaService } from '../../core/services/media.service';
@Injectable({
    providedIn: 'root'
})
export class PersonTimelineService {
    public mediaService = inject(MediaService);

    constructor(private treeService: TreeService) {}

    // --- UI Formatting Helpers ---


    // --- UI Formatting Helpers ---

    getPersonName(treeData: TreeData | null, id: string | undefined): string {
        if (!id) return '';
        if (!treeData) return id;
        const p = treeData.individuals.find(i => i.id === id);
        if (!p) return id;
        const given = p.names?.[0]?.given || p.firstName || '';
        const sur = p.names?.[0]?.surname || p.lastName || '';
        return `${given} ${sur}`.trim() || id;
    }

    getPrimaryName(person: Individual | null): string {
        if (!person) return '';
        const primaryName = person.names?.find(n => n.isPrimary);
        if (primaryName) {
            return `${primaryName.given || ''} ${primaryName.surname || ''}`.trim();
        }
        return `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.id;
    }

    getProfileImage(person: Individual | null): string | null {
        if (!person || !person.media || person.media.length === 0) return null;
        const primary = person.media.find(m => m.isPrimary) || person.media[0];
        return primary?.id ? this.mediaService.getMediaUrl(primary.id, 'thumbs') : null;
    }

    getPersonAvatarData(treeData: TreeData | null, personId: string | undefined): { url: string | null, gender: string } {
        if (!personId || !treeData) return { url: null, gender: 'U' };
        const p = treeData.individuals.find(i => i.id === personId);
        if (!p) return { url: null, gender: 'U' };
        const primaryMedia = p.media && p.media.length > 0 ? (p.media.find(m => m.isPrimary) || p.media[0]) : null;
        const url = primaryMedia?.id ? this.mediaService.getMediaUrl(primaryMedia.id, 'thumbs') : null;
        return { url, gender: p.gender || 'U' };
    }


    getSourceTitle(availableSources: any[], sourceId?: string): string {
        if (!sourceId) return 'Ohne Quelle';
        const src = availableSources.find((s: any) => s.id === sourceId);
        return src ? (src.title || src.displayName || sourceId) : sourceId;
    }

    getNoteTypeLabel(type?: string): string {
        // Backend now handles this, but keep as thin proxy if needed
        const map: Record<string, string> = {
            GENERAL: 'Allgemein',
            RESEARCH: 'Recherche',
            TRANSCRIPTION: 'Transkript',
            ANALYSIS: 'Analyse',
            TODO: 'ToDo'
        };
        return map[type || ''] || (type || 'Allgemein');
    }

    getConfidenceLabel(conf: string): string {
        switch (conf) {
            case 'CERTAIN': return 'Sicher';
            case 'VERY_LIKELY': return 'Sehr wahrscheinlich';
            case 'LIKELY': return 'Wahrscheinlich';
            case 'POSSIBLE': return 'Möglich';
            case 'UNLIKELY': return 'Unwahrscheinlich';
            default: return 'Keine Angabe';
        }
    }

    getConfidenceColorClass(conf: string): string {
        switch (conf) {
            case 'CERTAIN': return 'badge-success';
            case 'VERY_LIKELY': return 'bg-emerald-500/10 text-emerald-500'; 
            case 'LIKELY': return 'badge-highlight';
            case 'POSSIBLE': return 'badge-warn';
            case 'UNLIKELY': return 'badge-danger';
            default: return 'bg-neutral-950/10 text-neutral-400';
        }
    }

    getRoleIcon(role: string): string {
        switch (role) {
            case 'GODPARENT': return '👼';
            case 'WITNESS': return '⚖️';
            case 'CLERGY': return '⛪';
            case 'INFORMANT': return '🗣️';
            case 'MIDWIFE': return '🤱';
            case 'DOCTOR': return '🩺';
            case 'UNDERTAKER': return '⚰️';
            case 'OTHER': return '👤';
            default: return '👤';
        }
    }

    genderLabel(gender?: string): string {
        if (gender === 'M') return 'Männlich';
        if (gender === 'F') return 'Weiblich';
        if (gender === 'X') return 'Divers';
        return 'Unbekannt';
    }

    privacyLabel(level?: string): string {
        if (level === 'PUBLIC') return 'Öffentlich';
        if (level === 'FAMILY') return 'Familie';
        return 'Privat';
    }

    getRoleLabel(role: string): string {
        switch (role) {
            case 'GODPARENT': return 'Pate / Gevatter';
            case 'WITNESS': return 'Zeuge';
            case 'CLERGY': return 'Pfarrer / Priester';
            case 'INFORMANT': return 'Informant';
            case 'MIDWIFE': return 'Hebamme';
            case 'DOCTOR': return 'Arzt';
            case 'UNDERTAKER': return 'Bestatter';
            case 'OTHER': return 'Andere / Beteiligter';
            default: return role;
        }
    }

    getEventLabel(tag: string): string {
        const labels: { [key: string]: string } = {
            'BIRT': 'Geburt', 'CHR': 'Taufe', 'DEAT': 'Tod', 'BURI': 'Begräbnis',
            'MARR': 'Heirat', 'OCCU': 'Beruf', 'ADOP': 'Adoption', 'CENS': 'Volkszählung',
            'RELI': 'Religion', 'EVEN': 'Ereignis', 'DIV': 'Scheidung'
        };
        return labels[tag] || tag;
    }
}
