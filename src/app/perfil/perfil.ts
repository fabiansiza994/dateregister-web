import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

interface ApiOk<T = any> {
  dataResponse?: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: T;
  message?: string;
  error?: Array<{ msgError?: string; descError?: string }>;
}

interface PerfilEmpresa {
  id: number;
  nombre: string;
  sectorNombre?: string;
  paisNombre?: string;
}

interface PerfilGrupo { id: number; nombre: string; }
interface PerfilRol   { id: number; nombre: string; }

interface PerfilUsuario {
  id: number;
  nombre?: string;
  apellido?: string;
  usuario: string;
  email?: string;
  intentosFallidos?: number;
  bloqueado?: boolean;
  rol?: PerfilRol | null;
  grupo?: PerfilGrupo | null;
  empresa?: PerfilEmpresa | null;
}

interface UpdateProfileRequest {
  nombre: string;
  apellido: string;
  email: string;
}

interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html',
})
export class PerfilComponent implements OnInit {
  // ===== Claims
  private readonly _claims = signal<any | null>(null);
  empresaClaim = computed(() => this._claims()?.empresa ?? '—');
  roleClaim    = computed(() => (this._claims()?.role ?? '').toUpperCase());
  usernameClaim= computed(() => this._claims()?.sub ?? this._claims()?.usuario ?? 'usuario');

  // ID de usuario desde claims (ajusta si tus claims difieren)
  userId = computed<number | null>(() => {
    const c = this._claims();
    const possibles = [c?.userId, c?.id, c?.uid, c?.usuarioId].map(Number).filter(v => Number.isFinite(v) && v > 0);
    return possibles[0] ?? null;
  });

  // ===== UI
  loading = signal(false);
  error   = signal<string | null>(null);
  success = signal<string | null>(null);

  // ===== Datos
  me = signal<PerfilUsuario | null>(null);

  // ===== Form perfil
  model = signal<UpdateProfileRequest>({
    nombre:   '',
    apellido: '',
    email:    ''
  });

  // ===== Form password
  pwd  = signal<ChangePasswordRequest>({ oldPassword: '', newPassword: '' });
  pwd2 = signal<string>(''); // confirmación

  // ===== Derivados
  initials = computed(() =>
    this.mkInitials(this.me()?.nombre, this.me()?.apellido, this.usernameClaim())
  );

  private apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());

    const id = this.userId();
    if (!id) {
      this.error.set('No se pudo determinar tu ID de usuario desde la sesión.');
      return;
    }
    await this.loadProfile(id);
  }

  // ===== Helpers para actualizar signals desde el template
  setModel<K extends keyof UpdateProfileRequest>(key: K, value: UpdateProfileRequest[K]) {
    const curr = this.model();
    this.model.set({ ...curr, [key]: value });
  }
  setPwd<K extends keyof ChangePasswordRequest>(key: K, value: ChangePasswordRequest[K]) {
    const curr = this.pwd();
    this.pwd.set({ ...curr, [key]: value });
  }

  // ===== URLs (ajusta si tus endpoints difieren)
  private buildProfileUrl(id: number) { return `${this.apiBase}/user/profile/${id}`; }                 // GET/PUT
  private buildChangePasswordUrl(id: number) { return `${this.apiBase}/user/profile/${id}/change-password`; } // POST

  // ===== Cargar perfil
  async loadProfile(id: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = this.buildProfileUrl(id); // GET /user/profile/{id}
      const res = await firstValueFrom(this.http.get<ApiOk<PerfilUsuario>>(url).pipe(timeout(12000)));

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.msgError || x?.descError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No fue posible cargar tu perfil.');
      }

      const u = res?.data;
      if (!u) throw new Error('Respuesta sin datos.');

      this.me.set(u);
      this.model.set({
        nombre:   u.nombre   || '',
        apellido: u.apellido || '',
        email:    u.email    || ''
      });
    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La carga tardó demasiado. Intenta de nuevo.');
      else this.error.set(e?.error?.message || e?.message || 'No fue posible cargar tu perfil.');
    } finally {
      this.loading.set(false);
    }
  }

  // ===== Guardar perfil
  async saveProfile() {
    const id = this.me()?.id || this.userId();
    if (!id) { this.error.set('No se pudo determinar tu ID para actualizar.'); return; }
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const url = this.buildProfileUrl(id); // PUT /user/profile/{id}
      const res = await firstValueFrom(this.http.put<ApiOk<PerfilUsuario>>(url, this.model()).pipe(timeout(12000)));

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.msgError || x?.descError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No fue posible actualizar tu perfil.');
      }

      if (res?.data) this.me.set(res.data);
      else await this.loadProfile(id);

      this.success.set('✅ Perfil actualizado.');
      setTimeout(() => this.success.set(null), 1800);
    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La actualización tardó demasiado.');
      else this.error.set(e?.error?.message || e?.message || 'No fue posible actualizar tu perfil.');
    } finally {
      this.loading.set(false);
    }
  }

  // ===== Cambiar contraseña
  async changePassword() {
    const id = this.me()?.id || this.userId();
    if (!id) { this.error.set('No se pudo determinar tu ID para cambiar la contraseña.'); return; }
    if (this.loading()) return;

    if (!(this.pwd().oldPassword || '').trim()) {
      this.error.set('Debes ingresar tu contraseña actual.');
      return;
    }
    if (!(this.pwd().newPassword || '').trim()) {
      this.error.set('Debes ingresar la nueva contraseña.');
      return;
    }
    if (this.pwd().newPassword !== this.pwd2()) {
      this.error.set('La confirmación de la nueva contraseña no coincide.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const url = this.buildChangePasswordUrl(id); // POST /user/profile/{id}/change-password
      const res = await firstValueFrom(this.http.post<ApiOk>(url, this.pwd()).pipe(timeout(12000)));

      if (res?.dataResponse?.response === 'ERROR') {
        const apiMsgs = res?.error?.map(x => x?.msgError || x?.descError)?.filter(Boolean)?.join(' | ');
        throw new Error(apiMsgs || res?.message || 'No fue posible cambiar la contraseña.');
      }

      this.success.set('🔒 Contraseña actualizada.');
      this.pwd.set({ oldPassword: '', newPassword: '' });
      this.pwd2.set('');
      setTimeout(() => this.success.set(null), 1800);
    } catch (e: any) {
      if (e instanceof TimeoutError) this.error.set('La operación tardó demasiado.');
      else this.error.set(e?.error?.message || e?.message || 'No fue posible cambiar la contraseña.');
    } finally {
      this.loading.set(false);
    }
  }

  // ===== Util
  private mkInitials(nombre?: string, apellido?: string, fallback?: string) {
    const n = (nombre || '').trim();
    const a = (apellido || '').trim();
    if (n || a) return [n, a].filter(Boolean).map(s => s[0]?.toUpperCase() || '').join('').slice(0, 2) || 'U';
    const f = (fallback || '').trim();
    if (f) return f.slice(0, 2).toUpperCase();
    return 'U';
  }
}
