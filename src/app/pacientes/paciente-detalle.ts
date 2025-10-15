import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';

interface PacienteDetail {
  id: number;
  nombre: string;
  apellido?: string | null;
  documento?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  clienteId?: number | null;
  clienteNombre?: string | null;  // si tu BE lo devuelve
  estado?: string | null;         // 'ACTIVO' | 'INACTIVO'
}

interface DetailOk {
  dataResponse?: { idTx?: string | null; response?: 'SUCCESS' | 'ERROR' };
  data?: PacienteDetail;
  error?: Array<{ descError?: string; msgError?: string }>;
  message?: string;
}

@Component({
  selector: 'app-paciente-detalle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paciente-detalle.html'
})
export class PacienteDetalleComponent implements OnInit {
  loading = signal(true);
  error   = signal<string | null>(null);
  paciente = signal<PacienteDetail | null>(null);

  private apiBase = '';
  private id = 0;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error.set('ID inválido.');
      this.loading.set(false);
      return;
    }
    this.id = id;
    this.loadDetail(id);
  }

  async loadDetail(id: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${this.apiBase}/paciente/detail/${id}`;
      const res = await firstValueFrom(
        this.http.get<DetailOk>(url).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(e => e?.descError || e?.msgError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No se pudo cargar el paciente.');
      }

      if (!res?.data) throw new Error('Respuesta sin datos.');
      this.paciente.set(res.data);

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.message || e?.message || 'Error al cargar el paciente.');
    } finally {
      this.loading.set(false);
    }
  }

  backToList() { this.router.navigate(['/pacientes']); }
  goToEdit()   { if (this.id) this.router.navigate(['/pacientes', this.id, 'editar']); }
}