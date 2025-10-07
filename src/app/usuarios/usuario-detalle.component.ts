import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

interface UsuarioDetailDTO {
  id: number;
  nombre: string;
  apellido: string;
  usuario: string;
  email: string;
  grupoId: number | null;
  grupoNombre: string | null;
  rolId: number | null;
  rolNombre: string | null;
  intentosFallidos: number;
  bloqueado: boolean;
}

interface UserDetailOk {
  dataResponse: { response: 'SUCCESS' | 'ERROR'; idTx?: string | null };
  data?: UsuarioDetailDTO;
  message?: string;
  error?: Array<{ descError?: string; msgError?: string }>;
}

@Component({
  selector: 'app-usuario-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: '/usuario-detalle.html',
})
export class UsuarioDetalleComponent implements OnInit {

  loading = signal(true);
  error = signal<string | null>(null);
  usuario = signal<UsuarioDetailDTO | null>(null);

  private apiBase = '';
  private id: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
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
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');
      const url = `${this.apiBase}/user/detail/${id}`;
      const res = await firstValueFrom(
        this.http.get<UserDetailOk>(url).pipe(timeout(12000))
      );

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.descError || x?.msgError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No se pudo cargar el usuario.');
      }

      if (!res?.data) throw new Error('Respuesta sin datos.');
      this.usuario.set(res.data);

    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La consulta tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.message || e?.message || 'Error al cargar el usuario.');
    } finally {
      this.loading.set(false);
    }
  }

  backToList() { this.router.navigate(['/usuarios']); }
  goToEdit() { if (this.id) this.router.navigate(['/usuarios', this.id, 'editar']); }

  badgeBloqueado(u: UsuarioDetailDTO | null) {
    if (!u) return 'badge bg-secondary-subtle text-dark';
    return u.bloqueado ? 'badge bg-danger-subtle' : 'badge bg-success-subtle text-dark';
  }
}
