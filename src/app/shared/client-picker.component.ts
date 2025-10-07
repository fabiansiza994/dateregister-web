import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';

interface Cliente {
  id: number;
  identificacion?: string;
  nombre: string;
  apellido?: string;
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
    items: Cliente[];
    totalElements: number;
  };
  message: string;
}

interface ApiOk<T> {
  dataResponse?: { idTx?: string | null; response?: 'SUCCESS'|'ERROR' };
  data?: T;
  message?: string;
  error?: Array<{ codError?: string; descError?: string; msgError?: string }>;
}

@Component({
  selector: 'app-client-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-picker.html',
})
export class ClientPickerComponent {
  @Input() apiBase = '';                 // ej: http://localhost:8081
  @Input() token: string | null = null;  // JWT para crear

  private _isOpen = false;
  private _loadedThisOpen = false;

  @Input() set isOpen(v: boolean) {
    const wasOpen = this._isOpen;
    this._isOpen = v;

    if (v && !wasOpen) {
      this._loadedThisOpen = false;
      if (this.tab() === 'buscar' && !this._loadedThisOpen) {
        this.page.set(1);
        queueMicrotask(() => this.loadPageAuto());
      }
    }

    if (!v && wasOpen) {
      this._loadedThisOpen = false;
    }
  }
  get isOpen() { return this._isOpen; }

  // Overrides opcionales si no quieres decodificar el token
  @Input() empresaId: number | null | undefined;
  @Input() usuarioId: number | null | undefined;

  @Output() closed = new EventEmitter<void>();
  @Output() selected = new EventEmitter<Cliente>();

  // pestañas
  tab = signal<'buscar'|'crear'>('buscar');

  // buscar
  q = '';
  loading = signal(false);
  error = signal<string|null>(null);
  items = signal<Cliente[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(10);

  totalPages = computed(() => {
    const t = this.total(), s = this.pageSize();
    return Math.max(1, Math.ceil(t / Math.max(1, s)));
  });

  visibleWithRow = computed(() => {
    const startIdx = (this.page() - 1) * this.pageSize();
    return this.items().map((c, i) => ({ ...c, row: startIdx + i + 1 }));
  });

  constructor(private http: HttpClient) {}

  // ----------- Helper de errores backend -----------

  /** Extrae el/los descError|msgError del backend (soporta 200 con response=ERROR o errores HTTP) */
  private extractBackendErrorMessage(err: any): string | null {
    const src = err?.error ?? err; // en errores HTTP, Angular pone el body en err.error

    // Caso típico: { error: [{ descError, msgError, ... }] }
    const arr = Array.isArray(src?.error) ? src.error
              : Array.isArray(src) ? src
              : Array.isArray(err?.error?.error) ? err.error.error
              : null;

    if (Array.isArray(arr)) {
      const msgs = arr
        .map((x: any) => x?.descError || x?.msgError)
        .filter(Boolean);
      if (msgs.length) return msgs.join(' | ');
    }

    // A veces viene en nivel raíz
    if (typeof src?.message === 'string' && src.message) return src.message;
    if (typeof err?.message === 'string' && err.message) return err.message;

    return null;
  }

  // ----------- Búsqueda -----------

  private headersOpt(): { headers?: HttpHeaders } {
    return this.token ? { headers: new HttpHeaders({ Authorization: `Bearer ${this.token}` }) } : {};
  }

  private async loadPageAuto() {
    if (this._loadedThisOpen) return;
    await this.loadPage();
    this._loadedThisOpen = true;
  }

  async loadPage() {
    if (!this.apiBase) { this.error.set('Falta apiBaseUrl'); return; }
    this.loading.set(true); this.error.set(null);
    try {
      const zero = Math.max(0, this.page()-1);
      const params = new HttpParams()
        .set('q', this.q.trim())
        .set('page', String(zero))
        .set('size', String(this.pageSize()));
      const url = `${this.apiBase}/client/search`;
      const res = await firstValueFrom(
        this.http.get<ClientSearchOk>(url, { params, ...this.headersOpt() }).pipe(timeout(12000))
      );
      const list = res?.data?.items ?? [];
      this.items.set(list);
      this.total.set(res?.data?.totalElements ?? list.length);
    } catch (e:any) {
      if (e instanceof TimeoutError) {
        this.error.set('La consulta tardó demasiado.');
      } else {
        const msg = this.extractBackendErrorMessage(e);
        this.error.set(msg || 'Error al cargar clientes');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async onSearch(){ this.page.set(1); this._loadedThisOpen = true; await this.loadPage(); }
  async next(){ if (this.page()<this.totalPages()) { this.page.set(this.page()+1); this._loadedThisOpen = true; await this.loadPage(); } }
  async prev(){ if (this.page()>1) { this.page.set(this.page()-1); this._loadedThisOpen = true; await this.loadPage(); } }

  choose(c: Cliente){ this.selected.emit(c); }

  // ----------- Crear -----------

  createForm: Partial<Cliente> = {
    identificacion: '',
    nombre: '',
    apellido: '',
    email: '',
    direccion: '',
    telefono: ''
  };
  creating = signal(false);

  private decodeJwt(token: string | null): any {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
      return JSON.parse(json);
    } catch { return null; }
  }

  private resolveEmpresaId(): number | null {
    if (this.empresaId != null) return this.empresaId;
    const claims = this.decodeJwt(this.token);
    return claims?.empresaId ?? claims?.empresa_id ?? null;
  }

  private resolveUsuarioId(): number | null {
    if (this.usuarioId != null) return this.usuarioId;
    const claims = this.decodeJwt(this.token);
    return claims?.userId ?? claims?.usuarioId ?? claims?.idUsuario ?? null;
  }

  async createClient() {
    // Validación mínima local
    if (!this.createForm.nombre?.trim()) { this.error.set('El nombre es obligatorio.'); return; }

    const empresaId = this.resolveEmpresaId();
    const usuarioId = this.resolveUsuarioId();
    if (!empresaId || !usuarioId) {
      this.error.set('No se pudo determinar empresaId/usuarioId (revisa el token o pasa [empresaId]/[usuarioId] como @Input).');
      return;
    }

    const payload = {
      nombre: (this.createForm.nombre || '').trim(),
      apellido: (this.createForm.apellido || '').trim(),
      email: (this.createForm.email || '').trim(),
      direccion: (this.createForm.direccion || '').trim(),
      telefono: (this.createForm.telefono || '').trim(),
      identificacion: (this.createForm.identificacion || '').trim() || null,
      empresa: { id: empresaId },
      usuario: { id: usuarioId },
      pacientes: [] as any[],
    };

    this.creating.set(true); this.error.set(null);
    try {
      const url = `${this.apiBase}/client/create`;
      const res = await firstValueFrom(
        this.http.post<ApiOk<Cliente>>(url, payload, this.headersOpt()).pipe(timeout(12000))
      );

      // Caso 200 con response=ERROR del backend
      if (res?.dataResponse?.response?.toUpperCase() === 'ERROR') {
        const msgFromRes = this.extractBackendErrorMessage(res);
        const msg = msgFromRes || res?.message || 'Error al crear cliente';
        throw new Error(msg);
      }

      const nuevo = res?.data as Cliente;
      if (nuevo?.id) {
        this.selected.emit(nuevo);
      } else {
        this.error.set('Cliente creado pero sin ID retornado.');
      }
    } catch (e:any) {
      if (e instanceof TimeoutError) {
        this.error.set('La creación tardó demasiado.');
      } else {
        // Errores HTTP con el mismo formato { error: [{ descError, msgError }] }
        const msg = this.extractBackendErrorMessage(e);
        this.error.set(msg || 'No se pudo crear el cliente.');
      }
    } finally {
      this.creating.set(false);
    }
  }

  close(){
    if (!this.loading()) {
      this._isOpen = false;
      this._loadedThisOpen = false;
      this.closed.emit();
    }
  }
}
