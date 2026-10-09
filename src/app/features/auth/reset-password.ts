import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
        <div class="modal-container bg-neutral-400">
            <div class="modal-glass max-w-[440px]">
                <div class="modal-glow-brand"></div>
                <div class="modal-glow-highlight"></div>
                <div class="relative z-10">
                    <div class="text-center mb-10">
                        <h1 class="text-4xl font-black tracking-tighter mb-2 text-canvas-white">Passwort zurücksetzen</h1>
                        <p class="text-neutral-400 font-medium">Wähle ein neues Passwort.</p>
                    </div>

                    <form *ngIf="!success()" (submit)="onSubmit()" class="flex flex-col gap-2">
                        <div class="form-group">
                            <label class="form-label" for="password">Neues Passwort</label>
                            <input type="password" id="password" name="password" [(ngModel)]="password" required class="form-input" placeholder="••••••••" autocomplete="new-password">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="confirmPassword">Passwort bestätigen</label>
                            <input type="password" id="confirmPassword" name="confirmPassword" [(ngModel)]="confirmPassword" required class="form-input" placeholder="••••••••" autocomplete="new-password">
                        </div>
                        <div *ngIf="error()" class="form-error">{{ error() }}</div>
                        <button type="submit" [disabled]="loading()" class="btn-primary py-4! text-lg disabled:opacity-50">
                            <span *ngIf="!loading()">Passwort speichern</span>
                            <span *ngIf="loading()" class="w-6 h-6 border-2 border-canvas-white/20 border-l-white rounded-full animate-spin"></span>
                        </button>
                    </form>

                    <div *ngIf="success()" class="p-5 rounded-2xl bg-accent-success-500/10 border border-accent-success-500/20 text-center">
                        <p class="font-bold text-accent-success-400 mb-2">Passwort geändert!</p>
                        <a routerLink="/login" class="inline-block text-brand-400 font-bold hover:underline">Zum Login</a>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class ResetPassword implements OnInit {
    private authService = inject(AuthService);
    private route = inject(ActivatedRoute);

    token = '';
    password = '';
    confirmPassword = '';
    loading = signal(false);
    success = signal(false);
    error = signal<string | null>(null);

    ngOnInit() {
        this.token = this.route.snapshot.queryParamMap.get('token') || '';
        if (!this.token) {
            this.error.set('Kein Token vorhanden.');
        }
    }

    onSubmit() {
        if (!this.token || !this.password) {
            this.error.set('Passwort erforderlich.');
            return;
        }
        if (this.password !== this.confirmPassword) {
            this.error.set('Die Passwörter stimmen nicht überein.');
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        this.authService.resetPassword(this.token, this.password).subscribe(res => {
            this.loading.set(false);
            if (res.success) {
                this.success.set(true);
            } else {
                this.error.set(res.message || 'Zurücksetzen fehlgeschlagen.');
            }
        });
    }
}
