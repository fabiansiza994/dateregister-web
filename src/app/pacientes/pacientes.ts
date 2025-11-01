import { Component, OnInit, signal, computed, AfterViewInit, HostListener, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';

@Component({
  selector: 'app-pacientes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './pacientes.html',
  styleUrls: ['./pacientes.css']
})
export class Pacientes implements OnInit, AfterViewInit, OnDestroy {
  // Filtro de búsqueda: backend usa siempre `q` (aunque esté vacío)
  q = '';

  // Estado UI
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  // Datos
  pacientes = signal<Paciente[]>([]);
  total = signal(0);

  // Paginación (UI 1-based)
  page = signal(1);
  pageSize = signal(10);
  pageSizes = [10, 20, 50];

  // Orden
  sortBy = signal<'id' | 'nombre'>('nombre');
  direction = signal<'ASC' | 'DESC'>('ASC');

  // UI: menús de ordenamiento (desktop/móvil)
  sortMenuOpenDesktop = signal(false);
  sortMenuOpenMobile = signal(false);

  // Derivados
  totalPages = computed(() => {
    const t = this.total();
    const s = this.pageSize();
    return Math.max(1, Math.ceil(t / Math.max(1, s)));
  });

  firstItemIndex = computed(() => {
    const t = this.total();
    if (t === 0) return 0;
    return (this.page() - 1) * this.pageSize() + 1;
  });
  lastItemIndex = computed(() => Math.min(this.total(), this.page() * this.pageSize()));

  // Para numerar filas visibles
  visibleWithRow = computed(() => {
    const startIdx = (this.page() - 1) * this.pageSize();
    return this.pacientes().map((p, i) => ({ ...p, rowNumber: startIdx + i + 1 }));
  });

  // Ventana de páginas (UI)
  pagesToShow = computed(() => {
    const max = 5;
    const tp = this.totalPages();
    const cur = this.page();
    const half = Math.floor(max / 2);
    let start = Math.max(1, cur - half);
    let end = Math.min(tp, start + max - 1);
    start = Math.max(1, Math.min(start, end - max + 1));
    const arr: number[] = [];
    for (let n = start; n <= end; n++) arr.push(n);
    return arr;
  });

  // Modal confirmación (eliminar)
  confirmOpen = signal(false);
  pacienteToDelete = signal<Paciente | null>(null);
  // FAB crear paciente en móvil
  showCreateFab = signal(false);
  @ViewChild('createAnchor') createAnchor?: ElementRef<HTMLElement>;

  private apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Body class para ajustar estilos globales en móvil (sin sombra ni padding superior)
    try { document?.body?.classList?.add('page-pacientes'); } catch {}
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.loadPage();
  }
  ngAfterViewInit(): void { setTimeout(() => this.updateCreateFab(), 0); }
  ngOnDestroy(): void { try { document?.body?.classList?.remove('page-pacientes'); } catch {} }
  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange() { this.updateCreateFab(); }
  private updateCreateFab() {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) { this.showCreateFab.set(false); return; }
    const el = this.createAnchor?.nativeElement;
    if (!el) { this.showCreateFab.set(false); return; }
    const r = el.getBoundingClientRect();
    this.showCreateFab.set(r.bottom < 0);
  }

  // Buscar
  onSearch() {
    this.page.set(1);
    this.loadPage();
  }
  clearFilters() {
    this.q = '';
    this.onSearch();
  }

  // Paginación
  async goToPage(n: number) {
    const tp = this.totalPages();
    if (n < 1 || n > tp) return;
    this.page.set(n);
    await this.loadPage();
  }
  async prevPage() { await this.goToPage(this.page() - 1); }
  async nextPage() { await this.goToPage(this.page() + 1); }
  async changePageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    await this.loadPage();
  }

  // Orden
  async changeSort(field: 'id' | 'nombre') {
    if (this.sortBy() === field) {
      this.direction.set(this.direction() === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortBy.set(field);
      this.direction.set('ASC');
    }
    this.page.set(1);
    await this.loadPage();
  }

  // Elegir campo desde menú y cerrar menús de sort
  async chooseSort(field: 'id' | 'nombre') {
    await this.changeSort(field);
    this.sortMenuOpenDesktop.set(false);
    this.sortMenuOpenMobile.set(false);
  }

  // Cargar página desde API
  private async loadPage() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const zeroBased = Math.max(0, this.page() - 1);
      const params = new HttpParams()
        .set('q', this.q) // siempre enviar q (aunque sea '')
        .set('page', String(zeroBased))
        .set('size', String(this.pageSize()))
        .set('sortBy', this.sortBy())
        .set('direction', this.direction());

      const url = `${this.apiBase}/paciente/search`;

      const res = await firstValueFrom(
        this.http.get<PacienteSearchOk>(url, { params }).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res } as any;
      }

      const items = res?.data?.items ?? [];
      const total = res?.data?.totalElements ?? items.length;

      this.pacientes.set(items);
      this.total.set(total);

      // si la página queda fuera de rango
      if (items.length === 0 && total > 0 && this.page() > this.totalPages()) {
        this.page.set(this.totalPages());
        await this.loadPage();
      }

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
      } else {
        const apiMsgs = e?.error?.error
          ?.map((x: any) => x?.msgError || x?.descError)
          ?.filter(Boolean)?.join(' | ');
        this.error.set(apiMsgs || e?.error?.message || e?.message || 'Error al cargar pacientes.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  // Acciones
  verPaciente(p: Paciente) {  this.router.navigate(['/pacientes', p.id])  }
  editarPaciente(p: Paciente) {  this.router.navigate(['/pacientes', p.id, 'editar'])  }

  // Modal eliminar
  openConfirm(p: Paciente) {
    this.pacienteToDelete.set(p);
    this.confirmOpen.set(true);
  }
  closeConfirm() {
    if (!this.loading()) {
      this.confirmOpen.set(false);
      this.pacienteToDelete.set(null);
    }
  }

  async confirmDelete() {
    const p = this.pacienteToDelete();
    if (!p) return;
    await this.eliminarPaciente(p);
    this.closeConfirm();
  }

  // === NUEVO: eliminar con endpoint real ===
  private async eliminarPaciente(p: Paciente) {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const url = `${this.apiBase}/paciente/delete/${p.id}`;

      const res = await firstValueFrom(
        this.http.delete<PacienteDeleteOk>(url).pipe(timeout(10000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res } as any;
      }

      // Ajuste optimista de total (como en Clientes)
      const newTotal = Math.max(0, this.total() - 1);
      this.total.set(newTotal);

      // Si borraste el último de la página y no es la primera, retrocede una página
      const quedoVaciaEstaPagina = this.pacientes().length === 1 && this.page() > 1;
      if (quedoVaciaEstaPagina) {
        this.page.set(this.page() - 1);
      }

      // Recarga para mantener orden y paginación correctos
      await this.loadPage();

      // Mensaje de éxito (si viene desde BE úsalo)
      this.success.set(res?.data?.message || 'Paciente eliminado correctamente.');

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La eliminación tardó demasiado. Intenta de nuevo.');
      } else {
        const be = (e?.error ?? e) as PacienteDeleteError;
        const apiMsgs = be?.error?.map(x => x?.descError)
          ?.filter(Boolean)?.join(' | ');
        this.error.set(
          apiMsgs || be?.message || e?.error?.message || e?.message || 'No se pudo eliminar el paciente.'
        );
      }
    } finally {
      this.loading.set(false);
    }
  }

  // Chispas en clicks (crear/confirmar)
  sparkClick(ev: MouseEvent, color: string = '#0d6efd') {
    const target = ev.currentTarget as HTMLElement | null;
    const container = document.querySelector('.dr-sparks-container') as HTMLElement | null;
    if (!target || !container) return;
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    this.spawnSparks(x, y, color, container);
  }
  private spawnSparks(x: number, y: number, color: string, container: HTMLElement) {
    const COUNT = 12;
    for (let i = 0; i < COUNT; i++) {
      const s = document.createElement('span');
      s.className = 'dr-spark';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.background = color;
      s.style.setProperty('--dr-angle', (Math.random() * 360).toFixed(2) + 'deg');
      s.style.setProperty('--dr-dist', (22 + Math.random() * 28).toFixed(0) + 'px');
      s.style.setProperty('--dr-duration', (350 + Math.random() * 250).toFixed(0) + 'ms');
      container.appendChild(s);
      setTimeout(() => s.remove(), 650);
    }
  }
}