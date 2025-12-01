import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

interface Paciente {
  id: number;
  nombre: string;
  apellido: string;
  documento: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  estado: string;
}

interface ClienteDetalle {
  id: number;
  identificacion: string;
  nombre: string;
  apellido: string;
  email?: string;
  direccion?: string;
  telefono?: string;
  estado: string;
  pacientes: Paciente[];
  razonSocial?: string;
  rut?: string | null;            // URL o null si no existe
  camaraComercio?: string | null; // URL o null si no existe
}

interface DetailOk {
  dataResponse: { idTx: string | null; response: 'SUCCESS' | 'ERROR' };
  data: ClienteDetalle;
  message: string;
}

@Component({
  selector: 'app-cliente-detalle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cliente-detalle.html',
})
export class ClienteDetalleComponent implements OnInit {

  private readonly _claims = signal<any | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  cliente = signal<ClienteDetalle | null>(null);
  pacientes = signal<Paciente[]>([]);
  // Modal PDF preview
  pdfModalOpen = signal(false);
  pdfModalUrl = signal<string | null>(null); // original URL (API)
  pdfModalTitle = signal<string>('Documento');
  pdfLoading = signal(false);
  pdfError = signal<string | null>(null);
  pdfObjectUrl: string | null = null; // blob object URL
  pdfSanitizedUrl = signal<SafeResourceUrl | null>(null);

  sector = computed(() => (this._claims()?.sector ?? '').toUpperCase());

  // Paginación simple para la tabla de pacientes (opcional)
  page = signal(1);
  pageSize = signal(10);
  totalPacientes = computed(() => this.pacientes().length);
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalPacientes() / this.pageSize())));
  visibles = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.pacientes().slice(start, start + this.pageSize());
  });

  private apiBase = '';
  private id!: number;

  constructor(
    private http: HttpClient,
    private httpBackend: HttpBackend,
    private cfg: ConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private sanitizer: DomSanitizer
  ) {   this._claims.set(this.auth.claims());}

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.id || Number.isNaN(this.id)) {
      this.error.set('ID de cliente inválido.');
      return;
    }
    this.loadDetail();
  }

  async loadDetail() {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const url = `${this.apiBase}/client/detail/${this.id}`;
      const res = await firstValueFrom(
        this.http.get<DetailOk>(url).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: res } as any;
      }

      const c = res?.data;
      this.cliente.set(c ?? null);
      this.pacientes.set(c?.pacientes ?? []);
      // Normaliza página si quedó fuera de rango
      if (this.page() > this.totalPages()) this.page.set(this.totalPages());
    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
      } else {
        const apiMsgs = e?.error?.error
          ?.map((x: any) => x?.descError || x?.msgError)
          ?.filter(Boolean)?.join(' | ');
        this.error.set(apiMsgs || e?.error?.message || e?.message || 'No se pudo cargar el detalle del cliente.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  // Navegación
  volver() { this.router.navigate(['/clientes']); }

  // Abrir modal PDF
  openPdf(url: string | null, title: string) {
    if (!url) return;
    this.pdfModalTitle.set(title);
    this.pdfModalUrl.set(url);
    this.pdfModalOpen.set(true);
    this.loadPdfBlob(url);
  }
  closePdf() {
    if (!this.loading()) {
      this.pdfModalOpen.set(false);
      this.pdfModalUrl.set(null);
      this.pdfError.set(null);
      this.pdfSanitizedUrl.set(null);
      if (this.pdfObjectUrl) { URL.revokeObjectURL(this.pdfObjectUrl); this.pdfObjectUrl = null; }
    }
  }

  private async loadPdfBlob(url: string) {
    this.pdfLoading.set(true);
    this.pdfError.set(null);
    // revoke previous
    if (this.pdfObjectUrl) { URL.revokeObjectURL(this.pdfObjectUrl); this.pdfObjectUrl = null; }
    try {
      // Usar HttpClient sin interceptores para evitar adjuntar token (S3 falla con Authorization)
      const nakedHttp = new HttpClient(this.httpBackend);
      const blob = await firstValueFrom(nakedHttp.get(url, { responseType: 'blob' }).pipe(timeout(15000)));
      if (blob.type && blob.type !== 'application/pdf') {
        throw new Error('El recurso no es un PDF válido');
      }
      this.pdfObjectUrl = URL.createObjectURL(blob);
      this.pdfSanitizedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl));
    } catch (e: any) {
      this.pdfError.set(e?.message || 'No se pudo cargar el documento');
    } finally {
      this.pdfLoading.set(false);
    }
  }

  // Paginación
  goToPage(n: number) {
    const tp = this.totalPages();
    if (n < 1 || n > tp) return;
    this.page.set(n);
  }
  prevPage() { this.goToPage(this.page() - 1); }
  nextPage() { this.goToPage(this.page() + 1); }
}