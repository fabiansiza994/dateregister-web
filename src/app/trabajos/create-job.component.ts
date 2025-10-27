import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
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
  dragging: Partial<Record<FotoKey, boolean>> = {};
  readingProgress: Partial<Record<FotoKey, number>> = {};
  private progressIntervals: Partial<Record<FotoKey, number>> = {};
  private readonly slotOrder: FotoKey[] = ['foto1', 'foto2', 'foto3', 'foto4'];
  draggingSlot: FotoKey | null = null;

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

  // Confirmación de eliminación de evidencia
  confirmOpen = signal(false);
  confirmTarget = signal<FotoKey | null>(null);
  // Confirmación visual para reemplazar (primer click oscurece y muestra botón)
  replaceTarget = signal<FotoKey | null>(null);
  // Confirmación de cancelar con cambios
  cancelConfirmOpen = signal(false);

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

    // Tomar snapshot inicial después del primer ciclo para comparar cambios
    this.setInitialSnapshotSoon();
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
      // Si estamos reemplazando una existente en edición, NO marcar eliminar; el nuevo archivo la sustituirá
      if (this.isEdit() && this.existingPhotos[key] && this.markedForDelete.has(key)) {
        this.markedForDelete.delete(key);
      }
      this.processFile(input.files[0], key);
      // Cerrar overlay de reemplazo si estaba activo
      if (this.replaceTarget() === key) this.replaceTarget.set(null);
    } else {
      delete this.files[key];
      delete this.previews[key];
      this.clearProgress(key);
    }
  }

  clearPhoto(key: FotoKey) {
    delete this.files[key];
    delete this.previews[key];
    this.clearProgress(key);
  }

  private processFile(file: File, key: FotoKey) {
    // Validaciones básicas
    const isImage = file.type?.startsWith('image/');
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (!isImage) { this.error.set('El archivo debe ser una imagen.'); return; }
    if (file.size > maxSize) { this.error.set('La imagen excede 10MB.'); return; }

    // Leer siempre para generar preview y, si aplica, comprimir
    const reader = new FileReader();
    // Arrancar barra enseguida para feedback inmediato
    this.readingProgress[key] = 3;
    reader.onloadstart = () => { this.readingProgress[key] = 5; };
    reader.onprogress = (e: ProgressEvent<FileReader>) => {
      if (e.lengthComputable && e.total > 0) this.readingProgress[key] = Math.min(85, Math.max(10, Math.round((e.loaded / e.total) * 80)));
      else this.readingProgress[key] = 25;
    };
    reader.onerror = () => {
      this.error.set('No se pudo leer la imagen.');
      delete this.files[key]; delete this.previews[key];
      this.clearProgress(key);
    };
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        // Preparar fase de compresión
        this.readingProgress[key] = Math.max(this.readingProgress[key] || 0, 88);
        this.startCompressionTicker(key);
        // Intentar comprimir si es JPEG grande
        const { outFile, outDataUrl } = await this.compressIfNeeded(file, dataUrl);
        this.files[key] = outFile;
        this.previews[key] = outDataUrl;
      } catch (e) {
        // Fallback a lo leído
        this.files[key] = file;
        this.previews[key] = reader.result as string;
      } finally {
        this.stopCompressionTicker(key);
        this.readingProgress[key] = 100;
        setTimeout(() => { this.clearProgress(key); }, 400);
      }
    };
    reader.readAsDataURL(file);
  }

  private loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
  }

  private async compressIfNeeded(file: File, dataUrl: string): Promise<{ outFile: File; outDataUrl: string }> {
    // Solo comprimir JPEG grandes; mantener PNG y otros como están
    const mime = (file.type || '').toLowerCase();
    const isJpeg = mime.includes('jpeg') || mime.includes('jpg');
    if (!isJpeg) return { outFile: file, outDataUrl: dataUrl };

    const img = await this.loadImageFromDataUrl(dataUrl);
    const maxW = 1920, maxH = 1080;
    let { width, height } = img;
    const scale = Math.min(1, Math.min(maxW / width, maxH / height));
    if (scale >= 1 && file.size <= 1.5 * 1024 * 1024) {
      // No hace falta comprimir ni redimensionar
      return { outFile: file, outDataUrl: dataUrl };
    }

    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { outFile: file, outDataUrl: dataUrl };
    ctx.drawImage(img, 0, 0, width, height);

    // Indicar progreso de procesado (aprox.)
    // No es medible exactamente, pero subimos a ~95% antes de convertir
    // el resto lo completará onloadend
    // (esto usa la llave de lectura actual, pero como no la conocemos aquí, lo dejamos al caller)

    const quality = 0.82;
    const outDataUrl = canvas.toDataURL('image/jpeg', quality);
    const outBlob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b || new Blob()), 'image/jpeg', quality));
    const outFile = new File([outBlob], file.name.replace(/\.(jpe?g|heic|heif)$/i, '') + '-compressed.jpg', { type: 'image/jpeg' });
    return { outFile, outDataUrl };
  }

  private startCompressionTicker(key: FotoKey) {
    this.stopCompressionTicker(key);
    const id = window.setInterval(() => {
      const curr = this.readingProgress[key] || 90;
      // Subimos lentamente hasta 97 para indicar actividad mientras el CPU trabaja
      this.readingProgress[key] = Math.min(97, curr + 1);
    }, 120);
    this.progressIntervals[key] = id as unknown as number;
  }
  private stopCompressionTicker(key: FotoKey) {
    const id = this.progressIntervals[key];
    if (id !== undefined) {
      clearInterval(id);
      delete this.progressIntervals[key];
    }
  }
  private clearProgress(key: FotoKey) {
    this.stopCompressionTicker(key);
    delete this.readingProgress[key];
  }

  onDrop(ev: DragEvent, key: FotoKey) {
    ev.preventDefault();
    this.dragging[key] = false;
    const dt = ev.dataTransfer;
    if (!dt) return;
    // Reordenar entre slots si viene del drag interno
    if (dt.types && Array.from(dt.types).includes('text/x-slot')) {
      const src = dt.getData('text/x-slot');
      if (this.isFotoKey(src) && src !== key) {
        this.swapSlots(src as FotoKey, key);
        if (dt) dt.dropEffect = 'move';
      }
      this.draggingSlot = null;
      return;
    }
    if (dt.files && dt.files.length > 0) {
      this.assignFiles(dt.files, key);
    }
  }

  onDragOver(ev: DragEvent, key: FotoKey) {
    ev.preventDefault();
    this.dragging[key] = true;
  }

  onDragLeave(ev: DragEvent, key: FotoKey) {
    ev.preventDefault();
    this.dragging[key] = false;
  }

  startReorder(ev: DragEvent, key: FotoKey) {
    if (ev.dataTransfer) {
      ev.dataTransfer.setData('text/x-slot', key);
      ev.dataTransfer.effectAllowed = 'move';
    }
    this.draggingSlot = key;
  }

  endReorder() { this.draggingSlot = null; }

  private isFotoKey(x: any): x is FotoKey {
    return x === 'foto1' || x === 'foto2' || x === 'foto3' || x === 'foto4';
  }

  private swapSlots(a: FotoKey, b: FotoKey) {
    const fA = this.files[a];
    const fB = this.files[b];
    const pA = this.previews[a];
    const pB = this.previews[b];

    if (fA) this.files[b] = fA; else delete this.files[b];
    if (fB) this.files[a] = fB; else delete this.files[a];

    if (pA) this.previews[b] = pA; else delete this.previews[b];
    if (pB) this.previews[a] = pB; else delete this.previews[a];

    delete this.readingProgress[a];
    delete this.readingProgress[b];
  }

  private assignFiles(fileList: FileList | File[], primary: FotoKey) {
    const arr: File[] = Array.from(fileList as any as File[]);
    const files: File[] = arr.filter((f: File): f is File => !!f && typeof f.type === 'string' && f.type.startsWith('image/'));
    if (files.length === 0) return;

    // 1) el primer archivo va al slot primario (reemplaza si había)
    this.processFile(files[0], primary);

    // 2) los demás van a los slots vacíos en orden
    const empties = this.slotOrder.filter(k => this.isSlotFree(k) && !this.files[k] && !this.previews[k] && k !== primary);
    let i = 1;
    for (const slot of empties) {
      if (i >= files.length) break;
      this.processFile(files[i], slot);
      i++;
    }
  }

  // Determina si un slot está disponible para nuevas cargas
  isSlotFree(key: FotoKey): boolean {
    if (!this.isEdit()) return true;
    return !this.existingPhotos[key] || this.markedForDelete.has(key);
  }

  // Cantidad de slots disponibles actualmente (considera edición y reemplazos)
  getFreeSlotsCount(): number {
    return this.slotOrder.filter(k => this.isSlotFree(k) && !this.files[k] && !this.previews[k]).length;
  }

  // UI acciones existentes
  openConfirm(key: FotoKey) {
    this.confirmTarget.set(key);
    this.confirmOpen.set(true);
  }
  cancelConfirm() { this.confirmOpen.set(false); this.confirmTarget.set(null); }
  confirmDelete() {
    const k = this.confirmTarget();
    if (!k) return;
    this.markedForDelete.add(k);
    // Liberar visualmente el slot y ocultar la miniatura actual
    delete this.existingPhotos[k];
    this.confirmOpen.set(false);
    this.confirmTarget.set(null);
  }

  openReplace(key: FotoKey) {
    // Si hay dropzone visible, usa ese input; si no, usa el input oculto de reemplazo
    const primaryId = `file-${key}`; // p. ej. file-foto1
    const replaceId = `replace-${key}`;
    const el = (document.getElementById(primaryId) || document.getElementById(replaceId)) as HTMLInputElement | null;
    if (el) el.click();
    // Oculta la capa armada
    if (this.replaceTarget() === key) this.replaceTarget.set(null);
  }

  armReplace(key: FotoKey) { this.replaceTarget.set(key); }
  cancelReplace() { this.replaceTarget.set(null); }

  // Cerrar overlay con tecla Escape
  @HostListener('document:keydown.escape', [])
  onEscClose() { if (this.replaceTarget()) this.cancelReplace(); }

  // Cerrar overlay al hacer click fuera de la tarjeta activa
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const key = this.replaceTarget();
    if (!key) return;
    const el = document.getElementById(`card-${key}`);
    if (!el) return;
    const target = ev.target as Node | null;
    if (target && el.contains(target)) return; // click dentro, no cerrar
    this.cancelReplace();
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
      if (e instanceof TimeoutError) {
        this.error.set('La carga tardó demasiado.');
      } else {
        // Intentar parsear estructura de error del backend
        const be = (e?.error ?? e) as any;
        const arr = Array.isArray(be?.error) ? be.error : null;
        if (arr && arr.length > 0) {
          const msgs = arr.map((it: any) => {
            const field = String(it?.msgError || '').trim();
            const msg = String(it?.descError || it?.codError || 'Error').trim();
            return field ? `${field}: ${msg}` : msg;
          }).filter(Boolean);
          this.error.set(msgs.join(' | '));
        } else {
          this.error.set(be?.message || e?.error?.message || e?.message || 'No se pudo crear el trabajo.');
        }
      }
      // Llevar al inicio para que el usuario vea el mensaje
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
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
      // Flags de eliminación esperadas por el backend (solo si no hay reemplazo en ese slot)
      const eliminarFoto1 = this.markedForDelete.has('foto1') && !this.files['foto1'];
      const eliminarFoto2 = this.markedForDelete.has('foto2') && !this.files['foto2'];
      const eliminarFoto3 = this.markedForDelete.has('foto3') && !this.files['foto3'];
      const eliminarFoto4 = this.markedForDelete.has('foto4') && !this.files['foto4'];

      const payload = { ...this.form, id: this.form.id, eliminarFoto1, eliminarFoto2, eliminarFoto3, eliminarFoto4 };
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
      if (e instanceof TimeoutError) {
        this.error.set('La actualización tardó demasiado.');
      } else {
        const be = (e?.error ?? e) as any;
        const arr = Array.isArray(be?.error) ? be.error : null;
        if (arr && arr.length > 0) {
          const msgs = arr.map((it: any) => {
            const field = String(it?.msgError || '').trim();
            const msg = String(it?.descError || it?.codError || 'Error').trim();
            return field ? `${field}: ${msg}` : msg;
          }).filter(Boolean);
          this.error.set(msgs.join(' | '));
        } else {
          this.error.set(be?.message || e?.error?.message || e?.message || 'No se pudo actualizar el trabajo.');
        }
      }
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    } finally {
      this.loading.set(false);
    }
  }

  // ===== Confirmación de salida si hay cambios =====
  private _initialSnapshot = '';
  private setInitialSnapshotSoon() { try { setTimeout(() => { this._initialSnapshot = this.snapshot(); }, 0); } catch { /* noop */ } }
  private snapshot(): string {
    try {
      const snap = {
        form: this.form,
        selectedClientId: this.selectedClient?.id || 0,
        selectedPatientId: this.selectedPatient?.id || 0,
        files: Object.keys(this.files || {}),
        previews: Object.keys(this.previews || {}),
        marked: Array.from(this.markedForDelete.values()),
        existing: Object.keys(this.existingPhotos || {}).filter(k => (this.existingPhotos as any)[k]),
      };
      return JSON.stringify(snap);
    } catch { return ''; }
  }
  private hasChanges(): boolean {
    try { return this.snapshot() !== this._initialSnapshot; } catch { return false; }
  }

  /** Cancelar/Volver desde crear/editar trabajo, con confirmación si hay cambios */
  cancel() {
    if (this.loading()) return;
    const dirty = this.hasChanges();
    if (dirty) { this.cancelConfirmOpen.set(true); return; }
    try {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch { /* noop */ }
    this.router.navigate(['/trabajos']);
  }

  proceedCancel() {
    if (this.loading()) return;
    this.cancelConfirmOpen.set(false);
    try {
      if (window.history.length > 1) { window.history.back(); return; }
    } catch { /* noop */ }
    this.router.navigate(['/trabajos']);
  }
  closeCancelConfirm() { if (!this.loading()) this.cancelConfirmOpen.set(false); }
}
