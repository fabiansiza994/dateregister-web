import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

// ====== Catálogos ======
interface Pais { id: number; nombre: string; codigoPais: string; }
interface PaisListOk { data: Pais[]; dataResponse: { response: 'SUCCESS'|'ERROR' } }

interface Sector { id: number; nombre: string; }
interface SectorListOk { data: Sector[]; dataResponse: { response: 'SUCCESS'|'ERROR' } }

// ====== Grupos (search) ======
interface ApiErrorItem { codError?: string; descError?: string; msgError?: string; }
interface GroupLite { id: number; nombre: string; }
interface GroupSearchOk {
  dataResponse: { response: 'SUCCESS'|'ERROR' };
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
    pais:   { id: number | null };
    sector: { id: number | null };
  };
  grupo: { id: number | null };
  rol:   { id: number };    // USER id=2
}
interface UsuarioCreateOk   { dataResponse: { idTx: string|null; response: 'SUCCESS'|'ERROR' }; data?: { id?: number } }
interface UsuarioCreateError{ dataResponse?: { response?: 'ERROR'|'SUCCESS' }; error?: ApiErrorItem[]; message?: string; }

@Component({
  selector: 'app-usuario-nuevo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './usuario-nuevo.html',
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
      pais:   { id: null },
      sector: { id: null },
    },
    grupo: { id: null },
    rol: { id: 2 },   // USER
  });

  // UI
  loading = signal(false);
  error   = signal<string|null>(null);
  success = signal<string|null>(null);
  fieldErrors = signal<Record<string,string>>({});

  // Grupos (search)
  qGroup = '';
  grupos = signal<GroupLite[]>([]);
  loadingGrupos = signal(false);
  errorGrupos = signal<string|null>(null);
  totalGrupos = signal(0);

  // Catálogos
  paises   = signal<Pais[]>([]);
  sectores = signal<Sector[]>([]);
  loadingPaises   = signal(false);
  loadingSectores = signal(false);
  errorPaises   = signal<string|null>(null);
  errorSectores = signal<string|null>(null);

  // Validaciones
  isStep1Valid = computed(() => {
    const m = this.model();
    return !!m.usuario.trim() && !!m.email.trim() && !!m.nombre.trim()
        && !!m.apellido.trim() && !!m.password.trim();
  });
  isStep2Valid = computed(() => {
    const e = this.model().empresa;
    return this.model().grupo.id !== null
        && !!e.nombre.trim()
        && e.pais.id   !== null
        && e.sector.id !== null;
  });

  private apiBase = '';

  constructor(
    private http: HttpClient,
    private cfg: ConfigService,
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.apiBase = this.cfg.get<string>('apiBaseUrl','');

    // Prefill desde claims
    const claims = this.auth.claims();
    this.model.update(m => ({
      ...m,
      empresa: {
        ...m.empresa,
        nombre: (claims?.empresa ?? '').toString(),
        pais:   { id: null },
        sector: { id: null },
      }
    }));

    // Cargar catálogos en paralelo y mapear pais/sector desde claims
    await Promise.all([ this.loadPaises(), this.loadSectores() ]);
    this.autoselectEmpresaFromClaims(claims?.pais, claims?.sector);

    // Cargar grupos (q obligatorio: enviar q='')
    await this.loadGrupos();
  }

  // ------- Catálogos -------
  private async loadPaises() {
    this.loadingPaises.set(true); this.errorPaises.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<PaisListOk>(`${this.apiBase}/country/list`).pipe(timeout(10000))
      );
      this.paises.set(res?.data ?? []);
    } catch (e:any) {
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
    } catch (e:any) {
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
  onEmpresaPais(id: number|null) {
    this.model.update(m => ({ ...m, empresa: { ...m.empresa, pais: { id } } }));
    this.clearFieldError('empresa.pais.id');
  }
  onEmpresaSector(id: number|null) {
    this.model.update(m => ({ ...m, empresa: { ...m.empresa, sector: { id } } }));
    this.clearFieldError('empresa.sector.id');
  }
  onGrupoChange(id: number|null) {
    this.model.update(m => ({ ...m, grupo: { id } }));
    this.clearFieldError('grupo.id');
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

    } catch (e:any) {
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

    } catch (e:any) {
      if (e instanceof TimeoutError) {
        this.error.set('La solicitud tardó demasiado. Intenta de nuevo.');
      } else {
        const be = (e?.error ?? e) as UsuarioCreateError;
        const arr = be?.error ?? [];
        if (arr.length > 0) {
          arr.forEach(it => {
            const field = (it?.msgError ?? '').trim() || 'global';
            const msg   = (it?.descError ?? it?.codError ?? 'Error').trim();
            if (field === 'global') this.error.set(msg);
            else this.setFieldError(field, msg);
          });
        } else {
          this.error.set(be?.message || e?.error?.message || e?.message || 'No se pudo crear el usuario.');
        }
      }
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    } finally {
      this.loading.set(false);
    }
  }
}
