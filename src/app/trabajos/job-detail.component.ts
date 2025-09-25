import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

interface FormaPago { id: number; formaPago: string; estado?: number; }
interface ClienteMin { id: number; nombre: string; apellido?: string | null; }
interface UsuarioMin {
  id: number;
  usuario?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
}
interface PacienteMin {
  id: number;
  nombre: string;
  apellido?: string | null;
  documento?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  clienteId?: number | null;
  estado?: string | null;
}

interface TrabajoDetail {
  id: number;
  fecha: string;               // "YYYY-MM-DD"
  valorTotal: number;
  descripcionLabor: string;
  cliente: ClienteMin | null;
  formaPago: FormaPago | null;
  usuario?: UsuarioMin | null;
  paciente?: PacienteMin | null;
  valorLabor?: number | null;
  valorMateriales?: number | null;
  ganancias?: number | null;
  foto1?: string | null;
  foto2?: string | null;
  foto3?: string | null;
  foto4?: string | null;
  estado?: 'PENDIENTE' | 'PAGO' | 'CANCELADO' | string;
}

interface JobDetailOk {
  dataResponse: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: TrabajoDetail;
  message?: string;
  error?: Array<{ descError?: string; msgError?: string }>;
}

@Component({
  selector: 'app-trabajo-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trabajo-detalle.html',
})
export class JobDetailComponent implements OnInit {

  // ===== Claims / sector
  private readonly _claims = signal<any | null>(null);
  sector = computed(() => (this._claims()?.sector ?? '').toUpperCase());

  // ===== UI
  loading = signal(true);
  error = signal<string | null>(null);

  // ===== Data
  job = signal<TrabajoDetail | null>(null);

  // ===== Derived
  id = signal<number | null>(null);

  private apiBase = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router,
    private auth: AuthService
  ) {
    this._claims.set(this.auth.claims());
  }

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
    if (!id) {
      this.error.set('ID inválido.');
      this.loading.set(false);
      return;
    }
    this.id.set(id);
    this.loadDetail(id);
  }

  estadoBadge(estado?: string) {
  const s = (estado || '').toUpperCase();
  if (s === 'PAGO') return 'badge bg-success-subtle text-dark';
  if (s === 'CANCELADO') return 'badge bg-danger-subtle';
  // default / PENDIENTE
  return 'badge bg-warning-subtle text-dark';
}


  async loadDetail(id: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      // Ajusta si tu backend usa otra ruta (p. ej. /job/get/{id})
      const url = `${this.apiBase}/job/detail/${id}`;
      const res = await firstValueFrom(
        this.http.get<JobDetailOk>(url).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.descError || x?.msgError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No se pudo cargar el trabajo.');
      }

      const data = res?.data;
      if (!data) throw new Error('Respuesta sin datos.');

      this.job.set(data);

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.message || e?.message || 'Error al cargar el trabajo.');
    } finally {
      this.loading.set(false);
    }
  }

  // ========= Helpers UI =========
  formatMoney(n: number | null | undefined) {
    if (n == null) return '—';
    try {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    } catch { return `$${n}`; }
  }

  // Si tu BE no devuelve ganancias/total desglosado:
  totalCalc(j: TrabajoDetail | null) {
    if (!j) return 0;
    // preferir el valor ya calculado si viene:
    if (typeof j.valorTotal === 'number') return j.valorTotal;
    const mano = Number(j.valorLabor ?? 0);
    const mat  = Number(j.valorMateriales ?? 0);
    return mano + mat;
  }

  gananciasCalc(j: TrabajoDetail | null) {
    if (!j) return 0;
    if (typeof j.ganancias === 'number') return j.ganancias!;
    const total = this.totalCalc(j);
    const mat   = Number(j.valorMateriales ?? 0);
    return total - mat;
  }

  backToList() { this.router.navigate(['/trabajos']); }
  goToEdit()   { const id = this.id(); if (id) this.router.navigate(['/trabajos', id, 'editar']); }
}