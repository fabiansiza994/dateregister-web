import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ConfigService } from '../core/config.service';

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPasswordComponent {
  email = signal<string>('');
  loading = signal(false);
  info = signal<string | null>(null);
  error = signal<string | null>(null);
  cooldownLeft = signal<number>(0); // segundos restantes para reintentar

  private cooldownTimer: any = null;

  private apiBase = '';

  constructor(private http: HttpClient, private cfg: ConfigService, private router: Router) {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    try { document.body.classList.add('page-login'); } catch {}
  }

  ngOnDestroy() { try { document.body.classList.remove('page-login'); } catch {} }

  get isValidEmail(): boolean {
    const e = this.email().trim();
    return /.+@.+\..+/.test(e);
  }

  async submit() {
    this.error.set(null); this.info.set(null);
    if (!this.isValidEmail) { this.error.set('Ingresa un correo válido'); return; }
    if (this.cooldownLeft() > 0) return; // evita reintentos durante cooldown
    this.loading.set(true);
    try {
  // Usar encodeURI para no convertir '@' a %40 en el path segment
  const url = `${this.apiBase}/code/recoverAccount/${encodeURI(this.email().trim())}`;
      await this.http.get(url).toPromise();
      this.info.set('Si el correo existe, se ha enviado un correo de recuperación.');
      this.startCooldown(60);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No fue posible solicitar la recuperación.');
    } finally {
      this.loading.set(false);
    }
  }

  goLogin() { this.router.navigate(['/login']); }

  private startCooldown(seconds: number) {
    this.clearCooldown();
    this.cooldownLeft.set(seconds);
    this.cooldownTimer = setInterval(() => {
      const left = this.cooldownLeft() - 1;
      this.cooldownLeft.set(left);
      if (left <= 0) this.clearCooldown();
    }, 1000);
  }

  private clearCooldown() {
    if (this.cooldownTimer) {
      try { clearInterval(this.cooldownTimer); } catch {}
      this.cooldownTimer = null;
    }
    if (this.cooldownLeft() < 0) this.cooldownLeft.set(0);
  }
}
