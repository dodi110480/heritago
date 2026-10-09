import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Single entry of a context menu. Purely presentational: the caller decides
 * which entries exist and whether they are available (no business logic here).
 */
export interface ContextMenuItem {
    id: string;
    label: string;
    /** Optional semantic hint, e.g. the reason why an action is unavailable. */
    hint?: string;
    disabled?: boolean;
    /** Renders the entry in the danger colour (destructive actions). */
    danger?: boolean;
    /** Draws a separator above this entry to start a new group. */
    groupStart?: boolean;
}

/**
 * Generic right-click / overflow menu overlay.
 *
 * Rendered with `position: fixed` so it escapes overflow-hidden containers
 * (e.g. the family chart canvas) and clamped into the viewport.
 */
@Component({
    selector: 'app-context-menu',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    host: {
        '(document:keydown.escape)': 'onEscape()'
    },
    template: `
        @if (visible()) {
            <!-- Backdrop: closes the menu and swallows the click on the element below -->
            <div class="fixed inset-0 z-toast"
                 (click)="closed.emit()"
                 (contextmenu)="$event.preventDefault(); closed.emit()"></div>

            <div #menuEl
                 role="menu"
                 class="fixed z-toast min-w-60 max-w-76 max-h-[70vh] overflow-y-auto py-1.5
                        rounded-modal border border-glass-border dark:border-glass-border-dark
                        bg-glass-bg dark:bg-glass-bg-dark backdrop-blur-3xl shadow-modal
                        text-sm text-neutral-700 dark:text-neutral-200"
                 [style.left.px]="position().left"
                 [style.top.px]="position().top">

                @if (title()) {
                    <div class="px-3.5 pt-2 pb-2 border-b border-glass-border dark:border-glass-border-dark">
                        <p class="font-semibold text-neutral-900 dark:text-canvas-white truncate">{{ title() }}</p>
                        @if (subtitle()) {
                            <p class="text-xs text-neutral-500 truncate">{{ subtitle() }}</p>
                        }
                    </div>
                }

                @for (item of items(); track item.id) {
                    @if (item.groupStart) {
                        <div class="my-1.5 border-t border-glass-border dark:border-glass-border-dark"></div>
                    }
                    <button type="button"
                            role="menuitem"
                            class="w-full min-h-11 flex items-center gap-3 px-3.5 py-2 text-left transition-colors
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                            [ngClass]="item.danger
                                ? 'text-accent-danger-600 hover:bg-accent-danger-500/10'
                                : 'hover:bg-brand-500/10'"
                            [disabled]="item.disabled"
                            (click)="select(item)">
                        <span class="flex-1">
                            <span class="block">{{ item.label }}</span>
                            @if (item.hint) {
                                <span class="block text-xs text-neutral-500">{{ item.hint }}</span>
                            }
                        </span>
                    </button>
                }
            </div>
        }
    `
})
export class AppContextMenuComponent {
    visible = input<boolean>(false);
    x = input<number>(0);
    y = input<number>(0);
    items = input<ContextMenuItem[]>([]);
    title = input<string>('');
    subtitle = input<string>('');

    itemSelected = output<string>();
    closed = output<void>();

    private menuEl = viewChild<ElementRef<HTMLElement>>('menuEl');

    /** Clamped screen position of the menu. */
    readonly position = signal({ left: 0, top: 0 });

    constructor() {
        effect(() => {
            const isVisible = this.visible();
            const anchor = { left: this.x(), top: this.y() };
            const element = this.menuEl()?.nativeElement;
            if (!isVisible || !element) return;

            // Show at the cursor first, then pull the menu back into the viewport
            // once its real size is known (avoids a visible jump).
            this.position.set(anchor);

            setTimeout(() => {
                const rect = element.getBoundingClientRect();
                const margin = 8;
                this.position.set({
                    left: Math.max(margin, Math.min(anchor.left, window.innerWidth - rect.width - margin)),
                    top: Math.max(margin, Math.min(anchor.top, window.innerHeight - rect.height - margin))
                });
            });
        });
    }

    select(item: ContextMenuItem): void {
        if (item.disabled) return;
        this.itemSelected.emit(item.id);
        this.closed.emit();
    }

    onEscape(): void {
        if (this.visible()) {
            this.closed.emit();
        }
    }
}
