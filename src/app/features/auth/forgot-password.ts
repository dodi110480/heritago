import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
        <div class="modal-container">
            <div class="modal-glass max-w-[440px]">
                <div class="modal-glow-brand"></div>
                <div class="modal-glow-highlight"></div>
                <div class="relative z-10">
                    <div class="text-center mb-10">
                        <h1 class="text-4xl font-black tracking-tighter mb-2 text-canvas-white">Passwort vergessen</h1>
                        <p class="text-neutral-400 font-medium">Wir senden dir einen Link zum Zurücksetzen.</p>
                    </div>

                    <form *ngIf="!submitted()" (submit)="onSubmit()" class="flex flex-col gap-2">
                        <div class="form-group">
                            <label class="form-label" for="email">Email Adresse</label>
                            <input type="email" id="email" name="email" [(ngModel)]="email" required email class="form-input" placeholder="dein@name.de" autocomplete="email">
                        </div>
                        <div *ngIf="error()" class="form-error">{{ error() }}</div>
                        <button type="submit" [disabled]="loading()" class="btn-primary py-4! text-lg disabled:opacity-50">
                            <span *ngIf="!loading()">Link senden</span>
                            <span *ngIf="loading()" class="w-6 h-6 border-2 border-canvas-white/20 border-l-white rounded-full animate-spin"></span>
                        </button>
                    </form>

                    <div *ngIf="submitted()" class="p-5 rounded-2xl bg-accent-success-500/10 border border-accent-success-500/20 text-center">
                        <p class="text-sm text-neutral-300">Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen gesendet.</p>
                    </div>

                    <div class="mt-8 text-center">
                        <a routerLink="/login" class="text-brand-400 font-bold hover:underline">Zurück zum Login</a>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class ForgotPassword {
    private authService = inject(AuthService);

    email = '';
    loading = signal(false);
    submitted = signal(false);
    error = signal<string | null>(null);

    onSubmit() {
        if (!this.email) return;
        this.loading.set(true);
        this.error.set(null);
        this.authService.forgotPassword(this.email).subscribe(res => {
            this.loading.set(false);
            if (res.success) {
                this.submitted.set(true);
            } else {
                this.error.set(res.message || 'Anfrage fehlgeschlagen.');
            }
        });
    }
}
