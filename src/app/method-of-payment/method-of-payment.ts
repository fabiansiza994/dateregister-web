import { Component, OnInit, signal, computed, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';
import { TourService } from '../core/tour.service';

interface Mop {
  id: number;
  formaPago: string;
  estado: number; // 1=activo, 0=inactivo
}
interface MopListOk {
  dataResponse: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data: Mop[];
  message?: string;
  error?: Array<{ descError?: string; msgError?: string }>;
}
interface MopUpdateRequest { id: number; formaPago: string; }
interface MopUpdateOk {
  dataResponse: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: Mop;
  message?: string;
  error?: Array<{ descError?: string; msgError?: string }>;
}
interface MopCreateRequest { formaPago: string; empresaId: number; }
interface MopCreateOk {
  dataResponse: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: Mop & { empresaId?: number };
  message?: string;
  error?: Array<{ descError?: string; msgError?: string }>;
}
interface ApiOk {
  dataResponse?: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  message?: string;
  error?: Array<{ descError?: string; msgError?: string }>;
}

@Component({
  selector: 'app-method-of-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './method-of-payment.html'
})
export class MethodOfPaymentComponent implements OnInit, AfterViewInit {
  private readonly tour = inject(TourService);
  // ===== Claims
  private readonly _claims = signal<any | null>(null);
  empresaId = computed<number>(() => Number(this._claims()?.empresaId ?? 0));
  empresaNombre = computed<string>(() => String(this._claims()?.empresa ?? '—'));

  // ===== UI state
  loading = signal(false);
  savingRowId = signal<number | null>(null);
  creating = signal(false);
  deletingRowId = signal<number | null>(null);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  // ===== Data
  mops = signal<Mop[]>([]);

  // ===== Create form
  newName = signal<string>('');
  canCreate = computed(() => !!this.newName().trim() && !this.creating());

  // ===== Edit inline
  editingId = signal<number | null>(null);
  editName = signal<string>('');

  // ===== Modal eliminar
  mopToDelete = signal<Mop | null>(null);
  confirmOpen = computed(() => this.mopToDelete() !== null);

  private apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private auth: AuthService
  ) { }

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());
    this.loadList();
  }

  // ===== List
  async loadList() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const empId = this.empresaId();
      if (!empId) throw new Error('No se pudo determinar la empresa del usuario (empresaId).');

      const url = `${this.apiBase}/mop/list/${empId}`;
      const res = await firstValueFrom(this.http.get<MopListOk>(url).pipe(timeout(10000)));

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.descError || x?.msgError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No fue posible cargar los métodos de pago.');
      }

      this.mops.set(res?.data ?? []);
      const key = `mop:hasOne:${this.empresaId()}`;
      if ((res?.data?.length ?? 0) > 0) localStorage.setItem(key, '1');
    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La carga tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.message || e?.message || 'No fue posible cargar los métodos de pago.');
      this.mops.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  // ===== Create
  async create() {
    if (!this.canCreate()) return;
    const name = this.newName().trim();
    if (!name) return;

    this.creating.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const payload: MopCreateRequest = { formaPago: name, empresaId: this.empresaId() };
      const url = `${this.apiBase}/mop/create`;
      const res = await firstValueFrom(this.http.post<MopCreateOk>(url, payload).pipe(timeout(10000)));

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.descError || x?.msgError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No fue posible crear el método de pago.');
      }

      const created = res?.data;
      if (created?.id) {
        this.mops.set([created as Mop, ...this.mops()]);
      } else {
        await this.loadList();
      }

      this.success.set('✅ Método de pago creado.');
      this.newName.set('');

      const key = `mop:hasOne:${this.empresaId()}`;
      localStorage.setItem(key, '1');
      window.dispatchEvent(new CustomEvent('mop:created', { detail: { empresaId: this.empresaId() } }));

      setTimeout(() => this.success.set(null), 1800);

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La creación tardó demasiado.');
      else this.error.set(e?.error?.message || e?.message || 'No fue posible crear el método de pago.');
    } finally {
      this.creating.set(false);
    }
  }

  // ===== Edit inline
  startEdit(row: Mop) {
    if (this.savingRowId()) return;
    this.editingId.set(row.id);
    this.editName.set(row.formaPago);
    this.error.set(null);
    this.success.set(null);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editName.set('');
  }

  async saveEdit(row: Mop) {
    const id = row.id;
    const name = this.editName().trim();
    if (!id || !name) return;

    this.savingRowId.set(id);
    this.error.set(null);
    this.success.set(null);
    try {
      const url = `${this.apiBase}/mop/update`;
      const payload: MopUpdateRequest = { id, formaPago: name };
      const res = await firstValueFrom(this.http.put<MopUpdateOk>(url, payload).pipe(timeout(10000)));

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.descError || x?.msgError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No fue posible actualizar el método de pago.');
      }

      const updated = res?.data;
      if (updated?.id) {
        this.mops.update(list => list.map(m => (m.id === updated.id ? { ...m, ...updated } : m)));
      } else {
        await this.loadList();
      }

      this.success.set('✅ Método de pago actualizado.');
      setTimeout(() => this.success.set(null), 1500);
      this.cancelEdit();

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La actualización tardó demasiado.');
      else this.error.set(e?.error?.message || e?.message || 'No fue posible actualizar el método de pago.');
    } finally {
      this.savingRowId.set(null);
    }
  }

  // ===== Eliminar (con modal)
  openConfirm(m: Mop) {
    if (this.deletingRowId()) return;
    this.mopToDelete.set(m);
  }
  closeConfirm() {
    if (this.deletingRowId()) return; // no cerrar mientras elimina
    this.mopToDelete.set(null);
  }

  async confirmDelete() {
    const m = this.mopToDelete();
    if (!m) return;
    await this.deleteMop(m.id);
  }

  private async deleteMop(id: number) {
    this.error.set(null);
    this.success.set(null);
    this.deletingRowId.set(id);
    try {
      const url = `${this.apiBase}/mop/delete/${id}`;
      const res = await firstValueFrom(this.http.delete<ApiOk>(url).pipe(timeout(12000)));

      if (res?.dataResponse?.response === 'ERROR') {
        throw new Error(res?.message || 'No se pudo eliminar.');
      }

      this.mops.update(list => (list || []).filter(x => x.id !== id));
      this.success.set('Método de pago eliminado correctamente.');
      setTimeout(() => this.success.set(null), 1500);
      this.mopToDelete.set(null);

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La eliminación tardó demasiado. Intenta de nuevo.');
      } else {
        const apiMsgs = e?.error?.error?.map((x: any) => x?.descError || x?.msgError)
          ?.filter(Boolean)?.join(' | ');
        this.error.set(apiMsgs || e?.error?.message || e?.message || 'No fue posible eliminar el método de pago.');
      }
    } finally {
      this.deletingRowId.set(null);
    }
  }

  // ===== Helpers de vista
  badgeFor(m: Mop) {
    return m.estado === 1
      ? 'bg-success-subtle text-success-emphasis'
      : 'bg-secondary-subtle text-secondary-emphasis';
  }

  ngAfterViewInit(): void {
    const user = this._claims()?.sub ?? this._claims()?.usuario ?? 'user';
    const empresa = this._claims()?.empresa ?? 'empresa';
    const userKeyPart = `${empresa}:${user}`;
    const pendingKey = `tour:payments:pending:${userKeyPart}`;

    // Si venimos del paso 1 del tour forzado, continúa aquí (bloqueado)
    if (localStorage.getItem(pendingKey) === '1') {
      this.tour.startPaymentPageEnforcedTour(userKeyPart, this.empresaId());
    }
  }
}
