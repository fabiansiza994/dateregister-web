import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';

interface PacienteCreateRequest {
  nombre: string;
  apellido?: string | null;
  documento: string;
  telefono?: string | null;
  email?: string | null;
  clienteId: number | null;
  direccion?: string | null;
}

interface ApiErrorItem {
  codError?: string;
  descError?: string;  // mensaje humano
  msgError?: string;   // nombre del campo (o código, según BE)
}

interface PacienteCreateOk {
  dataResponse: { idTx: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: { id: number };
  message?: string;
}

interface PacienteCreateError {
  dataResponse?: { response?: 'ERROR' | 'SUCCESS' };
  error?: ApiErrorItem[];
  message?: string;
}

interface ClienteLite {
  id: number;
  nombre: string;
  apellido?: string | null;
  identificacion?: string | null;
  estado?: string;
}
interface ClientSearchOk {
  dataResponse: { response: 'SUCCESS' | 'ERROR' };
  data: {
    items: ClienteLite[];
    totalElements: number;
  };
}

@Component({
  selector: 'app-paciente-nuevo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './paciente-nuevo.html',
})
export class PacienteNuevoComponent {
  // ===== Modelo =====
  model = signal<PacienteCreateRequest>({
    nombre: '',
    apellido: '',
    documento: '00000',
    telefono: '3130000000',
    email: 'nn@mail.com',
    clienteId: null,
    direccion: 'colombia'
  });

  // ===== UI state =====
  loading = signal(false);
  errorGlobal = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  success = signal<string | null>(null);
  showAdditionalFields = signal(false);

  // Validación mínima
  isValid = computed(() =>
    !!this.model().nombre.trim() &&
    !!this.model().documento.trim() &&
    !!this.model().clienteId
  );

  // ===== Búsqueda de clientes para elegir clienteId =====
  qCliente = '';
  buscarLoading = signal(false);
  clientes = signal<ClienteLite[]>([]);
  totalClientes = signal(0);

  private apiBase = '';

  // ===== Helpers de mapeo de errores =====
  private readonly knownFields = new Set([
    'documento', 'nombre', 'apellido', 'telefono', 'email', 'direccion', 'clienteId', 'global'
  ]);

  private resolveFieldFrom(it: ApiErrorItem): string {
    const raw = (it?.msgError ?? '').trim().toLowerCase();
    if (raw && this.knownFields.has(raw)) return raw; // Si viene un campo real, úsalo

    // Heurística por contenido del mensaje (para cuando msgError trae un código como E001)
    const msg = `${it?.descError ?? ''} ${it?.codError ?? ''}`.toLowerCase();
    const hits: string[] = [];
    if (msg.includes('documento')) hits.push('documento');
    if (msg.includes('cliente')) hits.push('clienteId');

    if (hits.length === 1) return hits[0];
    return 'global';
  }

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router
  ) {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    // carga inicial de clientes (q='')
    this.buscarClientes();
  }

  // Helpers para actualizar campos y limpiar error del campo
  onField<K extends keyof PacienteCreateRequest>(key: K, value: PacienteCreateRequest[K]) {
    this.model.update(m => ({ ...m, [key]: value }));
    this.clearFieldError(key as string);
  }

  toggleAdditionalFields() {
    this.showAdditionalFields.update(show => !show);
  }

  clearFieldError(field: string) {
    const cur = { ...this.fieldErrors() };
    delete cur[field];
    this.fieldErrors.set(cur);
  }
  private setFieldError(field: string, msg: string) {
    const cur = this.fieldErrors();
    this.fieldErrors.set({ ...cur, [field]: msg });
  }

  // ====== Buscar clientes (para setear clienteId) ======
  async buscarClientes() {
    if (!this.apiBase) return;
    this.buscarLoading.set(true);
    try {
      const params = new HttpParams()
        .set('q', this.qCliente)   // backend requiere q siempre
        .set('page', '0')
        .set('size', '10')
        .set('sortBy', 'nombre')
        .set('direction', 'ASC');

      const url = `${this.apiBase}/client/search`;
      const res = await firstValueFrom(
        this.http.get<ClientSearchOk>(url, { params }).pipe(timeout(8000))
      );
      const items = res?.data?.items ?? [];
      this.clientes.set(items);
      this.totalClientes.set(res?.data?.totalElements ?? items.length);
    } catch {
      // silencioso; podrías mostrar un toast si quieres
      this.clientes.set([]);
      this.totalClientes.set(0);
    } finally {
      this.buscarLoading.set(false);
    }
  }

  // ===== Enviar =====
  async create() {
    if (!this.isValid()) {
      this.errorGlobal.set('Revisa los campos requeridos.');
      return;
    }

    this.loading.set(true);
    this.errorGlobal.set(null);
    this.fieldErrors.set({});
    this.success.set(null);

    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const url = `${this.apiBase}/paciente/create`;
      const res = await firstValueFrom(
        this.http.post<PacienteCreateOk>(url, this.model()).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res } as any;
      }

      const id = res?.data?.id;
      const flash = `✅ Paciente creado${id ? ' (ID ' + id + ')' : ''}.`;
      this.router.navigate(['/pacientes'], { state: { flash } });

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.errorGlobal.set('La solicitud tardó demasiado. Intenta de nuevo.');
      } else {
        const be = (e?.error ?? e) as PacienteCreateError;
        const arr = be?.error ?? [];

        if (arr.length > 0) {
          // limpiar estado previo
          this.fieldErrors.set({});
          this.errorGlobal.set(null);

          arr.forEach(it => {
            const field = this.resolveFieldFrom(it);
            const msg   = (it?.descError ?? it?.codError ?? 'Error').trim();

            if (!field || field === 'global' || !this.knownFields.has(field)) {
              this.errorGlobal.set(msg);
            } else {
              this.setFieldError(field, msg);
            }
          });

          // Si no se marcó ningún campo y no hay errorGlobal, caer a message genérico
          if (!this.errorGlobal() && Object.keys(this.fieldErrors()).length === 0) {
            this.errorGlobal.set(be?.message || 'No se pudo crear el paciente.');
          }
        } else {
          // Sin arreglo de errores: usa message o el mensaje crudo
          this.errorGlobal.set(
            be?.message || e?.error?.message || e?.message || 'No se pudo crear el paciente.'
          );
        }
      }
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    } finally {
      this.loading.set(false);
    }
  }
}
