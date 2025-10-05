import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

interface ApiErrorItem {
  codError?: string;
  descError?: string;  // mensaje humano
  msgError?: string;   // nombre del campo
}

interface UsuarioLite {
  id: number;
  usuario: string;
  nombre: string;
  apellido?: string | null;
  email?: string | null;
  estado?: string | null;   // si tu backend lo expone
  rolNombre?: { id: number; nombre: string } | null;
  grupoNombre?: { id: number; nombre: string } | null;
}

interface UserSearchOk {
  dataResponse: { response: 'SUCCESS' | 'ERROR' };
  data: {
    items: UsuarioLite[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    last: boolean;
    sort: string;
    query?: string;
  };
  message?: string;
}

interface UserDeleteOk {
  dataResponse: { response: 'SUCCESS' | 'ERROR' };
  data?: { deletedId?: number; message?: string };
  message?: string;
}
interface UserDeleteError {
  dataResponse?: { response?: 'ERROR' | 'SUCCESS' };
  error?: ApiErrorItem[];
  message?: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './usuarios.html',
})
export class UsuariosComponent implements OnInit {

  private _claims = signal<any | null>(null);
  currentUsername = computed(() => (this._claims()?.sub ?? '').toString().toLowerCase().trim());
  // Filtro: backend exige q, aunque esté vacío
  q = '';

  // Estado UI
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  // Datos
  usuarios = signal<UsuarioLite[]>([]);
  total = signal(0);

  // Paginación (UI 1-based)
  page = signal(1);
  pageSize = signal(10);
  pageSizes = [10, 20, 50];

  // Orden
  sortBy = signal<'id' | 'usuario' | 'nombre'>('id');
  direction = signal<'ASC' | 'DESC'>('DESC');

  // Derivados
  totalPages = computed(() => {
    const t = this.total();
    const s = Math.max(1, this.pageSize());
    return Math.max(1, Math.ceil(t / s));
  });
  firstItemIndex = computed(() => this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1);
  lastItemIndex = computed(() => Math.min(this.total(), this.page() * this.pageSize()));

  // Para numerar filas visibles
  visibleWithRow = computed(() => {
    const startIdx = (this.page() - 1) * this.pageSize();
    return this.usuarios().map((u, i) => ({ ...u, rowNumber: startIdx + i + 1 }));
  });

  // Ventana de páginas
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

  // Modal eliminar
  confirmOpen = signal(false);
  userToDelete = signal<UsuarioLite | null>(null);

  private apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router,
    private auth: AuthService,
  ) { }

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.auth.refreshFromStorage?.();
    this._claims.set(this.auth.claims());
    this.loadPage();
  }

  // + NUEVO: ¿es el propio usuario?
  isSelf(u: UsuarioLite): boolean {
    const me = this.currentUsername();
    return !!me && u.usuario?.toLowerCase().trim() === me;
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
    if (n < 1 || n > this.totalPages()) return;
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
  async changeSort(field: 'id' | 'usuario' | 'nombre') {
    if (this.sortBy() === field) {
      this.direction.set(this.direction() === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortBy.set(field);
      this.direction.set('ASC');
    }
    this.page.set(1);
    await this.loadPage();
  }

  // Cargar página
  private async loadPage() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const zeroBased = Math.max(0, this.page() - 1);
      const params = new HttpParams()
        .set('q', this.q) // q siempre
        .set('page', String(zeroBased))
        .set('size', String(this.pageSize()))
        .set('sortBy', this.sortBy())
        .set('direction', this.direction());

      const url = `${this.apiBase}/user/search`;
      const res = await firstValueFrom(
        this.http.get<UserSearchOk>(url, { params }).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res } as any;
      }

      const items = res?.data?.items ?? [];
      const total = res?.data?.totalElements ?? items.length;

      this.usuarios.set(items);
      this.total.set(total);

      // si quedaste fuera de rango
      if (items.length === 0 && total > 0 && this.page() > this.totalPages()) {
        this.page.set(this.totalPages());
        await this.loadPage();
      }

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
      } else {
        const apiMsgs = e?.error?.error?.map((x: any) => x?.msgError || x?.descError)?.filter(Boolean)?.join(' | ');
        this.error.set(apiMsgs || e?.error?.message || e?.message || 'Error al cargar usuarios.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  // Acciones
  verUsuario(u: UsuarioLite) { /* this.router.navigate(['/usuarios', u.id]) */ }
  editarUsuario(u: UsuarioLite) { /* this.router.navigate(['/usuarios', u.id, 'editar']) */ }

  // Modal
  openConfirm(u: UsuarioLite) {
    if (this.isSelf(u)) return;
    this.userToDelete.set(u);
    this.confirmOpen.set(true);
  }
  closeConfirm() {
    if (!this.loading()) {
      this.confirmOpen.set(false);
      this.userToDelete.set(null);
    }
  }
  async confirmDelete() {
    const u = this.userToDelete();
    if (!u) return;
    await this.eliminarUsuario(u);
    this.closeConfirm();
  }

  private async eliminarUsuario(u: UsuarioLite) {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const url = `${this.apiBase}/user/delete/${u.id}`;
      const res = await firstValueFrom(
        this.http.delete<UserDeleteOk>(url).pipe(timeout(10000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res } as any;
      }

      // recarga manteniendo paginación
      await this.loadPage();
      this.success.set(res?.data?.message || 'Usuario eliminado correctamente.');

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La eliminación tardó demasiado. Intenta de nuevo.');
      } else {
        const be = (e?.error ?? e) as UserDeleteError;
        const apiMsgs = be?.error?.map(x => x?.msgError || x?.descError)?.filter(Boolean)?.join(' | ');
        this.error.set(apiMsgs || be?.message || e?.error?.message || e?.message || 'No se pudo eliminar el usuario.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
