import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes-component.html'
})
export class ReportesComponent {
  // ===== Claims
  private readonly _claims = signal<any | null>(null);
  empresaId = computed<number>(() => Number(this._claims()?.empresaId ?? 0));
  empresa = computed<string>(() => String(this._claims()?.empresa ?? '—'));

  // ===== UI
  from = signal<string>('');
  to = signal<string>('');

  loading = signal(false);
  error = signal<string | null>(null);
  info = signal<string | null>(null);

  private apiBase = '';

  constructor(private http: HttpClient, private cfg: ConfigService, private auth: AuthService) {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());
    // defaults: mes actual
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    this.from.set(`${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`);
    this.to.set(`${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`);
  }

  canDownload = computed(() => !!this.from() && !!this.to() && !this.loading() && this.empresaId() > 0);

  private validate(): string | null {
    if (!this.from() || !this.to()) return 'Selecciona fecha inicio y fecha fin.';
    if (!this.empresaId()) return 'No se pudo determinar la empresa del usuario.';
    if (this.from() > this.to()) return 'La fecha inicio no puede ser mayor a la fecha fin.';
    return null;
  }

  async downloadExcel() {
    const v = this.validate();
    if (v) { this.error.set(v); return; }

    this.loading.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const params = new HttpParams()
        .set('from', this.from())
        .set('to', this.to())
        .set('empresaId', String(this.empresaId()));

      // GET excel como blob
      const url = `${this.apiBase}/job/report/excel`;
      const blob = await this.http.get(url, { params, responseType: 'blob' as const }).toPromise();

      if (!blob || blob.size === 0) throw new Error('El reporte no devolvió contenido.');

      // Descargar
      const fname = `reporte_trabajos_${this.from()}_a_${this.to()}.xlsx`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fname;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);

      this.info.set('✅ Reporte generado.');
      setTimeout(() => this.info.set(null), 2000);

    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'No fue posible generar el reporte.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
