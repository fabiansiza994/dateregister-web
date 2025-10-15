import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

interface ApiErrItem { codError?: string; descError?: string; msgError?: string; }

interface Grupo {
  id: number;
  nombre: string;
}

interface PagePayload<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  sort: string;
  query?: string;
}

interface ApiPageOk<T> {
  dataResponse?: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: PagePayload<T>;
  message?: string;
  error?: ApiErrItem[];
}

interface ApiDetailOk<T> {
  dataResponse?: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: T;
  message?: string;
  error?: ApiErrItem[];
}

interface CreateDto {
  nombre: string;
  empresaId: number;
}
interface UpdateDto {
  nombre: string;
}

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './grupos.html',
})
export class GruposComponent implements OnInit {

  private readonly _claims = signal<any | null>(null);
  empresaId = computed(() => Number(this._claims()?.empresaId ?? 0) || 0);

  loading = signal(false);
  error   = signal<string | null>(null);
  success = signal<string | null>(null);

  confirmOpen = signal(false);
  groupToDelete = signal<Grupo | null>(null);

  groups = signal<Grupo[]>([]);
  total  = signal(0);

  q = '';
  sortBy = signal<'id' | 'nombre'>('id');
  direction = signal<'ASC' | 'DESC'>('DESC');

  page = signal(1);
  pageSize = signal(10);
  pageSizeOptions = [10, 20, 50];

  totalPages = computed(() => {
    const t = this.total(); const s = this.pageSize();
    return Math.max(1, Math.ceil(t / Math.max(1, s)));
  });
  firstItemIndex = computed(() => this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1);
  lastItemIndex  = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
  visibleWithRow = computed(() => {
    const startIdx = (this.page() - 1) * this.pageSize();
    return this.groups().map((g, i) => ({ ...g, rowNumber: startIdx + i + 1 }));
  });

  creating = signal(false);
  newName  = signal('');
  canCreate = computed(() => !!this.newName().trim() && !this.creating());

  editingId = signal<number | null>(null);
  editName  = signal('');
  savingRowId = signal<number | null>(null);

  private apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private auth: AuthService
  ) {
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());
  }

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.loadPage();
  }

  // ================== Helper ==================
  private extractApiError(e: any): string {
    if (e?.error?.dataResponse?.response === 'ERROR') {
      const apiMsgs = e?.error?.error
        ?.map((x: ApiErrItem) => x?.descError || x?.msgError)
        ?.filter(Boolean)
        ?.join(' | ');
      if (apiMsgs) return apiMsgs;
    }
    if (Array.isArray(e?.error)) {
      const apiMsgs = e.error.map((x: ApiErrItem) => x?.descError || x?.msgError)
        .filter(Boolean).join(' | ');
      if (apiMsgs) return apiMsgs;
    }
    return e?.error?.message || e?.message || 'Ocurrió un error inesperado.';
  }

  // ================== Carga de página ==================
  async loadPage() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${this.apiBase}/group/list`;
      const zeroBased = Math.max(0, this.page() - 1);
      let params = new HttpParams()
        .set('page', String(zeroBased))
        .set('size', String(this.pageSize()))
        .set('sortBy', this.sortBy())
        .set('direction', this.direction());

      const res = await firstValueFrom(
        this.http.get<ApiPageOk<Grupo>>(url, { params }).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res };
      }

      const data = res?.data;
      const items = data?.items ?? [];
      const total = data?.totalElements ?? items.length;

      this.groups.set(items);
      this.total.set(total);

      const tp = this.totalPages();
      if (this.page() > tp) {
        this.page.set(tp);
        await this.loadPage();
      }

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La consulta tardó demasiado.');
      else this.error.set(this.extractApiError(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ================== Búsqueda ==================
  async onSearch() {
    if (!this.q.trim()) return this.loadPage();

    this.loading.set(true); this.error.set(null);
    try {
      const url = `${this.apiBase}/group/search`;
      const zeroBased = Math.max(0, this.page() - 1);
      let params = new HttpParams()
        .set('q', this.q.trim())
        .set('page', String(zeroBased))
        .set('size', String(this.pageSize()))
        .set('sortBy', this.sortBy())
        .set('direction', this.direction());

      const res = await firstValueFrom(
        this.http.get<ApiPageOk<Grupo>>(url, { params }).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res };
      }

      const data = res?.data;
      const items = data?.items ?? [];
      const total = data?.totalElements ?? items.length;

      this.groups.set(items);
      this.total.set(total);

      const tp = this.totalPages();
      if (this.page() > tp) {
        this.page.set(tp);
        await this.onSearch();
      }

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La búsqueda tardó demasiado.');
      else this.error.set(this.extractApiError(e));
    } finally {
      this.loading.set(false);
    }
  }

  async clearFilters() {
    this.q = '';
    this.page.set(1);
    await this.loadPage();
  }

  // ================== Orden y paginación ==================
  async changeSort(field: 'id'|'nombre') {
    if (this.sortBy() === field) {
      this.direction.set(this.direction()==='ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortBy.set(field);
      this.direction.set('ASC');
    }
    this.page.set(1);
    await (this.q.trim() ? this.onSearch() : this.loadPage());
  }

  async setPageSize(n: number) {
    this.pageSize.set(Number(n) || 10);
    this.page.set(1);
    await (this.q.trim() ? this.onSearch() : this.loadPage());
  }

  async goToPage(n: number) {
    const tp = this.totalPages();
    if (n < 1 || n > tp) return;
    this.page.set(n);
    await (this.q.trim() ? this.onSearch() : this.loadPage());
  }
  async prevPage() { await this.goToPage(this.page() - 1); }
  async nextPage() { await this.goToPage(this.page() + 1); }

  // ================== Crear ==================
  async create() {
    if (!this.canCreate()) return;
    const nombre = this.newName().trim();
    const empresaId = this.empresaId();
    this.creating.set(true);
    this.error.set(null); this.success.set(null);

    if (!empresaId) {
      this.error.set('No se pudo determinar la empresa del usuario.');
      return;
    }
    try {
      const url = `${this.apiBase}/group/create`;
      const payload: CreateDto = { nombre, empresaId };
      const res = await firstValueFrom(
        this.http.post<ApiDetailOk<Grupo>>(url, payload).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res };
      }

      const created = res?.data;
      if (created?.id) {
        this.groups.set([created, ...this.groups()]);
        this.total.set(this.total() + 1);
      } else {
        await this.loadPage();
      }

      this.success.set('✅ Grupo creado.');
      this.newName.set('');
      setTimeout(() => this.success.set(null), 1500);

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La creación tardó demasiado.');
      else this.error.set(this.extractApiError(e));
    } finally {
      this.creating.set(false);
    }
  }

  // ================== Editar inline ==================
  startEdit(g: Grupo) {
    if (this.savingRowId()) return;
    this.editingId.set(g.id);
    this.editName.set(g.nombre);
    this.error.set(null); this.success.set(null);
  }
  cancelEdit() {
    this.editingId.set(null);
    this.editName.set('');
  }
  async saveEdit(g: Grupo) {
    const id = g.id;
    const nombre = this.editName().trim();
    if (!id || !nombre) return;

    this.savingRowId.set(id);
    this.error.set(null); this.success.set(null);
    try {
      const url = `${this.apiBase}/group/update/${id}`;
      const payload: UpdateDto = { nombre };
      const res = await firstValueFrom(
        this.http.put<ApiDetailOk<Grupo>>(url, payload).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res };
      }

      const updated = res?.data;
      if (updated?.id) {
        this.groups.update(list => list.map(x => x.id === updated.id ? { ...x, ...updated } : x));
      } else {
        await this.loadPage();
      }

      this.success.set('✅ Grupo actualizado.');
      setTimeout(() => this.success.set(null), 1200);
      this.cancelEdit();

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La actualización tardó demasiado.');
      else this.error.set(this.extractApiError(e));
    } finally {
      this.savingRowId.set(null);
    }
  }

  // ================== Eliminar ==================
  openConfirm(g: Grupo) {
    this.groupToDelete.set(g);
    this.confirmOpen.set(true);
  }
  closeConfirm() {
    this.confirmOpen.set(false);
    this.groupToDelete.set(null);
  }

  async confirmDelete() {
    const g = this.groupToDelete();
    if (!g) return;

    this.loading.set(true);
    this.error.set(null); this.success.set(null);
    try {
      const url = `${this.apiBase}/group/delete/${g.id}`;
      const res = await firstValueFrom(
        this.http.delete<ApiDetailOk<{ deletedId: number }>>(url).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res };
      }

      this.groups.update(list => list.filter(x => x.id !== g.id));
      this.total.set(Math.max(0, this.total() - 1));
      this.success.set('🗑️ Grupo eliminado.');
      setTimeout(() => this.success.set(null), 1200);

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La eliminación tardó demasiado.');
      else this.error.set(this.extractApiError(e));
    } finally {
      this.loading.set(false);
      this.closeConfirm();
    }
  }

  // ================== Ver detalle ==================
  async verDetalle(g: Grupo) {
    try {
      const url = `${this.apiBase}/group/detail/${g.id}`;
      const res = await firstValueFrom(this.http.get<ApiDetailOk<Grupo>>(url).pipe(timeout(10000)));

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res };
      }

      console.log('Detalle grupo', res?.data);
      this.success.set(`Grupo #${g.id}: ${res?.data?.nombre ?? ''}`);
      setTimeout(() => this.success.set(null), 1500);
    } catch (e) {
      this.error.set(this.extractApiError(e));
      setTimeout(() => this.error.set(null), 2000);
    }
  }
}
