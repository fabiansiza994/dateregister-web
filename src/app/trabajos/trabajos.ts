import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

interface FormaPago { id: number; formaPago: string; estado: number; }
interface ClienteMin { id: number; nombre: string; apellido?: string | null; }
interface PacienteMin { id: number; nombre: string; apellido?: string | null; }
interface Trabajo {
  id: number;
  fecha: string;               // "YYYY-MM-DD"
  valorTotal: number;
  descripcionLabor: string;
  cliente: ClienteMin | null;
  formaPago: FormaPago | null;
  foto1?: string | null;
  paciente: PacienteMin | null;
  estado?: 'PENDIENTE' | 'PAGO' | 'CANCELADO' | string;
}

interface JobSearchOk {
  dataResponse: { idTx: string | null; response: 'SUCCESS' | 'ERROR' };
  data: {
    size: number; last: boolean; query: string;
    totalPages: number; page: number; sort: string;
    items: Trabajo[]; totalElements: number;
  };
  message: string;
}

@Component({
  selector: 'app-trabajos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './trabajos.html',
})
export class JobsComponent implements OnInit {

  private readonly _claims = signal<any | null>(null);
  sector = computed(() => (this._claims()?.sector ?? '').toUpperCase());

  estadoBadge(estado?: string) {
    const s = (estado || '').toUpperCase();
    if (s === 'PAGO') return 'badge bg-success-subtle text-dark';
    if (s === 'CANCELADO') return 'badge bg-danger-subtle';
    // default / PENDIENTE
    return 'badge bg-warning-subtle text-dark';
  }

  // Filtro
  q = '';

  // Estado UI
  loading = signal(false);
  error   = signal<string | null>(null);
  success = signal<string | null>(null);

  // Modal eliminar
  confirmOpen = signal(false);
  jobToDelete = signal<Trabajo | null>(null);
  deleting    = signal(false);

  // Datos
  jobs = signal<Trabajo[]>([]);
  total = signal(0);

  // Paginación
  page = signal(1);
  pageSize = signal(10);
  pageSizeOptions = [10, 20, 50];

  // Orden
  sortBy = signal<'id' | 'fecha' | 'valorTotal'>('id');
  direction = signal<'ASC' | 'DESC'>('DESC');

  // Derivados
  totalPages = computed(() => {
    const t = this.total(); const s = this.pageSize();
    return Math.max(1, Math.ceil(t / Math.max(1, s)));
  });
  firstItemIndex = computed(() => this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1);
  lastItemIndex  = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
  visibleWithRow = computed(() => {
    const startIdx = (this.page() - 1) * this.pageSize();
    return this.jobs().map((j, i) => ({ ...j, rowNumber: startIdx + i + 1 }));
  });

  private apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router,
    private auth: AuthService
  ) { this._claims.set(this.auth.claims()); }

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.loadPage();
  }

  // Helpers UI
  setPageSize(n: number) {
    this.pageSize.set(Number(n) || 10);
    this.page.set(1);
    this.loadPage();
  }
  toggleDirection() {
    this.direction.set(this.direction()==='ASC' ? 'DESC' : 'ASC');
    this.page.set(1);
    this.loadPage();
  }
  changeSort(field: 'id'|'fecha'|'valorTotal') {
    if (this.sortBy() === field) {
      this.direction.set(this.direction()==='ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortBy.set(field);
      this.direction.set('ASC');
    }
    this.page.set(1);
    this.loadPage();
  }

  async onSearch() {
    this.page.set(1);
    await this.loadPage();
  }
  async clearFilters() {
    this.q = '';
    this.page.set(1);
    await this.loadPage();
  }

  async goToPage(n: number) {
    const tp = this.totalPages();
    if (n < 1 || n > tp) return;
    this.page.set(n);
    await this.loadPage();
  }
  async prevPage() { await this.goToPage(this.page() - 1); }
  async nextPage() { await this.goToPage(this.page() + 1); }

  // Carga
  async loadPage() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const zeroBased = Math.max(0, this.page() - 1);
      let params = new HttpParams()
        .set('q', this.q.trim())
        .set('page', String(zeroBased))
        .set('size', String(this.pageSize()))
        .set('sortBy', this.sortBy())
        .set('direction', this.direction());

      const url = `${this.apiBase}/job/search`;
      const res = await firstValueFrom(
        this.http.get<JobSearchOk>(url, { params }).pipe(timeout(12000))
      );

      const items = res?.data?.items ?? [];
      const total = res?.data?.totalElements ?? items.length;

      this.jobs.set(items);
      this.total.set(total);

      // Si quedaste fuera de rango:
      if (items.length === 0 && total > 0 && this.page() > this.totalPages()) {
        this.page.set(this.totalPages());
        await this.loadPage();
      }

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
      } else {
        const apiMsgs = e?.error?.error?.map((x: any) => x?.descError || x?.msgError)
          ?.filter(Boolean)?.join(' | ');
        this.error.set(apiMsgs || e?.error?.message || e?.message || 'Error al buscar trabajos.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  // Navegación
  verTrabajo(j: Trabajo)   { this.router.navigate(['/trabajos', j.id]); }
  editarTrabajo(j: Trabajo){ this.router.navigate(['/trabajos', j.id, 'editar']); }

  // ===== Eliminar =====
  openConfirm(j: Trabajo) {
    this.jobToDelete.set(j);
    this.confirmOpen.set(true);
    this.error.set(null);
    this.success.set(null);
  }
  closeConfirm() {
    if (this.deleting()) return;
    this.confirmOpen.set(false);
    this.jobToDelete.set(null);
  }
  async confirmDelete() {
    const j = this.jobToDelete();
    if (!j) return;

    this.deleting.set(true);
    this.error.set(null);
    try {
      const url = `${this.apiBase}/job/delete/${j.id}`;
      await firstValueFrom(this.http.delete(url).pipe(timeout(12000)));

      // optimista: quitar de la lista
      this.jobs.update(list => list.filter(x => x.id !== j.id));
      this.total.update(t => Math.max(0, t - 1));

      // si se vació la página y hay previas, retroceder una
      if (this.visibleWithRow().length === 0 && this.page() > 1) {
        this.page.update(p => p - 1);
        await this.loadPage();
      }

      this.success.set('🗑️ Trabajo eliminado correctamente.');
    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La eliminación tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.descError || e?.descError || 'No se pudo eliminar el trabajo.');
    } finally {
      this.deleting.set(false);
      this.closeConfirm();
    }
  }

  // Formateo
  formatMoney(n: number | null | undefined) {
    if (n == null) return '—';
    try {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    } catch { return `$${n}`; }
  }
}
