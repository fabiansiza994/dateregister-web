import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';

interface ApiOk<T = any> {
  dataResponse?: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: T;
  message?: string;
  error?: Array<{ msgError?: string; descError?: string }>;
}

interface UsuarioProfileDTO {
  id: number;
  usuario: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  grupoId?: number | null;
  grupoNombre?: string | null;
  rolId?: number | null;
  rolNombre?: string | null;
  bloqueado?: boolean;
}

interface UpdateProfileRequest {
  nombre: string;
  apellido: string;
  email: string;
  grupoId: number | null;
  rolId: number | null;
  activo: boolean; // UI only (maps to !bloqueado)
}

interface Grupo { id: number; nombre: string; }
interface Rol { id: number; nombre: string; }

@Component({
  selector: 'app-usuario-editar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuario-editar.html',
  styleUrls: ['./usuario-editar.css'],
})
export class UsuarioEditarComponent implements OnInit {
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  // datos mostrados
  usuario = signal<UsuarioProfileDTO | null>(null);

  // formulario
  model = signal<UpdateProfileRequest>({ nombre: '', apellido: '', email: '', grupoId: null, rolId: null, activo: true });

  grupos = signal<Grupo[]>([]);
  roles  = signal<Rol[]>([]);
  newPassword = signal<string>('');

  private apiBase = '';
  private id: number | null = null;
  private initialSnapshot = '';
  cancelConfirmOpen = signal(false);

  title = computed(() => {
    const u = this.usuario();
    return u ? `Editar usuario: ${u.usuario}` : 'Editar usuario';
  });

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cfg: ConfigService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('ID inválido.');
      return;
    }
    this.id = id;
    // Cargar catálogos (roles fijos)
    this.loadGrupos();
    this.roles.set([
      { id: 2, nombre: 'USER' },
      { id: 1, nombre: 'ADMIN' },
    ]);
    this.loadUser(id);
  }

  // Helpers para template bidireccional
  setModel<K extends keyof UpdateProfileRequest>(key: K, value: UpdateProfileRequest[K]) {
    const curr = this.model();
    this.model.set({ ...curr, [key]: value });
  }

  private buildDetailUrl(id: number) { return `${this.apiBase}/user/detail/${id}`; }   // GET (más campos)
  private buildUpdateUrl(id: number) { return `${this.apiBase}/user/update/${id}`; }   // PUT UsuarioUpdateDTO

  async loadUser(id: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (!this.apiBase) throw new Error('Config no cargada: falta apiBaseUrl');
      // Preferimos detail por traer rol/grupo/bloqueado
      const url = this.buildDetailUrl(id); // GET /user/detail/{id}
      const res = await firstValueFrom(this.http.get<ApiOk<UsuarioProfileDTO>>(url).pipe(timeout(12000)));

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.msgError || x?.descError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No fue posible cargar el usuario.');
      }

      const u = res?.data;
      if (!u) throw new Error('Respuesta sin datos.');
      this.usuario.set(u);
      this.model.set({
        nombre: u.nombre || '',
        apellido: u.apellido || '',
        email: u.email || '',
        grupoId: (u.grupoId ?? null) as any,
        rolId: (u.rolId ?? null) as any,
        activo: !(u.bloqueado ?? false),
      });
      // snapshot para detectar cambios del usuario al cancelar
      this.initialSnapshot = JSON.stringify(this.model());
    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La carga tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.message || e?.message || 'Error al cargar el usuario.');
    } finally {
      this.loading.set(false);
    }
  }

  async save() {
    const id = this.id;
    if (!id) { this.error.set('No se pudo determinar el ID.'); return; }
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const url = this.buildUpdateUrl(id); // PUT /user/update/{id}
      const m = this.model();
      const u = this.usuario();
      const body: any = {
        nombre: m.nombre,
        apellido: m.apellido,
        email: m.email,
      };
      if (m.grupoId != null) body.grupoId = m.grupoId;
      if (m.rolId != null) body.rolId = m.rolId;
      // Solo enviar bloqueado si cambió respecto al original (para respetar "si no viene, no se toca")
      const newBloq = !m.activo;
      if (u && (u.bloqueado ?? false) !== newBloq) body.bloqueado = newBloq;

  const pwd = (this.newPassword() || '').trim();
  if (pwd) body.password = pwd;
  const res = await firstValueFrom(this.http.put<ApiOk<UsuarioProfileDTO>>(url, body).pipe(timeout(12000)));

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.msgError || x?.descError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No fue posible actualizar el usuario.');
      }

      this.success.set('✅ Usuario actualizado.');
      // si backend devuelve la entidad, refrescamos
      if (res?.data) {
        this.usuario.set(res.data);
      }
      // limpiar campo de password si se usó
      if (pwd) this.newPassword.set('');
      // Navegar al detalle después de un breve delay
      setTimeout(() => this.router.navigate(['/usuarios', id]), 600);
    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La actualización tardó demasiado.');
      else this.error.set(e?.error?.message || e?.message || 'No fue posible actualizar el usuario.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadGrupos() {
    try {
      const url = `${this.apiBase}/group/list`;
      const res = await firstValueFrom(this.http.get<ApiOk<{ items: Grupo[] }>>(url, { params: { page: 0 as any, size: 1000 as any, sortBy: 'nombre' as any, direction: 'ASC' as any } }).pipe(timeout(10000)));
      let items: Grupo[] = [];
      if (Array.isArray((res as any)?.data?.items)) items = (res as any).data.items as Grupo[];
      else if (Array.isArray(res?.data as any)) items = (res?.data as any) as Grupo[];
      this.grupos.set(items);
    } catch { /* silencioso */ }
  }

  // roles: fijos según especificación del sistema (USER id=2, ADMIN id=1)

  private isDirty(): boolean {
    try { return JSON.stringify(this.model()) !== this.initialSnapshot; } catch { return false; }
  }

  cancel() {
    if (this.isDirty()) {
      this.cancelConfirmOpen.set(true);
      return;
    }
    this.proceedCancel();
  }

  closeCancelConfirm() { if (!this.loading()) this.cancelConfirmOpen.set(false); }
  proceedCancel() {
    const id = this.id;
    this.cancelConfirmOpen.set(false);
    if (id) this.router.navigate(['/usuarios', id]);
    else this.router.navigate(['/usuarios']);
  }
}
