import { Component, OnInit, signal } from '@angular/core';
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
  templateUrl: './verifycode.html'
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
}
