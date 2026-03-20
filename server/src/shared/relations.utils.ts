import { EventType } from '@prisma/client';

/**
 * Standard inclusions for notes, citations, and media links.
 * Used across multiple models (Person, Family, Event, Fact, Source, Media).
 */
export function includeStandardRelations() {
    return {
        noteLinks: { 
            include: { 
                note: { 
                    include: { 
                        createdBy: true 
                    } 
                } 
            } 
        },
        citations: { 
            include: { 
                source: true, 
                citationTexts: true 
            } 
        },
        mediaLinks: { 
            include: { 
                media: true 
            } 
        },
    };
}

/**
 * Inclusions specifically for events and facts which usually include a place.
 */
export function includeEventRelations() {
    const standard = includeStandardRelations();
    return {
        place: true,
        citations: standard.citations,
        noteLinks: standard.noteLinks,
        mediaLinks: standard.mediaLinks,
        associations: {
            include: {
                associated: {
                    include: {
                        names: true,
                        events: {
                            where: { type: { in: ["BIRT", "DEAT"] as EventType[] } },
                            select: { type: true, dateText: true }
                        }
                    }
                }
            }
        }
    };
}
