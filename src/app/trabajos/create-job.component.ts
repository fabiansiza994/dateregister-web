import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { ClientPickerComponent } from '../shared/client-picker.component'; // ⬅️ ajusta la ruta

type FotoKey = 'foto1' | 'foto2' | 'foto3' | 'foto4';

interface CreateJobPayload {
  fecha: string;             // "YYYY-MM-DD"
  valorLabor?: number;
  valorMateriales?: number;
  valorTotal: number;
  ganancias?: number;
  descripcionLabor: string;
  clienteId: number;
  pacienteId?: number;
  formaPagoId: number;
}

interface FormaPago { id: number; formaPago: string; estado: number; }

@Component({
  selector: 'app-crear-trabajo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClientPickerComponent],
  templateUrl: './create-job.html',
})
export class CreateJobComponent implements OnInit {
  form: CreateJobPayload = {
    fecha: '',
    valorLabor: undefined,
    valorMateriales: undefined,
    valorTotal: 0,
    ganancias: undefined,
    descripcionLabor: '',
    clienteId: 0,
    pacienteId: undefined,
    formaPagoId: 0,
  };

  files: Partial<Record<FotoKey, File>> = {};
  previews: Partial<Record<FotoKey, string>> = {};

  loading = signal(false);
  error = signal<string | null>(null);
  progress = signal(0);

  // Cliente (picker modal)
  clientModalOpen = signal(false);
  selectedClient: { id: number; nombre: string; apellido?: string | null } | null = null;

  // Formas de pago
  mopLoading = signal(false);
  formasPago: FormaPago[] = [];

  // Base de API
  apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.loadFormasPago();
  }

  // ===== Utilidades =====
  get tokenStr(): string | null { return localStorage.getItem('token'); }

  onFileChange(ev: Event, key: FotoKey) {
    const input = ev.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.files[key] = file;
      const reader = new FileReader();
      reader.onload = () => (this.previews[key] = reader.result as string);
      reader.readAsDataURL(file);
    } else {
      delete this.files[key];
      delete this.previews[key];
    }
  }

  resetForm() {
    this.form = {
      fecha: '',
      valorLabor: undefined,
      valorMateriales: undefined,
      valorTotal: 0,
      ganancias: undefined,
      descripcionLabor: '',
      clienteId: 0,
      pacienteId: undefined,
      formaPagoId: 0,
    };
    this.files = {};
    this.previews = {};
    this.error.set(null);
    this.progress.set(0);
    this.selectedClient = null;
  }

  private validate(): string | null {
    if (!this.form.fecha) return 'La fecha es obligatoria.';
    if (!this.form.descripcionLabor?.trim()) return 'La descripción de la labor es obligatoria.';
    if (!this.form.clienteId) return 'Debes seleccionar un cliente.';
    if (!this.form.formaPagoId) return 'Debes seleccionar una forma de pago.';
    const total = Number(this.form.valorTotal);
    if (!(total >= 0)) return 'El valor total debe ser un número válido.';
    // (opcional) Validar consistencia: valorLabor + valorMateriales = valorTotal
    // if ((this.form.valorLabor ?? 0) + (this.form.valorMateriales ?? 0) !== total) return 'La suma de mano de obra y materiales debe igualar el total.';
    return null;
  }

  // ===== Cliente (modal) =====
  openClientModal() {
    this.clientModalOpen.set(true);
  }
  onClientPicked(c: { id: number; nombre: string; apellido?: string | null }) {
    this.selectedClient = { id: c.id, nombre: c.nombre, apellido: c.apellido };
    this.form.clienteId = c.id;
    this.clientModalOpen.set(false);
  }
  onClientClose() {
    this.clientModalOpen.set(false);
  }
  clearClient() {
    this.selectedClient = null;
    this.form.clienteId = 0;
  }

  // ===== Formas de pago =====
  async loadFormasPago() {
    if (!this.apiBase) return;
    this.mopLoading.set(true);
    try {
      const url = `${this.apiBase}/mop/list`;
      const res: any = await firstValueFrom(this.http.get(url).pipe(timeout(10000)));
      this.formasPago = res?.data ?? [];
    } catch {
      // Silencioso o setear un pequeño aviso
    } finally {
      this.mopLoading.set(false);
    }
  }

  // ===== Crear trabajo =====
  async create() {
    const v = this.validate();
    if (v) { this.error.set(v); return; }

    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const token = this.tokenStr;
      if (!token) { this.error.set('No hay sesión activa (token). Inicia sesión.'); return; }

      const fd = new FormData();
      const payloadBlob = new Blob([JSON.stringify(this.form)], { type: 'application/json' });
      fd.append('payload', payloadBlob);

      (['foto1', 'foto2', 'foto3', 'foto4'] as FotoKey[]).forEach(k => {
        if (this.files[k]) fd.append(k, this.files[k]!);
      });

      this.loading.set(true);
      this.progress.set(0);
      this.error.set(null);

      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const url = `${this.apiBase}/job/create`;

      const res = await new Promise<any>((resolve, reject) => {
        this.http.post(url, fd, {
          headers,
          reportProgress: true,
          observe: 'events',
        })
        .pipe(timeout(30000))
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              const pct = Math.round((100 * event.loaded) / event.total);
              this.progress.set(pct);
            } else if (event.type === HttpEventType.Response) {
              resolve(event.body);
            }
          },
          error: (e) => reject(e),
        });
      });

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map((x: any) => x?.descError || x?.msgError)
          ?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'Error al crear el trabajo.');
      }

      const nuevoId = res?.data?.id;
      if (nuevoId) this.router.navigate(['/trabajos', nuevoId]);
      else this.router.navigate(['/trabajos']);

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La carga tardó demasiado. Intenta de nuevo.');
      else {
        const apiMsgs = e?.error?.error?.map((x: any) => x?.descError || x?.msgError)
          ?.filter(Boolean)?.join(' | ');
        this.error.set(apiMsgs || e?.error?.message || e?.message || 'No se pudo crear el trabajo.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
