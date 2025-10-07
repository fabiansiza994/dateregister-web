import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';
import { AngularEditorModule, AngularEditorConfig } from '@kolkov/angular-editor';
import { ClientPickerComponent } from '../shared/client-picker.component';
import { PatientPickerComponent } from '../shared/patient-picker.component';

type FotoKey = 'foto1' | 'foto2' | 'foto3' | 'foto4';

/** === Estados (extiende tu tipo original) === */
export type JobEstado =
  | 'PENDIENTE' | 'EN CURSO' | 'EN REVISION' | 'REVISADO'
  | 'PAGO' | 'FINALIZADO' | 'CANCELADO' | 'DEVUELTO' | 'PROGRAMADO' | 'NO ASISTE';

interface EstadoOption {
  value: JobEstado;
  label: string;        // con emoji para UX bonito
  badgeClass: string;   // reutilizable si luego quieres pintar badges
}

/** Fuente única para todos los estados */
export const ESTADO_OPTIONS: EstadoOption[] = [
  { value: 'PENDIENTE',    label: '⏳ Pendiente',     badgeClass: 'badge bg-warning-subtle text-dark' },
  { value: 'PROGRAMADO',   label: '🗓️ Programado',   badgeClass: 'badge bg-primary-subtle text-dark' },
  { value: 'EN CURSO',     label: '🔧 En curso',      badgeClass: 'badge bg-info-subtle text-dark' },
  { value: 'EN REVISION',  label: '🧪 En revisión',   badgeClass: 'badge bg-secondary-subtle text-dark' },
  { value: 'REVISADO',     label: '🔍 Revisado',      badgeClass: 'badge bg-secondary-subtle text-dark' },
  { value: 'PAGO',         label: '✅ Pago',          badgeClass: 'badge bg-success-subtle text-dark' },
  { value: 'FINALIZADO',   label: '🏁 Finalizado',    badgeClass: 'badge bg-success-subtle text-dark' },
  { value: 'CANCELADO',    label: '❌ Cancelado',     badgeClass: 'badge bg-danger-subtle' },
  { value: 'DEVUELTO',     label: '↩️ Devuelto',      badgeClass: 'badge bg-dark-subtle text-dark' },
  { value: 'NO ASISTE',    label: '🚫 No asiste',     badgeClass: 'badge bg-dark-subtle text-dark' },
];

interface CreateJobPayload {
  id?: number;
  fecha: string;
  valorLabor?: number;
  valorMateriales?: number;
  valorTotal: number;
  ganancias?: number;
  descripcionLabor: string;
  clienteId: number;
  pacienteId?: number;
  formaPagoId: number;
  estado?: JobEstado;
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

interface JobDetail {
  id: number;
  fecha: string;
  valorTotal: number;
  descripcionLabor: string;
  cliente?: { id: number; nombre: string; apellido?: string | null } | null;
  paciente?: { id: number; nombre: string; apellido?: string | null; clienteId?: number | null } | null;
  formaPago?: { id: number; formaPago: string } | null;
  valorLabor?: number | null;
  valorMateriales?: number | null;
  ganancias?: number | null;
  estado?: JobEstado | null;
  foto1?: string | null;
  foto2?: string | null;
  foto3?: string | null;
  foto4?: string | null;
}

interface JobDetailOk {
  dataResponse: { response: 'SUCCESS' | 'ERROR'; idTx?: string | null };
  data?: JobDetail;
  message?: string;
  error?: Array<{ descError?: string; msgError?: string }>;
}

@Component({
  selector: 'app-crear-trabajo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClientPickerComponent, PatientPickerComponent, AngularEditorModule],
  templateUrl: './create-job.html',
  styleUrls: ['./create-job.css'],
})
export class CreateJobComponent implements OnInit {

  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: '200px',
    minHeight: '0',
    placeholder: 'Escribe la descripción de la labor...',
    translate: 'no',
    defaultParagraphSeparator: 'p',
    toolbarHiddenButtons: [
      [
        'insertImage', 'insertVideo', 'insertHorizontalRule',
        'insertOrderedList', 'insertUnorderedList', 'link'
      ],
      ['toggleEditorMode'],
      [
        'strikeThrough', 'superscript', 'subscript',
        'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
        'indent', 'outdent', 'heading'
      ]
    ],
    toolbarPosition: 'top'
  };

  private readonly _claims = signal<any | null>(null);
  sector = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  role = computed(() => (this._claims()?.role ?? '').toUpperCase());
  empresa = computed(() => this._claims()?.empresa ?? '');
  empresaId = computed(() => Number(this._claims()?.empresaId ?? 0) || 0);
  user = computed(() => this._claims()?.sub ?? '');

  private _jobId = signal<number | null>(null);
  isEdit = computed(() => this._jobId() !== null);

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
    estado: undefined,
  };

  files: Partial<Record<FotoKey, File>> = {};
  previews: Partial<Record<FotoKey, string>> = {};
  existingPhotos: Partial<Record<FotoKey, string>> = {};
  markedForDelete = new Set<FotoKey>();

  loading = signal(false);
  error = signal<string | null>(null);
  progress = signal(0);

  clientModalOpen = signal(false);
  selectedClient: ClienteLite | null = null;

  patientModalOpen = signal(false);
  selectedPatient: PacienteLite | null = null;

  mopLoading = signal(false);
  formasPago: FormaPago[] = [];

  apiBase = '';

  /** Reutiliza la fuente única */
  readonly estadoOptions = ESTADO_OPTIONS;

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router,
    private auth: AuthService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());

    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;
    if (!Number.isNaN(id)) {
      this._jobId.set(id);
    }

    if (!this.isEdit()) {
      this.form.fecha = this.todayStr();
    }

    this.loadFormasPago(this.empresaId());
    this.recalc();

    if (this.isEdit()) {
      this.loadDetail(this._jobId()!);
    }
  }

  private todayStr(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  totalCalc(): number { return this.num(this.form.valorLabor) + this.num(this.form.valorMateriales); }
  gananciasCalc(): number { return this.totalCalc() - this.num(this.form.valorMateriales); }
  recalc(): void {
    this.form.valorTotal = this.totalCalc();
    this.form.ganancias = this.gananciasCalc();
  }

  private nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

  formatPeso(v?: number | null): string {
    const n = Number(v ?? 0);
    return this.nf.format(Number.isFinite(n) ? Math.trunc(n) : 0);
  }

  parsePeso(input: any): number {
    const raw = String(input ?? '')
      .replace(/\s+/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.');
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  onMoneyInput<K extends 'valorLabor' | 'valorMateriales'>(key: K, value: string) {
    this.form[key] = this.parsePeso(value);
    this.recalc();
  }

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

  toggleDelete(foto: FotoKey) {
    if (this.markedForDelete.has(foto)) {
      this.markedForDelete.delete(foto);
    } else {
      this.markedForDelete.add(foto);
    }
  }

  resetForm() {
    const keepId = this.isEdit() ? this._jobId()! : undefined;
    this.form = {
      id: keepId,
      fecha: this.isEdit() ? '' : this.todayStr(),
      valorLabor: undefined,
      valorMateriales: undefined,
      valorTotal: 0,
      ganancias: undefined,
      descripcionLabor: '',
      clienteId: 0,
      pacienteId: undefined,
      formaPagoId: 0,
      estado: this.isEdit() ? 'PENDIENTE' : undefined,
    };
    this.files = {};
    this.previews = {};
    this.existingPhotos = {};
    this.markedForDelete.clear();
    this.error.set(null);
    this.progress.set(0);
    this.selectedClient = null;
    this.selectedPatient = null;
    this.recalc();
  }

  private validate(): string | null {
    if (!this.form.fecha) return 'La fecha es obligatoria.';
    if (!this.form.descripcionLabor?.trim()) return 'La descripción es obligatoria.';
    if (!this.form.formaPagoId) return 'Debes seleccionar una forma de pago.';
    if (!(this.num(this.form.valorTotal) >= 0)) return 'El valor total no es válido.';
    if (!this.form.clienteId) {
      if (this.sector() === 'SALUD') {
        return 'El paciente no tiene cliente asociado. Selecciona otro paciente.';
      }
      return 'Debes seleccionar un cliente.';
    }
    if (this.sector() === 'SALUD' && !this.form.pacienteId) {
      return 'Debes seleccionar un paciente.';
    }
    return null;
  }

  openClientModal() { this.clientModalOpen.set(true); }
  onClientPicked(c: ClienteLite) {
    this.selectedClient = { id: c.id, nombre: c.nombre, apellido: c.apellido ?? null };
    this.form.clienteId = c.id;
    this.clientModalOpen.set(false);
  }
  onClientClose() { this.clientModalOpen.set(false); }
  clearClient() { this.selectedClient = null; this.form.clienteId = 0; }

  openPatientModal() { this.patientModalOpen.set(true); }
  onPatientPicked(p: PacienteLite) {
    this.selectedPatient = { id: p.id, nombre: p.nombre, apellido: p.apellido ?? null };
    this.form.clienteId = Number(p.clienteId ?? 0) || 0;
    this.form.pacienteId = p.id;
    this.patientModalOpen.set(false);
  }
  onPatientClose() { this.patientModalOpen.set(false); }
  clearPatient() { this.selectedPatient = null; this.form.pacienteId = undefined; }

  async loadFormasPago(id: number) {
    if (!this.apiBase) return;
    this.mopLoading.set(true);
    try {
      const url = `${this.apiBase}/mop/list/${id}`;
      const res: any = await firstValueFrom(this.http.get(url).pipe(timeout(10000)));
      this.formasPago = res?.data ?? [];
    } catch {
      this.formasPago = [];
    } finally {
      this.mopLoading.set(false);
    }
  }

  async loadDetail(jobId: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${this.apiBase}/job/detail/${jobId}`;
      const res = await firstValueFrom(this.http.get<JobDetailOk>(url).pipe(timeout(12000)));
      if (res?.dataResponse?.response === 'ERROR') {
        const api = res?.error?.map(x => x?.descError || x?.msgError)?.join(' | ');
        throw new Error(api || res?.message || 'No fue posible cargar el trabajo.');
      }
      const j = res?.data!;
      this.form = {
        id: j.id,
        fecha: j.fecha,
        descripcionLabor: j.descripcionLabor,
        valorLabor: j.valorLabor ?? undefined,
        valorMateriales: j.valorMateriales ?? undefined,
        valorTotal: j.valorTotal,
        ganancias: j.ganancias ?? undefined,
        clienteId: j.cliente?.id ?? 0,
        pacienteId: j.paciente?.id ?? undefined,
        formaPagoId: j.formaPago?.id ?? 0,
        /** 🔹 Aquí tomamos el estado del backend y lo mapeamos al tipo extendido */
        estado: (j.estado as JobEstado) ?? 'PENDIENTE',
      };
      this.selectedClient = j.cliente ? { id: j.cliente.id, nombre: j.cliente.nombre, apellido: j.cliente.apellido ?? null } : null;
      this.selectedPatient = j.paciente ? { id: j.paciente.id, nombre: j.paciente.nombre, apellido: j.paciente.apellido ?? null } : null;
      this.existingPhotos = {
        foto1: j.foto1 || undefined,
        foto2: j.foto2 || undefined,
        foto3: j.foto3 || undefined,
        foto4: j.foto4 || undefined,
      };
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Error al cargar el trabajo.');
    } finally {
      this.loading.set(false);
    }
  }

  async submit() {
    this.recalc();
    const v = this.validate();
    if (v) { this.error.set(v); return; }
    if (this.isEdit()) return this.update();
    return this.create();
  }

  async create() {
    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');
      const token = this.tokenStr;
      if (!token) { this.error.set('No hay sesión activa.'); return; }

      const fd = new FormData();
      fd.append('payload', new Blob([JSON.stringify(this.form)], { type: 'application/json' }));
      (['foto1', 'foto2', 'foto3', 'foto4'] as FotoKey[]).forEach(k => { if (this.files[k]) fd.append(k, this.files[k]!); });

      this.loading.set(true);
      this.progress.set(0);
      this.error.set(null);

      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const url = `${this.apiBase}/job/create`;

      await new Promise<void>((resolve, reject) => {
        this.http.post(url, fd, { headers, reportProgress: true, observe: 'events' })
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

      this.router.navigate(['/trabajos'], { state: { flash: '✅ Trabajo creado.' } });

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La carga tardó demasiado.');
      else this.error.set(e?.error?.message || e?.message || 'No se pudo crear el trabajo.');
    } finally {
      this.loading.set(false);
    }
  }

  async update() {
    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');
      const token = this.tokenStr;
      if (!token) { this.error.set('No hay sesión activa.'); return; }
      if (!this.form.id) { this.error.set('ID de trabajo inválido.'); return; }

      const fd = new FormData();
      const payload = { ...this.form, id: this.form.id, deleteFotos: Array.from(this.markedForDelete) };
      fd.append('payload', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      (['foto1', 'foto2', 'foto3', 'foto4'] as FotoKey[]).forEach(k => { if (this.files[k]) fd.append(k, this.files[k]!); });

      this.loading.set(true);
      this.progress.set(0);
      this.error.set(null);

      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const url = `${this.apiBase}/job/update/${this.form.id}`;

      await new Promise<void>((resolve, reject) => {
        this.http.put(url, fd, { headers, reportProgress: true, observe: 'events' })
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

      this.router.navigate(['/trabajos', this.form.id], { state: { flash: '✅ Cambios guardados.' } });

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La actualización tardó demasiado.');
      else this.error.set(e?.error?.message || e?.message || 'No se pudo actualizar el trabajo.');
    } finally {
      this.loading.set(false);
    }
  }
}
