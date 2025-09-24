import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
}

interface DetailOk {
  dataResponse: { idTx: string | null; response: 'SUCCESS' | 'ERROR' };
  data: ClienteDetalle;
  message: string;
}

@Component({
  selector: 'app-cliente-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cliente-detalle.html',
})
export class ClienteDetalleComponent implements OnInit {

  private readonly _claims = signal<any | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  cliente = signal<ClienteDetalle | null>(null);
  pacientes = signal<Paciente[]>([]);

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
    private cfg: ConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService
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

  // Paginación
  goToPage(n: number) {
    const tp = this.totalPages();
    if (n < 1 || n > tp) return;
    this.page.set(n);
  }
  prevPage() { this.goToPage(this.page() - 1); }
  nextPage() { this.goToPage(this.page() + 1); }
}