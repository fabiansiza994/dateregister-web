import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

// ====== Catálogos ======
interface Pais { id: number; nombre: string; codigoPais: string; }
interface PaisListOk { data: Pais[]; dataResponse: { response: 'SUCCESS' | 'ERROR' } }

interface Sector { id: number; nombre: string; }
interface SectorListOk { data: Sector[]; dataResponse: { response: 'SUCCESS' | 'ERROR' } }

// ====== Grupos (search) ======
interface ApiErrorItem { codError?: string; descError?: string; msgError?: string; }
interface GroupLite { id: number; nombre: string; }
interface GroupSearchOk {
  dataResponse: { response: 'SUCCESS' | 'ERROR' };
  data: { items: GroupLite[]; totalElements: number; page: number; size: number; totalPages: number; sort: string; query?: string; last: boolean; };
}

// ====== Create User ======
interface UsuarioAdminCreateRequest {
  usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  empresa: {
    id: number;          // 0 = nueva empresa
    nombre: string;
    nit: string;
    pais: { id: number | null };
    sector: { id: number | null };
  };
  grupo: { id: number | null };
  rol: { id: number };    // USER id=2
}
interface UsuarioCreateOk { dataResponse: { idTx: string | null; response: 'SUCCESS' | 'ERROR' }; data?: { id?: number } }
interface UsuarioCreateError { dataResponse?: { response?: 'ERROR' | 'SUCCESS' }; error?: ApiErrorItem[]; message?: string; }

@Component({
  selector: 'app-usuario-nuevo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuario-nuevo.html',
  styleUrls: ['./usuario-nuevo.css'],
})
export class UsuarioNuevoComponent implements OnInit {
  // Paso
  private _step = 1;
  get step() { return this._step; }

  // Modelo
  model = signal<UsuarioAdminCreateRequest>({
    usuario: '',
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    empresa: {
      id: 0,
      nombre: '',     // se setea desde claims
      nit: '',
      pais: { id: null },
      sector: { id: null },
    },
    grupo: { id: null },
    rol: { id: 2 },   // USER
  });

  // UI
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  // Confirmación de contraseña (solo UI)
  confirmPassword = signal('');
  passwordMismatch = computed(() => {
    const cp = this.confirmPassword();
    if (!cp) return false;
    return cp !== (this.model().password || '');
  });

  // Grupos (search)
  qGroup = '';
  grupos = signal<GroupLite[]>([]);
  loadingGrupos = signal(false);
  errorGrupos = signal<string | null>(null);
  totalGrupos = signal(0);

  // Catálogos
  paises = signal<Pais[]>([]);
  sectores = signal<Sector[]>([]);
  loadingPaises = signal(false);
  loadingSectores = signal(false);
  errorPaises = signal<string | null>(null);
  errorSectores = signal<string | null>(null);

  // ====== Lógica de autogenerar usuario (como en register) ======
  private userEditedUsername = false;

  private normalizeToken(s?: string): string {
    if (!s) return '';
    return s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')                     // solo letras/números/espacios
      .trim()
      .split(/\s+/)[0] || '';                          // primer token
  }

  private tokenize(s?: string): string[] {
    if (!s) return [];
    const cleaned = s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
    if (!cleaned) return [];
    return cleaned.split(/\s+/).filter(Boolean).slice(0, 2); // máximo 2 tokens
  }

  private computeUsername(): string {
    const first = this.normalizeToken(this.model().nombre);
    const last = this.normalizeToken(this.model().apellido);
    if (!first || !last) return '';
    return `${first}.${last}`;
  }

  updateSuggestedUser(): void {
    if (this.userEditedUsername) return; // no sobrescribir si el usuario ya editó
    const fTokens = this.tokenize(this.model().nombre);
    if (!fTokens.length) return;
    const lTokens = this.tokenize(this.model().apellido);
    const f1 = fTokens[0];
    const f2 = fTokens[1];
    const l1 = lTokens[0];
    // Base preferida determinista: first.last1 si existe, si no first.first2 si existe, si no first
    const base = l1 ? `${f1}.${l1}` : (f2 ? `${f1}.${f2}` : f1);
    const digits = this.randomDigits(5);
    const username = `${base}_${digits}`;
    const email = `${f1}_@${digits}.com`;
    this.model.update(m => ({ ...m, usuario: username, email }));
    this.clearFieldError('usuario');
    this.clearFieldError('email');
  }

  onUsuarioInput(): void {
    this.userEditedUsername = true;
  }

  invalidUsername = computed(() => {
    const u = this.model().usuario ?? '';
    if (!u) return false;
    // Debe cumplir: first(_optionalLastWithDot)_digits, donde el bloque antes del _ puede ser
    //  - first
    //  - first.last
    return !/^[a-z0-9]+(?:\.[a-z0-9]+)?_\d{1,5}$/.test(u);
  });

  private randomDigits(len = 5): string {
    let s = '';
    for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  private ensureEmailFromFirstToken(): void {
    const first = this.normalizeToken(this.model().nombre) || 'user';
    // intenta extraer los dígitos actuales del username si existen
    const match = (this.model().usuario || '').match(/^[a-z0-9]+_(\d{1,5})$/);
    const digits = match ? match[1] : this.randomDigits(5);
    const email = `${first}_@${digits}.com`;
    if (!this.model().email?.trim()) {
      this.model.update(m => ({ ...m, email }));
      this.clearFieldError('email');
    }
  }

  private buildRandomUsername(): string {
    const fTokens = this.tokenize(this.model().nombre);
    const lTokens = this.tokenize(this.model().apellido);
    const f1 = fTokens[0] || 'user';
    const f2 = fTokens[1];
    const l1 = lTokens[0];
    const l2 = lTokens[1];
    const bases = [
      f1,
      f2 ? `${f1}.${f2}` : null,
      l1 ? `${f1}.${l1}` : null,
      l2 ? `${f1}.${l2}` : null,
      (f2 && l1) ? `${f2}.${l1}` : null,
      f2 || null,
    ].filter((v): v is string => !!v);
    const base = bases[Math.floor(Math.random() * bases.length)] || f1;
    const digits = this.randomDigits(5);
    return `${base}_${digits}`;
  }

  rollUsername(): void {
    this.userEditedUsername = true;
    const username = this.buildRandomUsername();
    const fTokens = this.tokenize(this.model().nombre);
    const f1 = fTokens[0] || 'user';
    // extrae los dígitos del username recién generado para sincronizar email (soporta first[.token]_digits)
    const match = username.match(/^[a-z0-9]+(?:\.[a-z0-9]+)?_(\d{1,5})$/);
    const digits = match ? match[1] : this.randomDigits(5);
    const email = `${f1}_@${digits}.com`;

    this.model.update(m => ({ ...m, usuario: username, email }));
    this.clearFieldError('usuario');
    this.clearFieldError('email');
  }

  // Validaciones
  isStep1Valid = computed(() => {
    const m = this.model();
    const cp = this.confirmPassword();
    return !!m.usuario.trim() && !!m.email.trim() && !!m.nombre.trim()
      && !!m.apellido.trim() && !!m.password.trim()
      && !!cp.trim() && cp === m.password;
  });
  isStep2Valid = computed(() => {
    const e = this.model().empresa;
    return this.model().grupo.id !== null
      && !!e.nombre.trim()
      && e.pais.id !== null
      && e.sector.id !== null;
  });

  private apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private auth: AuthService,
    private router: Router,
  ) { }

  async ngOnInit() {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');

    // Prefill desde claims
    const claims = this.auth.claims();
    this.model.update(m => ({
      ...m,
      empresa: {
        ...m.empresa,
        nombre: (claims?.empresa ?? '').toString(),
        pais: { id: null },
        sector: { id: null },
      }
    }));

    // Cargar catálogos en paralelo y mapear pais/sector desde claims
    await Promise.all([this.loadPaises(), this.loadSectores()]);
    this.autoselectEmpresaFromClaims(claims?.pais, claims?.sector);

    // Cargar grupos (q obligatorio: enviar q='')
    await this.loadGrupos();

    // Snapshot inicial para confirmar cancelación si hay cambios
    this.initialSnapshot = JSON.stringify(this.model());
  }

  // ------- Catálogos -------
  private async loadPaises() {
    this.loadingPaises.set(true); this.errorPaises.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<PaisListOk>(`${this.apiBase}/country/list`).pipe(timeout(10000))
      );
      this.paises.set(res?.data ?? []);
    } catch (e: any) {
      this.errorPaises.set(e?.error?.message || e?.message || 'No fue posible cargar países.');
      this.paises.set([]);
    } finally {
      this.loadingPaises.set(false);
    }
  }

  private async loadSectores() {
    this.loadingSectores.set(true); this.errorSectores.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<SectorListOk>(`${this.apiBase}/sector/list`).pipe(timeout(10000))
      );
      this.sectores.set(res?.data ?? []);
    } catch (e: any) {
      this.errorSectores.set(e?.error?.message || e?.message || 'No fue posible cargar sectores.');
      this.sectores.set([]);
    } finally {
      this.loadingSectores.set(false);
    }
  }

  private autoselectEmpresaFromClaims(paisCode?: string, sectorName?: string) {
    if (paisCode) {
      const matchPais = this.paises().find(p => (p.codigoPais || '').toUpperCase() === paisCode.toUpperCase());
      if (matchPais) {
        this.model.update(m => ({ ...m, empresa: { ...m.empresa, pais: { id: matchPais.id } } }));
      }
    }
    if (sectorName) {
      const matchSector = this.sectores().find(s => (s.nombre || '').toUpperCase() === sectorName.toUpperCase());
      if (matchSector) {
        this.model.update(m => ({ ...m, empresa: { ...m.empresa, sector: { id: matchSector.id } } }));
      }
    }
  }

  // ------- Navegación -------
  goToStep(n: number) {
    if (n === 2 && !this.isStep1Valid()) return;
    this._step = n;
    this.success.set(null);
    this.error.set(null);
  }

  // ------- Helpers de form -------
  onField<K extends keyof UsuarioAdminCreateRequest>(key: K, value: UsuarioAdminCreateRequest[K]) {
    this.model.update(m => ({ ...m, [key]: value }));
    this.clearFieldError(String(key));
  }
  onEmpresaNombre(v: string) {
    this.model.update(m => ({ ...m, empresa: { ...m.empresa, nombre: v } }));
    this.clearFieldError('empresa.nombre');
  }
  onEmpresaNit(v: string) {
    this.model.update(m => ({ ...m, empresa: { ...m.empresa, nit: v } }));
    this.clearFieldError('empresa.nit');
  }
  onEmpresaPais(id: number | null) {
    this.model.update(m => ({ ...m, empresa: { ...m.empresa, pais: { id } } }));
    this.clearFieldError('empresa.pais.id');
  }
  onEmpresaSector(id: number | null) {
    this.model.update(m => ({ ...m, empresa: { ...m.empresa, sector: { id } } }));
    this.clearFieldError('empresa.sector.id');
  }
  onGrupoChange(id: number | null) {
    this.model.update(m => ({ ...m, grupo: { id } }));
    this.clearFieldError('grupo.id');
  }
  onConfirmPassword(v: string) {
    this.confirmPassword.set(v);
    this.clearFieldError('passwordConfirm');
  }

  private setFieldError(field: string, msg: string) {
    const cur = this.fieldErrors();
    this.fieldErrors.set({ ...cur, [field]: msg });
  }
  clearFieldError(field: string) {
    const cur = { ...this.fieldErrors() };
    delete cur[field];
    this.fieldErrors.set(cur);
  }

  // ------- Grupos -------
  async loadGrupos() {
    this.loadingGrupos.set(true);
    this.errorGrupos.set(null);
    try {
      const url = `${this.apiBase}/group/search`;
      const params = new HttpParams()
        .set('q', this.qGroup ?? '')
        .set('page', '0')
        .set('size', '20')
        .set('sortBy', 'nombre')
        .set('direction', 'ASC');

      const res = await firstValueFrom(
        this.http.get<GroupSearchOk>(url, { params }).pipe(timeout(12000))
      );
      if (res?.dataResponse?.response === 'ERROR') throw { error: res };

      const items = res?.data?.items ?? [];
      this.grupos.set(items);
      this.totalGrupos.set(res?.data?.totalElements ?? items.length);

    } catch (e: any) {
      this.errorGrupos.set(e?.error?.message || e?.message || 'No fue posible cargar los grupos.');
      this.grupos.set([]); this.totalGrupos.set(0);
    } finally {
      this.loadingGrupos.set(false);
    }
  }

  // ------- Submit -------
  async submit() {
    // Guardia anti doble-submit
    if (this.loading()) return;

    if (!this.isStep1Valid() || !this.isStep2Valid()) {
      this.error.set('Completa los pasos obligatorios antes de continuar.');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.fieldErrors.set({});

    try {
      const url = `${this.apiBase}/user/register`;
      const res = await firstValueFrom(
        this.http.post<UsuarioCreateOk>(url, this.model()).pipe(timeout(12000))
      );
      if (res?.dataResponse?.response === 'ERROR') throw { error: res };

      const id = res?.data?.id;
      const flash = `✅ Usuario creado${id ? ' (ID ' + id + ')' : ''}.`;
      this.router.navigate(['/usuarios'], { state: { flash } });

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La solicitud tardó demasiado. Intenta de nuevo.');
      } else {
        const be = (e?.error ?? e) as UsuarioCreateError;
        const arr = be?.error ?? [];

        if (arr.length > 0) {
          // Campos que sí reconocemos en el form
          const knownFields = new Set([
            'usuario', 'email', 'nombre', 'apellido', 'password',
            'empresa.nombre', 'empresa.nit', 'empresa.pais.id', 'empresa.sector.id',
            'grupo.id'
          ]);

          const globalMsgs: string[] = [];

          arr.forEach(it => {
            const cod = (it?.codError ?? '').trim();        // p.ej. "ERROR"
            const desc = (it?.descError ?? '').trim();        // p.ej. "E001" ó mensaje humano
            const msg = (it?.msgError ?? '').trim();        // p.ej. "El usuario ya existe." ó campo

            // ¿descError luce como código tipo E001?
            const descPareceCodigo = /^E\d{3,}$/.test(desc);
            // Mensaje humano final (soporta ambas variantes)
            const humanMessage = descPareceCodigo
              ? (msg || cod || 'Error')                       // BE -> desc=E001, msg=humano
              : (desc || msg || cod || 'Error');              // BE -> desc=humano

            // ¿msgError parece un nombre de campo?
            const msgPareceCampo = !!msg && !/\s/.test(msg) &&
              (knownFields.has(msg) || msg.includes('.'));

            if (msgPareceCampo) {
              this.setFieldError(msg, humanMessage);
            } else {
              globalMsgs.push(humanMessage);
            }

            // (Opcional) mapea códigos conocidos a campos
            if (desc === 'E001') { // usuario duplicado
              this.setFieldError('usuario', humanMessage);
            }
          });

          if (globalMsgs.length) {
            this.error.set(globalMsgs.join(' | '));
          } else if (!Object.keys(this.fieldErrors()).length) {
            this.error.set(be?.message || 'Validación rechazada.');
          }
        } else {
          this.error.set(be?.message || e?.error?.message || e?.message || 'No se pudo crear el usuario.');
        }
      }
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    } finally {
      this.loading.set(false);
    }
  }

  // ------- Cancel/Confirm modal -------
  private initialSnapshot = '';
  cancelConfirmOpen = signal(false);

  private isDirty(): boolean {
    try { return JSON.stringify(this.model()) !== this.initialSnapshot; } catch { return false; }
  }

  cancel() {
    if (this.isDirty()) { this.cancelConfirmOpen.set(true); return; }
    this.proceedCancel();
  }
  closeCancelConfirm() { if (!this.loading()) this.cancelConfirmOpen.set(false); }
  proceedCancel() {
    this.cancelConfirmOpen.set(false);
    this.router.navigate(['/usuarios']);
  }
}
