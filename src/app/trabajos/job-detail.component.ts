import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ===== Estados (fuente única) =====
export type EstadoValue =
  | 'PENDIENTE' | 'EN CURSO' | 'EN REVISION' | 'REVISADO'
  | 'PAGO' | 'FINALIZADO' | 'CANCELADO' | 'DEVUELTO' | 'PROGRAMADO' | 'NO ASISTE';

export interface EstadoOption {
  value: EstadoValue;
  label: string;
  badgeClass: string;
}

export const ESTADO_OPTIONS: EstadoOption[] = [
  { value: 'PENDIENTE', label: '⏳ Pendiente', badgeClass: 'badge bg-warning-subtle text-dark' },
  { value: 'PROGRAMADO', label: '🗓️ Programado', badgeClass: 'badge bg-primary-subtle text-dark' },
  { value: 'EN CURSO', label: '🔧 En curso', badgeClass: 'badge bg-info-subtle text-dark' },
  { value: 'EN REVISION', label: '🧪 En revisión', badgeClass: 'badge bg-secondary-subtle text-dark' },
  { value: 'REVISADO', label: '🔍 Revisado', badgeClass: 'badge bg-secondary-subtle text-dark' },
  { value: 'PAGO', label: '✅ Pago', badgeClass: 'badge bg-success-subtle text-dark' },
  { value: 'FINALIZADO', label: '🏁 Finalizado', badgeClass: 'badge bg-success-subtle text-dark' },
  { value: 'CANCELADO', label: '❌ Cancelado', badgeClass: 'badge bg-danger-subtle' },
  { value: 'DEVUELTO', label: '↩️ Devuelto', badgeClass: 'badge bg-dark-subtle text-dark' },
  { value: 'NO ASISTE', label: '🚫 No asiste', badgeClass: 'badge bg-dark-subtle text-dark' },
];

// ====== Tipos de tu modelo ======
interface FormaPago { id: number; formaPago: string; estado?: number; }
interface ClienteMin { id: number; nombre: string; apellido?: string | null; }
interface UsuarioMin {
  id: number;
  usuario?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
}
interface PacienteMin {
  id: number;
  nombre: string;
  apellido?: string | null;
  documento?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  clienteId?: number | null;
  estado?: string | null;
}

interface TrabajoDetail {
  id: number;
  fecha: string;               // "YYYY-MM-DD"
  valorTotal: number;
  descripcionLabor: string;
  cliente: ClienteMin | null;
  formaPago: FormaPago | null;
  usuario?: UsuarioMin | null;
  paciente?: PacienteMin | null;
  valorLabor?: number | null;
  valorMateriales?: number | null;
  ganancias?: number | null;
  foto1?: string | null;
  foto2?: string | null;
  foto3?: string | null;
  foto4?: string | null;
  estado?: EstadoValue | string;
}

interface JobDetailOk {
  dataResponse: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: TrabajoDetail;
  message?: string;
  error?: Array<{ descError?: string; msgError?: string }>;
}

@Component({
  selector: 'app-trabajo-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trabajo-detalle.html',
  styleUrls: ['./job-detail.component.css'],
})
export class JobDetailComponent implements OnInit {

  // ===== Claims / sector
  private readonly _claims = signal<any | null>(null);
  sector = computed(() => (this._claims()?.sector ?? '').toUpperCase());

  // ===== UI
  loading = signal(true);
  error = signal<string | null>(null);

  // ===== Data
  job = signal<TrabajoDetail | null>(null);

  // ===== Derived
  id = signal<number | null>(null);

  private apiBase = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router,
    private auth: AuthService
  ) {
    this._claims.set(this.auth.claims());
  }

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
    if (!id) {
      this.error.set('ID inválido.');
      this.loading.set(false);
      return;
    }
    this.id.set(id);
    this.loadDetail(id);
  }

  canSeeGanancias = computed(() => {
    const j = this.job();
    if (!j?.usuario?.id) return false;
    const viewer = this.viewerId();
    if (viewer == null) return false;
    return j.usuario.id === Number(viewer);
  });

  private viewerId(): number | null {
    const c = this._claims();
    // Ajusta estos posibles nombres de campo según tus claims reales:
    return (
      c?.id ??
      c?.userId ??
      c?.usuarioId ??
      c?.sub ?? // si tu "sub" es numérico
      null
    ) as number | null;
  }


  private htmlToPlainText(html: string): string {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private htmlListToBullets(html: string): string {
    return html
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n');
  }

  // ========= PDF =========
  downloadPdf() {
    const j = this.job();
    if (!j) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    // --- Encabezado / Empresa ---
    const empresa = this._claims()?.empresa || 'DataRegister';
    const fecha = j.fecha || '';
    const id = j.id;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(String(empresa), 40, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Detalle de trabajo #${id}`, 40, 70);
    doc.text(`Fecha: ${fecha}`, 40, 86);

    // --- Cliente o Paciente ---
    const sector = this.sector();
    let persona = '—';
    if (sector === 'SALUD' && j.paciente) {
      persona = `${j.paciente.nombre ?? ''} ${j.paciente.apellido ?? ''}`.trim() || '—';
      doc.text(`Paciente: ${j.paciente.documento} ${persona}`, 40, 102);
    } else if (j.cliente) {
      persona = `${j.cliente.nombre ?? ''} ${j.cliente.apellido ?? ''}`.trim() || '—';
      doc.text(`Cliente: ${persona}`, 40, 102);
    } else {
      doc.text(`Cliente/Paciente: —`, 40, 102);
    }

    const mop = j.formaPago?.formaPago || '—';
    const estado = j.estado || '—';
    doc.text(`Forma de pago: ${mop}`, 40, 118);
    doc.text(`Estado: ${estado}`, 40, 134);

    // --- Descripción (multilínea) ---
    const pre = this.htmlListToBullets(j.descripcionLabor || '');
    const descPlain = this.htmlToPlainText(pre);
    doc.setFont('helvetica', 'bold');
    doc.text('Descripción:', 40, 164);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(descPlain || '—', 515);
    doc.text(descLines, 40, 180);

    // --- Tabla de valores ---
    const manoObra = j.valorLabor ?? 0;
    const materiales = j.valorMateriales ?? 0;
    const total = typeof j.valorTotal === 'number'
      ? j.valorTotal
      : (Number(manoObra || 0) + Number(materiales || 0));

    const fmt = (n: number | null | undefined) => this.formatMoney(Number(n ?? 0));

    // Armamos filas según permisos
    const body: Array<[string, string]> = [
      ['Mano de obra', fmt(manoObra)],
      ['Materiales', fmt(materiales)],
      ['Total', fmt(total)],
    ];


    if (this.canSeeGanancias()) {
      const ganancias = this.gananciasCalc(j);
      body.splice(2, 0, ['Ganancias', fmt(ganancias)]); // opcional: insertarla antes de Total
    }

    autoTable(doc, {
      startY: 220 + (descLines.length > 1 ? (descLines.length - 1) * 12 : 0),
      head: [['Concepto', 'Valor']],
      body: [
        ['Mano de obra', fmt(manoObra)],
        ['Materiales', fmt(materiales)],
        ['Total', fmt(total)],
      ],
      styles: { font: 'helvetica', fontSize: 10 },
      headStyles: { fillColor: [230, 230, 230] },
      theme: 'striped',
      margin: { left: 40, right: 40 },
      tableWidth: 515,
      columnStyles: { 1: { halign: 'right' } }
    });

    // --- Pie ---
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('Generado por DataRegister', 40, pageH - 30);

    const nombre = `detalle_trabajo_${id}_${fecha}.pdf`;
    doc.save(nombre);
  }

  estadoBadge(estado?: string) {
    const s = (estado || '').toUpperCase() as EstadoValue;
    const found = ESTADO_OPTIONS.find(o => o.value === s);
    return found?.badgeClass || 'badge bg-light text-dark';
  }

  async loadDetail(id: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const url = `${this.apiBase}/job/detail/${id}`;
      const res = await firstValueFrom(
        this.http.get<JobDetailOk>(url).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.descError || x?.msgError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No se pudo cargar el trabajo.');
      }

      const data = res?.data;
      if (!data) throw new Error('Respuesta sin datos.');

      this.job.set(data);

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.message || e?.message || 'Error al cargar el trabajo.');
    } finally {
      this.loading.set(false);
    }
  }

  // ========= Helpers UI =========
  formatMoney(n: number | null | undefined) {
    if (n == null) return '—';
    try {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    } catch { return `$${n}`; }
  }

  totalCalc(j: TrabajoDetail | null) {
    if (!j) return 0;
    if (typeof j.valorTotal === 'number') return j.valorTotal;
    const mano = Number(j.valorLabor ?? 0);
    const mat = Number(j.valorMateriales ?? 0);
    return mano + mat;
  }

  gananciasCalc(j: TrabajoDetail | null) {
    if (!j) return 0;
    if (typeof j.ganancias === 'number') return j.ganancias!;
    const total = this.totalCalc(j);
    const mat = Number(j.valorMateriales ?? 0);
    return total - mat;
  }

  backToList() { this.router.navigate(['/trabajos']); }
  goToEdit() { const id = this.id(); if (id) this.router.navigate(['/trabajos', id, 'editar']); }
}
