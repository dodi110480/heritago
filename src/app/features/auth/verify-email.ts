import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-verify-email',
    standalone: true,
    imports: [CommonModule, RouterModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
        <div class="modal-container">
            <div class="modal-glass max-w-[440px]">
                <div class="modal-glow-brand"></div>
                <div class="modal-glow-highlight"></div>
                <div class="relative z-10 text-center">
                    <div class="text-center mb-10">
                        <div class="inline-flex p-4 rounded-3xl bg-brand-500/10 text-brand-400 mb-6 border border-brand-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <h1 class="text-4xl font-black tracking-tighter mb-2 text-canvas-white">E-Mail verifizieren</h1>
                        <p class="text-neutral-400 font-medium">Bestätige deine E-Mail-Adresse</p>
                    </div>

                    <div *ngIf="loading()" class="py-10 flex justify-center">
                        <div class="w-8 h-8 border-4 border-brand-500/20 border-l-brand-500 rounded-full animate-spin"></div>
                    </div>

                    <div *ngIf="!loading() && success()" class="p-5 rounded-2xl bg-accent-success-500/10 border border-accent-success-500/20">
                        <p class="font-bold text-accent-success-400 mb-2">E-Mail erfolgreich verifiziert!</p>
                        <p class="text-sm text-neutral-300 mb-4">Du kannst dich jetzt anmelden.</p>
                        <a routerLink="/login" class="inline-block text-brand-400 font-bold hover:underline">Zum Login</a>
                    </div>

                    <div *ngIf="!loading() && error()" class="p-5 rounded-2xl bg-accent-danger-500/10 border border-accent-danger-500/20">
                        <p class="font-bold text-accent-danger-400 mb-2">Verifizierung fehlgeschlagen</p>
                        <p class="text-sm text-neutral-300">{{ error() }}</p>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class VerifyEmail implements OnInit {
    private authService = inject(AuthService);
    private route = inject(ActivatedRoute);

    loading = signal(true);
    success = signal(false);
    error = signal<string | null>(null);

    ngOnInit() {
        const token = this.route.snapshot.queryParamMap.get('token');
        if (!token) {
            this.loading.set(false);
            this.error.set('Kein Token vorhanden.');
            return;
        }
        this.authService.verifyEmail(token).subscribe(res => {
            this.loading.set(false);
            if (res.success) {
                this.success.set(true);
            } else {
                this.error.set(res.message || 'Verifizierung fehlgeschlagen.');
            }
        });
    }
}
