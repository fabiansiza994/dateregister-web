import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';

interface ApiErrItem { codError?: string; descError?: string; msgError?: string; }
interface ApiResponseOk<T = any> {
  dataResponse?: { idTx?: string | null; response?: 'SUCCESS' | 'ERROR' };
  data?: T;
  error?: ApiErrItem[];
  message?: string;
}

@Component({
  selector: 'app-verifycode',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verifycode.html',
  styleUrls: ['./verifycode.css']
})
export class VerifyCodeComponent implements OnInit {
  // params
  userId: number | null = null;

  // form
  code = '';

  // ui
  loading = signal(false);
  error   = signal<string | null>(null);
  info    = signal<string | null>(null);

  // resend cooldown (seconds)
  resendCooldown = signal(0);
  resendLoading = signal(false);
  private resendTimer: any = null;

  private apiBase = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    const p = this.route.snapshot.paramMap.get('userId');
    this.userId = p ? Number(p) : null;
    if (!this.userId) {
      this.error.set('Falta el parámetro "userId" en la URL.');
    }
    // Start initial cooldown so user can't spam resend right away
    this.startResendCooldown(60);
  }

  ngOnDestroy(): void {
    this.clearResendTimer();
  }

  private clearResendTimer() {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }

  private startResendCooldown(seconds = 60) {
    this.clearResendTimer();
    this.resendCooldown.set(seconds);
    this.resendTimer = setInterval(() => {
      const s = this.resendCooldown() - 1;
      if (s <= 0) {
        this.resendCooldown.set(0);
        this.clearResendTimer();
      } else {
        this.resendCooldown.set(s);
      }
    }, 1000);
  }

  formatCountdown(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  canSubmit() {
    return !!this.userId && !!this.code.trim() && !this.loading();
  }

  // Mapea cualquier forma de error del backend a string legible
  private mapError(e: any): string {
    // 1) Respuesta 200 con response="ERROR"
    if (e?.dataResponse?.response === 'ERROR' && Array.isArray(e?.error)) {
      const msg = e.error.map((x: ApiErrItem) => x?.descError || x?.msgError).filter(Boolean).join(' | ');
      return msg || e?.message || 'La verificación fue rechazada.';
    }
    // 2) HTTP error con body que tiene la misma forma
    const body = e?.error ?? e;
    if (body?.dataResponse?.response === 'ERROR' && Array.isArray(body?.error)) {
      const msg = body.error.map((x: ApiErrItem) => x?.descError || x?.msgError).filter(Boolean).join(' | ');
      return msg || body?.message || 'No fue posible verificar el código.';
    }
    // 3) fallback
    return e?.message || e?.error?.message || 'No fue posible verificar el código.';
  }

  async verify() {
    if (!this.canSubmit()) return;

    this.loading.set(true);
    this.error.set(null);
    this.info.set(null);

    try {
      const url = `${this.apiBase}/code/${this.userId}/${this.code.trim()}`;
      const res = await firstValueFrom(
        this.http.get<ApiResponseOk>(url).pipe(timeout(10000))
      );

      // Si el backend usa SUCCESS/ERROR dentro de 200:
      if (res?.dataResponse?.response === 'ERROR') {
        throw res; // lo captura mapError
      }

      // Éxito
      this.info.set('✅ Código verificado. Tu cuenta ha sido activada.');
      // Redirige al login tras un breve delay
      setTimeout(() => this.router.navigate(['/login']), 1200);

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La verificación tardó demasiado. Intenta de nuevo.');
      } else {
        this.error.set(this.mapError(e));
      }
    } finally {
      this.loading.set(false);
    }
  }

  async resendCode() {
    if (!this.userId) {
      this.error.set('Falta el parámetro "userId" para reenviar el código.');
      return;
    }
    if (this.resendLoading() || this.resendCooldown() > 0) return;

    this.resendLoading.set(true);
    this.error.set(null);
    this.info.set(null);

    try {
      const url = this.apiBase
        ? `${this.apiBase}/code/resend/${this.userId}`
        : `http://localhost:8081/code/resend/${this.userId}`;
      const res = await firstValueFrom(
        this.http.get<ApiResponseOk>(url).pipe(timeout(10000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw res;
      }

      this.info.set('Se ha reenviado el código. Revisa tu correo.');
      // start cooldown again
      this.startResendCooldown(60);

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La petición para reenviar tardó demasiado. Intenta de nuevo.');
      } else {
        this.error.set(this.mapError(e));
      }
    } finally {
      this.resendLoading.set(false);
    }
  }
}
