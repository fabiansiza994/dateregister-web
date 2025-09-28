import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';

export interface PacienteLite {
  id: number;
  documento?: string | null;
  clienteId?: number | null;
  // 👇 NUEVO: soporta cliente embebido o solo un string
  cliente?: { id: number; nombre: string; apellido?: string | null } | null;
  clienteNombre?: string | null;

  nombre: string;
  apellido?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  estado?: string | null;
}

interface PacienteSearchOk {
  dataResponse: { response: 'SUCCESS' | 'ERROR' };
  data: {
    items: PacienteLite[];
    totalElements: number;
  };
  message?: string;
  error?: Array<{ msgError?: string; descError?: string }>;
}

interface ApiOk<T> {
  dataResponse?: { idTx?: string | null; response?: 'SUCCESS' | 'ERROR' };
  data?: T;
  message?: string;
  error?: Array<{ descError?: string; msgError?: string }>;
}

interface ClienteLite {
  id: number;
  nombre: string;
  apellido?: string | null;
  identificacion?: string | null;
}

@Component({
  selector: 'app-patient-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './patient-picker.html',
})
export class PatientPickerComponent {
  @Input() apiBase = '';
  @Input() token: string | null = null;

  // Carga automática al abrir
  private _isOpen = false;
  @Input() set isOpen(v: boolean) {
    this._isOpen = v;
    if (v) {
      if (this.tab() === 'buscar') {
        this.page.set(1);
        queueMicrotask(() => this.loadPage());
      }
    }
  }
  get isOpen() { return this._isOpen; }

  @Output() closed = new EventEmitter<void>();
  @Output() selected = new EventEmitter<PacienteLite>();

  // pestañas
  tab = signal<'buscar' | 'crear'>('buscar');

  // buscar
  q = '';
  loading = signal(false);
  error = signal<string | null>(null);
  items = signal<PacienteLite[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(10);

  totalPages = computed(() => {
    const t = this.total(), s = this.pageSize();
    return Math.max(1, Math.ceil(t / Math.max(1, s)));
  });

  visibleWithRow = computed(() => {
    const startIdx = (this.page() - 1) * this.pageSize();
    return this.items().map((p, i) => ({ ...p, row: startIdx + i + 1 }));
  });

  constructor(private http: HttpClient) {}

  // Helper: etiqueta "Cliente — Paciente"
  pacientLabel(p: PacienteLite): string {
    const clienteNom =
      (p.clienteNombre?.trim())
      || ([p.cliente?.nombre, p.cliente?.apellido].filter(Boolean).join(' ').trim())
      || ''; // puede estar vacío si BE no lo envía

    const pacNom = [p.nombre, p.apellido].filter(Boolean).join(' ').trim();

    return `${pacNom}`;
  }

  clientLabel(p: PacienteLite): string {
    const clienteNom =
      (p.clienteNombre?.trim())
      || ([p.cliente?.nombre, p.cliente?.apellido].filter(Boolean).join(' ').trim())
      || ''; // puede estar vacío si BE no lo envía

    const pacNom = [p.nombre, p.apellido].filter(Boolean).join(' ').trim();

    return clienteNom ? `${clienteNom} - ` : `-` ;
  }

  // ---------- Búsqueda ----------
  async loadPage() {
    if (!this.apiBase) { this.error.set('Falta apiBaseUrl'); return; }
    this.loading.set(true); this.error.set(null);
    try {
      const zero = Math.max(0, this.page() - 1);
      const params = new HttpParams()
        .set('q', this.q.trim())
        .set('page', String(zero))
        .set('size', String(this.pageSize()))
        .set('sortBy', 'nombre')
        .set('direction', 'ASC');

      const url = `${this.apiBase}/paciente/search`;
      const res = await firstValueFrom(
        this.http.get<PacienteSearchOk>(url, { params }).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        const msg = res?.error?.map(x => x?.descError || x?.msgError)?.filter(Boolean)?.join(' | ');
        throw new Error(msg || res?.message || 'Error al buscar pacientes');
      }

      const list = res?.data?.items ?? [];
      this.items.set(list);
      this.total.set(res?.data?.totalElements ?? list.length);
    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La consulta tardó demasiado.');
      else {
        const msg = e?.error?.error?.map((x: any) => x?.descError || x?.msgError)?.filter(Boolean)?.join(' | ');
        this.error.set(msg || e?.error?.message || e?.message || 'Error al cargar pacientes');
      }
    } finally {
      this.loading.set(false);
    }
  }
  async onSearch() { this.page.set(1); await this.loadPage(); }
  async next() { if (this.page() < this.totalPages()) { this.page.set(this.page() + 1); await this.loadPage(); } }
  async prev() { if (this.page() > 1) { this.page.set(this.page() - 1); await this.loadPage(); } }

  choose(p: PacienteLite) { this.selected.emit(p); }

  // ---------- Crear paciente (con cliente asociado) ----------
  createForm: Partial<PacienteLite & { documento?: string | null; clienteId?: number | null }> = {
    nombre: '',
    apellido: '',
    documento: '',
    telefono: '',
    email: '',
    direccion: '',
    clienteId: null
  };
  creating = signal(false);

  // mini-buscador de clientes para llenar clienteId
  qCliente = '';
  loadingClientes = signal(false);
  clientes = signal<ClienteLite[]>([]);

  async buscarClientes() {
    if (!this.apiBase) return;
    this.loadingClientes.set(true);
    try {
      const params = new HttpParams()
        .set('q', this.qCliente)
        .set('page', '0')
        .set('size', '10')
        .set('sortBy', 'nombre')
        .set('direction', 'ASC');
      const url = `${this.apiBase}/client/search`;
      const res: any = await firstValueFrom(this.http.get(url, { params }).pipe(timeout(10000)));
      const items = res?.data?.items ?? [];
      this.clientes.set(items);
    } catch {
      this.clientes.set([]);
    } finally {
      this.loadingClientes.set(false);
    }
  }

  async createPatient() {
    if (!this.createForm?.nombre?.trim()) { this.error.set('El nombre es obligatorio.'); return; }
    if (!this.createForm?.documento?.trim()) { this.error.set('El documento es obligatorio.'); return; }
    if (!this.createForm?.clienteId) { this.error.set('Debes seleccionar el cliente asociado.'); return; }

    const payload = {
      nombre: (this.createForm.nombre || '').trim(),
      apellido: (this.createForm.apellido || '')?.trim() || null,
      documento: (this.createForm.documento || '').trim(),
      telefono: (this.createForm.telefono || '')?.trim() || null,
      email: (this.createForm.email || '')?.trim() || null,
      direccion: (this.createForm.direccion || '')?.trim() || null,
      clienteId: this.createForm.clienteId
    };

    this.creating.set(true); this.error.set(null);
    try {
      const url = `${this.apiBase}/paciente/create`;
      const res = await firstValueFrom(
        this.http.post<ApiOk<{ id: number }>>(url, payload).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        const msg = res?.error?.map(x => x?.descError || x?.msgError)?.filter(Boolean)?.join(' | ');
        throw new Error(msg || res?.message || 'Error al crear paciente');
      }

      const nuevoId = res?.data?.id;
      const nuevo: PacienteLite = {
        id: nuevoId ?? 0,
        nombre: payload.nombre,
        apellido: payload.apellido || undefined,
        documento: payload.documento,
        telefono: payload.telefono || undefined,
        email: payload.email || undefined,
        direccion: payload.direccion || undefined,
        estado: 'ACTIVO',
        // Si tu API retorna el cliente en el create, puedes setearlo aquí:
        // cliente: { id: payload.clienteId, nombre: '...' }
      };
      this.selected.emit(nuevo);
      // this.closed.emit(); // opcional: cerrar al crear

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La creación tardó demasiado.');
      else this.error.set(e?.message || e?.error?.message || 'No se pudo crear el paciente.');
    } finally {
      this.creating.set(false);
    }
  }

  close() { if (!this.loading()) this.closed.emit(); }
}
