import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';

interface Cliente {
  id: number;
  identificacion: string;
  nombre: string;
  apellido: string;
  email?: string;
  direccion?: string;
  telefono?: string;
  estado: string;
}

interface ClientSearchOk {
  dataResponse: { idTx: string | null; response: string };
  data: {
    size: number;
    last: boolean;
    totalPages: number;
    page: number;          // 0-based
    sort?: string;         // ej: "nombre: ASC"
    items: Cliente[];
    totalElements: number;
  };
  message: string;
}

interface GenericOk {
  dataResponse?: { idTx?: string | null; response?: 'SUCCESS' | 'ERROR' };
  message?: string;
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cliente.html',
})
export class ClientesComponent implements OnInit {

  confirmOpen = signal(false);
  clientToDelete = signal<Cliente | null>(null);

  // Filtros (server-side)
  searchName = '';
  searchDoc = '';

  // Estado UI
  loading = signal(false);
  error = signal<string | null>(null);

  // Datos
  clients = signal<Cliente[]>([]);
  total = signal(0);

  // Paginación (UI 1-based)
  page = signal(1);
  pageSize = signal(10);
  pageSizeOptions = [10, 20, 50];

  // Orden
  sortBy = signal<'id' | 'nombre'>('id');
  direction = signal<'ASC' | 'DESC'>('DESC');

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

  // Numeración de filas sobre lo que viene del server
  visibleWithRow = computed(() => {
    const startIdx = (this.page() - 1) * this.pageSize();
    return this.clients().map((c, i) => ({ ...c, rowNumber: startIdx + i + 1 }));
  });

  private apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.loadPage();
  }

  openConfirm(c: Cliente) {
    this.clientToDelete.set(c);
    this.confirmOpen.set(true);
  }

  closeConfirm() {
    if (!this.loading()) {             // evita cerrar mientras elimina
      this.confirmOpen.set(false);
      this.clientToDelete.set(null);
    }
  }

  async confirmDelete() {
    const c = this.clientToDelete();
    if (!c) return;
    await this.eliminarCliente(c);     // reutiliza tu método existente
    this.closeConfirm();
  }

  // Buscar en el servidor
  async onSearch() {
    this.page.set(1);
    await this.loadPage();
  }

  async clearFilters() {
    this.searchName = '';
    this.searchDoc = '';
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

  private async loadPage() {
    this.loading.set(true);
    this.error.set(null);

    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      // Construye 'q' (nombre y/o identificación)
      const qParts = [this.searchName.trim(), this.searchDoc.trim()].filter(Boolean);
      const q = qParts.join(' '); // el backend hará LIKE/contains case-insensitive

      const zeroBased = Math.max(0, this.page() - 1);
      let params = new HttpParams()
        .set('q', q)
        .set('page', String(zeroBased))
        .set('size', String(this.pageSize()))
        .set('sortBy', this.sortBy())
        .set('direction', this.direction());

      // 'q' es obligatorio para search; si está vacío puedes mandarlo vacío o no enviarlo
      if (q) params = params.set('q', q);

      const url = `${this.apiBase}/client/search`;

      const res = await firstValueFrom(
        this.http.get<ClientSearchOk>(url, { params }).pipe(timeout(12000))
      );

      const items = res?.data?.items ?? [];
      const total = res?.data?.totalElements ?? items.length;

      this.clients.set(items);
      this.total.set(total);

      // Si quedas fuera de rango por cambios de filtros/sort/size:
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
        this.error.set(apiMsgs || e?.error?.message || e?.message || 'Error al buscar clientes.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async eliminarCliente(c: Cliente) {
    //const ok = window.confirm(`¿Eliminar al cliente "${c.nombre} ${c.apellido ?? ''}" (ID ${c.id})?`);
    //if (!ok) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const url = `${this.apiBase}/client/delete/${c.id}`; // ⬅️ ruta nueva

      const res = await firstValueFrom(
        this.http.delete<ClientDeleteOk>(url).pipe(timeout(10000))
      );

      // Algunos backends responden 200 con response="ERROR"
      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res } as any;
      }

      // Ajuste optimista de paginación (si borraste el último de la página)
      const newTotal = Math.max(0, this.total() - 1);
      this.total.set(newTotal);

      const quedoVaciaEstaPagina = this.clients().length === 1 && this.page() > 1;
      if (quedoVaciaEstaPagina) {
        this.page.set(this.page() - 1);
      }

      // Recargar la página actual para reflejar cambios
      await this.loadPage();

      // (Opcional) flash / toast de éxito
      // const flash = res?.data?.message ?? 'Cliente eliminado correctamente.';
      // this.success.set(flash); // si tienes un signal de éxito

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La eliminación tardó demasiado. Intenta de nuevo.');
      } else {
        const be = (e?.error ?? e) as ClientDeleteError;
        const apiMsgs = be?.error?.map(x => x?.descError || x?.msgError)
          ?.filter(Boolean)?.join(' | ');
        this.error.set(
          apiMsgs || be?.message || e?.error?.message || e?.message || e?.descError || 'No se pudo eliminar el cliente.'
        );
      }
    } finally {
      this.loading.set(false);
    }
  }

  // Navegación (si usas vistas de detalle/edición)
  verCliente(c: Cliente) { this.router.navigate(['/clientes', c.id]); }
  editarCliente(c: Cliente) { this.router.navigate(['/clientes', c.id, 'editar']); }
}