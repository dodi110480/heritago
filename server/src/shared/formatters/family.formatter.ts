// server/src/shared/formatters/family.formatter.ts
import { PersonFormatter } from './person.formatter';

export class FamilyFormatter {
    static formatFamilyForClient(fam: any) {
        if (!fam) return null;
        
        const spouses = (fam.familyMembers || []).filter((m: any) => m.role === 'SPOUSE');
        const husband = spouses.find((m: any) => m.person?.sex === 'M')?.personId || spouses[0]?.personId;
        const wife = spouses.find((m: any) => m.person?.sex === 'F' && m.personId !== husband)?.personId || (spouses.length > 1 ? spouses[1].personId : null);
        const children = (fam.familyMembers || []).filter((m: any) => m.role === 'CHILD').map((m: any) => m.personId);

        const getName = (pId: string | null) => {
            if (!pId) return 'Unbekannt';
            const member = (fam.familyMembers || []).find((m: any) => m.personId === pId);
            const p = member?.person;
            return p ? PersonFormatter.getPrimaryName(p) : 'Unbekannt';
        };

        const meta = this.getFamilyMetadata(fam);

        return {
            id: fam.id,
            gedcomId: fam.gedcomId,
            treeId: fam.treeId,
            husband,
            wife,
            husbandName: getName(husband),
            wifeName: getName(wife),
            profileImageUrl: this.getFamilyImage(fam),
            childNames: children.map((cId: string) => getName(cId)).join(', '),
            children,
            ...meta,
            events: (fam.events || []).map((e: any) => ({
                id: e.id,
                type: e.type,
                dateText: e.dateText,
                place: e.place?.name,
                description: e.description
            })),
            updatedAt: fam.updatedAt
        };
    }

    static getFamilyMetadata(fam: any) {
        const events = fam.events || [];
        const tags = events.map((e: any) => (e.type || '').toUpperCase());

        let status = 'UNKNOWN';
        let statusLabel = 'Partnerschaft/Familie';
        
        if (tags.includes('DIV')) { status = 'DIV'; statusLabel = 'Geschieden'; }
        else if (tags.includes('MARR')) { status = 'MARR'; statusLabel = 'Verheiratet'; }

        const marrEvent = events.find((e: any) => e.type === 'MARR');
        const marriageLabel = marrEvent 
            ? `${marrEvent.dateText || ''}${marrEvent.place?.name ? ' in ' + marrEvent.place.name : ''}`.trim()
            : '';

        return {
            status,
            statusLabel,
            marriageLabel,
            childrenCount: (fam.familyMembers || []).filter((m: any) => m.role === 'CHILD').length
        };
    }

    static getFamilyImage(fam: any) {
        const primaryMedia = fam.mediaLinks?.find((ml: any) => ml.isPrimary);
        return primaryMedia?.media?.id || null;
    }
}
