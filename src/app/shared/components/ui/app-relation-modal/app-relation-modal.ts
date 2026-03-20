import { Component, input, output, signal, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppModalShell } from '../app-modal-shell';
import { AppNotesList } from '../app-notes-list/app-notes-list';
import { AppSourcesListComponent } from '../app-sources-list/app-sources-list';
import { PlaceService } from '../../../../core/services/place.service';
import { MediaService } from '../../../../core/services/media.service';
import { DisplayNote, NoteCategory, DisplaySource, LifeEvent } from '../../../../core/models/models';
import { resolvePersonOption, stripIdSuffix } from '../../../utils/person-autocomplete';

export interface RelationDraft {
    type: string;
    personId: string;
    personName?: string;
    familyId?: string;
    familyMemberId?: string;
    profileImageUrl?: string;
    
    // Family Level
    marriageType?: string;
    restrictionNotice?: string;
    pedigreeType?: string;
    isPrimary?: boolean;
    sortOrder?: number;

    // Wedding Event (MARR)
    weddingEvent?: any; // LifeEvent draft
    
    // Notes & Citations (Family Level)
    notes?: any[];
    citations?: any[];
    media?: any[];

    // Legacy support (will be mapped to weddingEvent)
    weddingDate?: string;
    weddingPlace?: string;
}

@Component({
  selector: 'app-relation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppModalShell, AppNotesList, AppSourcesListComponent],
  templateUrl: './app-relation-modal.html'
})
export class AppRelationModal implements OnChanges {
  public placeService = inject(PlaceService);
  public mediaService = inject(MediaService);
  visible = input.required<boolean>();
  relation = input<RelationDraft | null>(null);
  allPersonsOptions = input<{ id: string, displayName: string }[]>([]);
  availableSources = input<any[]>([]);
  errorMessage = input<string | null>(null);
  
  close = output<void>();
  save = output<RelationDraft>();
  delete = output<void>();
  search = output<string>();
  navigateToPerson = output<string>();
  openGallery = output<void>();
  openUpload = output<void>();
  openViewer = output<any>();

  draft = signal<RelationDraft>({
    type: 'SPOUSE',
    personId: '',
    personName: ''
  });

  activeTab = signal<'basics' | 'citations' | 'media' | 'notes'>('basics');
  personInput = signal<string>('');
  personInputFocused = signal(false);
  showConfirmDelete = signal(false);

  onMarriageTypeChange(val: string) {
    console.log('[Modal] onMarriageTypeChange:', val);
    this.draft.update(v => ({ ...v, marriageType: val }));
  }

  updateWeddingEvent(field: string, val: any) {
    this.draft.update(v => {
        if (!v.weddingEvent) v.weddingEvent = { type: 'MARR', isPrimary: true };
        (v.weddingEvent as any)[field] = val;
        return { ...v };
    });
  }

  // Dropdown Options
  readonly MARRIAGE_TYPE_OPTIONS = [
    { value: 'CIVIL', label: 'Zivil' },
    { value: 'RELIGIOUS', label: 'Kirchlich' },
    { value: 'COMMON_LAW', label: 'Wild-Ehe / Lebensgemeinschaft' },
    { value: 'SAME_SEX', label: 'Gleichgeschlechtlich' },
    { value: 'UNKNOWN', label: 'Unbekannt' }
  ];

  readonly PRECISION_OPTIONS = [
    { value: 'EXACT', label: 'Genau' },
    { value: 'ABOUT', label: 'Ca.' },
    { value: 'CALCULATED', label: 'Berechnet' },
    { value: 'BEFORE', label: 'Vor' },
    { value: 'AFTER', label: 'Nach' },
    { value: 'BETWEEN', label: 'Zwischen' },
    { value: 'RANGE', label: 'Zeitraum' }
  ];

  readonly RESTRICTION_OPTIONS = [
    { value: 'NONE', label: 'Keine' },
    { value: 'CONFIDENTIAL', label: 'Vertraulich' },
    { value: 'LOCKED', label: 'Gesperrt' },
    { value: 'PRIVACY', label: 'Privatsphäre' }
  ];

  readonly PEDIGREE_TYPE_OPTIONS = [
    { value: 'BIRTH', label: 'Leiblich' },
    { value: 'STEP', label: 'Stiefeltern' },
    { value: 'FOSTER', label: 'Pflegeeltern / Ziehkind' },
    { value: 'ADOPTED', label: 'Adoptiert' }
  ];

  ngOnChanges(changes: SimpleChanges) {
    // Only initialize if visibility changed or the relation object itself changed
    const shouldInit = (changes['visible']?.currentValue === true && changes['visible']?.previousValue !== true) || 
                      (changes['relation'] && this.visible());

    if (shouldInit) {
      const r = this.relation();
      console.log('[Modal] Initializing draft state', r);
      if (r) {
        this.draft.set({ 
          ...r,
          marriageType: r.marriageType || '', // Ensure field exists
          weddingEvent: r.weddingEvent ? { ...r.weddingEvent, showInTimeline: true } : { type: 'MARR', isPrimary: true, dateText: r.weddingDate, place: r.weddingPlace, showInTimeline: !!(r.weddingDate || r.weddingPlace) }
        });
        this.personInput.set(r.personName ? `${r.personName} (${r.personId})` : (r.personId || ''));
      } else {
        this.draft.set({
          type: 'SPOUSE',
          personId: '',
          personName: '',
          pedigreeType: 'BIRTH',
          isPrimary: false,
          marriageType: '',
          weddingEvent: { type: 'MARR', isPrimary: true, showInTimeline: false },
          notes: [],
          citations: [],
          media: []
        });
        this.personInput.set('');
      }
      this.activeTab.set('basics');
      this.showConfirmDelete.set(false);
    }
  }

  onPersonInputChange(val: string) {
    this.personInput.set(val);
    
    // Emit search event for backend lookup
    if (val.length >= 2) {
        console.log('[Modal] Searching for:', val);
        this.search.emit(val);
    }

    const match = resolvePersonOption(val, this.allPersonsOptions(), { allowPrefix: true });
    if (match?.id) {
        const cleanName = stripIdSuffix(String(match.displayName || match.name || val));
        this.draft.update(v => ({ ...v, personId: String(match.id), personName: cleanName }));
    } else {
        this.draft.update(v => ({ ...v, personId: '', personName: val }));
    }
  }

  onPersonInputFocus() {
    this.personInputFocused.set(true);
  }

  onPersonInputBlur() {
    // Delay close slightly so a click on a suggestion can still be processed.
    window.setTimeout(() => this.personInputFocused.set(false), 120);
  }

  selectPersonOption(displayName: string) {
    this.onPersonInputChange(displayName);
    this.personInputFocused.set(false);
  }

  // --- SOURCES HANDLING (Analog to EventModal) ---
  showSourceSubModal = signal(false);
  activeSourceIndex = signal<number | null>(null);
  sourceDraft = signal<{ sourceId: string; confidence?: string; whereInSource?: string; date?: string; text?: string }>({ 
    sourceId: '', whereInSource: '', confidence: '', date: '', text: '' 
  });

  onSourceCreateRequested() {
    this.sourceDraft.set({ sourceId: '', whereInSource: '', confidence: '', date: '', text: '' });
    this.activeSourceIndex.set(null);
    this.showSourceSubModal.set(true);
  }

  onSourceEditRequested(source: DisplaySource & { _originalIndex?: number }) {
    if (source._originalIndex === undefined) return;
    const d = this.draft();
    const isSpouse = d.type === 'SPOUSE';
    const citations = isSpouse ? d.weddingEvent?.citations : d.citations;
    
    if (!citations) return;
    const cit = citations[source._originalIndex];
    if (cit) {
      this.sourceDraft.set({ 
        sourceId: cit.sourceId || '',
        whereInSource: cit.whereInSource || '',
        confidence: cit.confidence || '',
        date: cit.date || '',
        text: cit.text || ''
      });
      this.activeSourceIndex.set(source._originalIndex);
      this.showSourceSubModal.set(true);
    }
  }

  onSourceSave() {
    const draft = this.sourceDraft();
    if (!draft.sourceId) return;

    const d = this.draft();
    const isSpouse = d.type === 'SPOUSE';
    
    const newCit = {
      sourceId: draft.sourceId,
      whereInSource: draft.whereInSource || '',
      confidence: draft.confidence || '',
      date: draft.date || '',
      text: draft.text || ''
    };

    if (isSpouse) {
        if (!d.weddingEvent) d.weddingEvent = { type: 'MARR', isPrimary: true };
        d.weddingEvent.citations = d.weddingEvent.citations || [];
        if (this.activeSourceIndex() !== null) {
            d.weddingEvent.citations[this.activeSourceIndex()!] = { ...d.weddingEvent.citations[this.activeSourceIndex()!], ...newCit };
        } else {
            d.weddingEvent.citations.push(newCit);
        }
    } else {
        d.citations = d.citations || [];
        if (this.activeSourceIndex() !== null) {
            d.citations[this.activeSourceIndex()!] = { ...d.citations[this.activeSourceIndex()!], ...newCit };
        } else {
            d.citations.push(newCit);
        }
    }
    this.showSourceSubModal.set(false);
  }

  onSourceDeleteFromModal() {
    const idx = this.activeSourceIndex();
    const d = this.draft();
    // Try event first, then family
    const citations = d.weddingEvent?.citations || d.citations;
    if (idx !== null && citations && citations[idx]) {
      if (confirm('Beleg löschen?')) {
        citations.splice(idx, 1);
        this.showSourceSubModal.set(false);
      }
    }
  }

  normalizedMedia(): any[] {
    const d = this.draft();
    return (d.weddingEvent?.media?.length ? d.weddingEvent.media : d.media) || [];
  }

  normalizedSources(): any[] {
    const d = this.draft();
    const citations = (d.weddingEvent?.citations?.length ? d.weddingEvent.citations : d.citations) || [];
    return citations.map((c: any, i: number) => {
      const rawSource = this.availableSources().find(s => s.id === c.sourceId);
      return {
        id: c.id || `cit-${i}`,
        title: rawSource ? rawSource.title : 'Unbekannte Quelle',
        author: rawSource ? rawSource.author : undefined,
        publication: rawSource ? rawSource.publication : undefined,
        confidence: c.confidence,
        whereInSource: c.whereInSource,
        description: (c.whereInSource) ? `Fundstelle: ${c.whereInSource}` : '',
        text: c.text,
        createdAt: c.date ? new Date(c.date) : new Date(),
        _originalIndex: i
      };
    });
  }

  onSourceDeleted(id: string) {
    const ev = this.draft().weddingEvent;
    if (!ev || !ev.citations) return;
    const idx = ev.citations.findIndex((c: any, i: number) => (c.id || `cit-${i}`) === id);
    if (idx !== -1 && confirm('Beleg löschen?')) {
      ev.citations.splice(idx, 1);
    }
  }

  // --- NOTES HANDLING ---
  showNoteSubModal = signal(false);
  activeNoteIndex = signal<number | null>(null);
  noteDraft = signal<{ text: string; noteType?: string; isPrivate?: boolean }>({ text: '', noteType: 'OTHER', isPrivate: false });

  onNoteCreateRequested() {
    this.noteDraft.set({ text: '', noteType: 'OTHER', isPrivate: false });
    this.activeNoteIndex.set(null);
    this.showNoteSubModal.set(true);
  }

  onNoteEditRequested(note: DisplayNote) {
    const d = this.draft();
    const isSpouse = d.type === 'SPOUSE';
    const notes = isSpouse ? d.weddingEvent?.notes : d.notes;
    
    if (!notes) return;
    const idx = notes.findIndex((n: any, i: number) => (n.id || `note-${i}`) === note.id);
    if (idx !== -1) {
      const n = notes[idx];
      this.noteDraft.set({ 
        text: n.text || '', 
        noteType: (n as any).noteType || 'OTHER', 
        isPrivate: !!(n as any).isPrivate 
      });
      this.activeNoteIndex.set(idx);
      this.showNoteSubModal.set(true);
    }
  }

  onNoteSave() {
    const draft = this.noteDraft();
    const d = this.draft();
    const isSpouse = d.type === 'SPOUSE';

    const newNote = { 
        ...draft, 
        id: this.activeNoteIndex() !== null ? (isSpouse ? d.weddingEvent?.notes?.[this.activeNoteIndex()!]?.id : d.notes?.[this.activeNoteIndex()!]?.id) : `note-${Date.now()}` 
    };

    if (isSpouse) {
        if (!d.weddingEvent) d.weddingEvent = { type: 'MARR', isPrimary: true };
        d.weddingEvent.notes = d.weddingEvent.notes || [];
        if (this.activeNoteIndex() !== null) {
            d.weddingEvent.notes[this.activeNoteIndex()!] = { ...d.weddingEvent.notes[this.activeNoteIndex()!], ...newNote };
        } else {
            d.weddingEvent.notes.push(newNote);
        }
    } else {
        d.notes = d.notes || [];
        if (this.activeNoteIndex() !== null) {
            d.notes[this.activeNoteIndex()!] = { ...d.notes[this.activeNoteIndex()!], ...newNote };
        } else {
            d.notes.push(newNote);
        }
    }
    this.showNoteSubModal.set(false);
  }

  onNoteDeleteFromModal() {
    const idx = this.activeNoteIndex();
    const d = this.draft();
    const notes = d.weddingEvent?.notes || d.notes;
    if (idx !== null && notes && notes[idx]) {
      if (confirm('Notiz löschen?')) {
        notes.splice(idx, 1);
        this.showNoteSubModal.set(false);
      }
    }
  }

  normalizedNotes(): DisplayNote[] {
    const d = this.draft();
    return (d.weddingEvent?.notes?.length ? d.weddingEvent.notes : d.notes) || [];
  }

  onNoteDeleted(id: string) {
    const ev = this.draft().weddingEvent;
    if (!ev || !ev.notes) return;
    const idx = ev.notes.findIndex((n: any, i: number) => (n.id || `note-${i}`) === id);
    if (idx !== -1 && confirm('Notiz löschen?')) {
      ev.notes.splice(idx, 1);
    }
  }

  // --- MEDIA HANDLING ---
  getMediaUrl(id: string, variant = 'thumbs') {
    return this.mediaService.getMediaUrl(id, variant);
  }

  onSave() {
    if (!this.draft().personId) return;
    
    // Final sync and log
    const d = { ...this.draft() };
    console.log('[Modal] PRE-EMIT Draft:', JSON.stringify(d));
    
    // Map wedding fields back for compatibility if needed
    if (d.weddingEvent) {
        d.weddingDate = d.weddingEvent.dateText;
        d.weddingPlace = d.weddingEvent.place;
    }
    
    console.log('[Modal] EMITTING Draft:', JSON.stringify(d));
    this.save.emit(d);
  }

  onDelete() {
    if (this.showConfirmDelete()) {
      this.delete.emit();
      this.showConfirmDelete.set(false);
    } else {
      this.showConfirmDelete.set(true);
    }
  }
}
