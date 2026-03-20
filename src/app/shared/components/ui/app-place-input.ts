import { Component, Input, Output, EventEmitter, inject, signal, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlaceService } from '../../../core/services/place.service';
import { TreeService } from '../../../core/services/tree.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-place-input',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="relative w-full" #container>
            <input 
                type="text" 
                [(ngModel)]="value" 
                (ngModelChange)="onInput($event)"
                (focus)="onFocus()"
                [placeholder]="placeholder"
                class="form-input w-full"
                [id]="id"
                autocomplete="off">
            
            <div *ngIf="showSuggestions() && suggestions().length > 0" 
                class="absolute z-[100] w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl max-h-60 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <ul class="py-1">
                    <li *ngFor="let suggestion of suggestions()" 
                        (click)="selectSuggestion(suggestion)"
                        class="px-4 py-2 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:bg-brand-500/20 cursor-pointer text-sm transition-colors border-b border-neutral-50 dark:border-white/5 last:border-0">
                        <span class="mr-2">📍</span>{{ suggestion }}
                    </li>
                </ul>
            </div>
        </div>
    `,
    styles: [`
        :host { display: block; width: 100%; }
        /* Custom scrollbar for suggestions */
        .overflow-y-auto::-webkit-scrollbar { width: 4px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
        .overflow-y-auto::-webkit-scrollbar-thumb { 
            background: rgba(0,0,0,0.1); 
            border-radius: 2px;
        }
        .dark .overflow-y-auto::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
    `]
})
export class AppPlaceInput {
    private placeService = inject(PlaceService);
    private authService = inject(AuthService);

    @Input() value: string = '';
    @Input() placeholder: string = 'Ort suchen oder eingeben...';
    @Input() id: string = 'place-input-' + Math.random().toString(36).substring(2, 9);
    @Output() valueChange = new EventEmitter<string>();

    @ViewChild('container') container?: ElementRef;

    suggestions = signal<string[]>([]);
    showSuggestions = signal(false);

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        if (this.container && !this.container.nativeElement.contains(event.target)) {
            this.showSuggestions.set(false);
        }
    }

    onInput(query: string) {
        this.valueChange.emit(query);
        
        if (!query || query.length < 2) {
            this.suggestions.set([]);
            this.showSuggestions.set(false);
            return;
        }

        const treeName = this.authService.currentTree()?.name;
        if (!treeName) return;

        this.placeService.searchPlaces(treeName, query).subscribe(res => {
            // Handle different response formats (data.results or direct array)
            const results = res.results || (Array.isArray(res) ? res : []);
            this.suggestions.set(results);
            this.showSuggestions.set(results.length > 0);
        });
    }

    onFocus() {
        if (this.value && this.value.length >= 2 && this.suggestions().length > 0) {
            this.showSuggestions.set(true);
        }
    }

    selectSuggestion(suggestion: string) {
        this.value = suggestion;
        this.valueChange.emit(suggestion);
        this.showSuggestions.set(false);
    }
}
