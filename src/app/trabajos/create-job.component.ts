import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

import { ClientPickerComponent } from '../shared/client-picker.component';
import { PatientPickerComponent } from '../shared/patient-picker.component'; // <- añade este archivo como te pasé

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

interface FormaPago { id: number; formaPago: string; estado?: number; }

export interface ClienteLite {
  id: number;
  nombre: string;
  apellido?: string | null;
}

export interface PacienteLite {
  id: number;
  nombre: string;
  clienteId?: number | null;
  apellido?: string | null;
}

@Component({
  selector: 'app-crear-trabajo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClientPickerComponent, PatientPickerComponent],
  templateUrl: './create-job.html',
})
export class CreateJobComponent implements OnInit {
  // =========================
  // Claims como signals
  // =========================
  private readonly _claims = signal<any | null>(null);
  sector = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  role   = computed(() => (this._claims()?.role ?? '').toUpperCase());
  empresa = computed(() => this._claims()?.empresa ?? '');
  user    = computed(() => this._claims()?.sub ?? '');

  // =========================
  // Form model
  // =========================
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

  // archivos y previews
  files: Partial<Record<FotoKey, File>> = {};
  previews: Partial<Record<FotoKey, string>> = {};

  // UI state
  loading = signal(false);
  error = signal<string | null>(null);
  progress = signal(0);

  // Cliente (modal)
  clientModalOpen = signal(false);
  selectedClient: ClienteLite | null = null;

  // Paciente (modal)
  patientModalOpen = signal(false);
  selectedPatient: PacienteLite | null = null;

  // Formas de pago
  mopLoading = signal(false);
  formasPago: FormaPago[] = [];

  // Base de API
  apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');

    // Cargar claims desde AuthService (SIN usar token() externo)
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());

    this.loadFormasPago();
    this.recalc(); // inicializa totales
  }

  // =========================
  // Helpers numéricos/calculados
  // =========================
  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  totalCalc(): number {
    return this.num(this.form.valorLabor) + this.num(this.form.valorMateriales);
  }

  gananciasCalc(): number {
    return this.totalCalc() - this.num(this.form.valorMateriales);
  }

  recalc(): void {
    this.form.valorTotal = this.totalCalc();
    this.form.ganancias = this.gananciasCalc();
  }

  // =========================
  // Utilidades
  // =========================
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
    this.selectedPatient = null;
    this.recalc();
  }

  private validate(): string | null {
    if (!this.form.fecha) return 'La fecha es obligatoria.';
    if (!this.form.descripcionLabor?.trim()) return 'La descripción de la labor es obligatoria.';
    if (!this.form.formaPagoId) return 'Debes seleccionar una forma de pago.';
    if (!(this.num(this.form.valorTotal) >= 0)) return 'El valor total debe ser un número válido.';

    // siempre se requiere clienteId (tu backend lo necesita)
  if (!this.form.clienteId) {
    // si estabas en SALUD y elegiste paciente sin clienteId, lo explicitamos:
    if (this.sector() === 'SALUD') {
      return 'El paciente seleccionado no tiene cliente asociado (clienteId). Selecciona otro paciente o asócialo a un cliente.';
    }
    return 'Debes seleccionar un cliente.';
  }

    // Validación según sector (computed)
    if (this.sector() === 'SALUD') {
      if (!this.form.pacienteId) return 'Debes seleccionar un paciente.';
    } else {
      if (!this.form.clienteId) return 'Debes seleccionar un cliente.';
    }
    return null;
  }

  // =========================
  // Cliente (modal)
  // =========================
  openClientModal() { this.clientModalOpen.set(true); }
  onClientPicked(c: ClienteLite) {
    this.selectedClient = { id: c.id, nombre: c.nombre, apellido: c.apellido ?? null };
    this.form.clienteId = c.id;
    this.clientModalOpen.set(false);
  }
  onClientClose() { this.clientModalOpen.set(false); }
  clearClient() { this.selectedClient = null; this.form.clienteId = 0; }

  // =========================
  // Paciente (modal)
  // =========================
  openPatientModal() { this.patientModalOpen.set(true); }
  onPatientPicked(p: PacienteLite) {
    this.selectedPatient = { id: p.id, nombre: p.nombre, apellido: p.apellido ?? null };
    this.form.clienteId = Number(p.clienteId ?? 0) || 0;
    this.form.pacienteId = p.id;
    this.patientModalOpen.set(false);
  }
  onPatientClose() { this.patientModalOpen.set(false); }
  clearPatient() { this.selectedPatient = null; this.form.pacienteId = undefined; }

  // =========================
  // Formas de pago
  // =========================
  async loadFormasPago() {
    if (!this.apiBase) return;
    this.mopLoading.set(true);
    try {
      const url = `${this.apiBase}/mop/list`;                 // <- igual que tu versión original
      const res: any = await firstValueFrom(this.http.get(url).pipe(timeout(10000)));
      this.formasPago = res?.data ?? [];
    } catch {
      this.formasPago = [];
    } finally {
      this.mopLoading.set(false);
    }
  }

  // =========================
  // Crear trabajo
  // =========================
  async create() {
    // asegura que los campos calculados estén sincronizados
    this.recalc();

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

      await new Promise<void>((resolve, reject) => {
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
              resolve();
            }
          },
          error: (e) => reject(e),
          complete: () => resolve()
        });
      });

      // Éxito
      this.router.navigate(['/trabajos'], { state: { flash: '✅ Trabajo creado.' } });

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La carga tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.message || e?.message || 'No se pudo crear el trabajo.');
    } finally {
      this.loading.set(false);
    }
  }
}
