import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { ConfigService } from '../core/config.service';

import { UsuarioCreateRequest } from '../interfaces/UsuarioCreateRequest.interface';
import { CreateErrorResponse } from '../interfaces/CreateErrorResponse';
import { CreateOkResponse } from '../interfaces/CreateOkResponse.interface';
import { Pais, PaisListOk } from '../interfaces/Pais';
import { Sector, SectorListOk } from '../interfaces/Sector';

import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class Register implements OnInit {
  // Paso actual
  private _step = 1;
  get step() { return this._step; }

  // Modelo del request
  model: UsuarioCreateRequest = {
    usuario: '',
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    empresa: {
      nombre: '',
      nit: '',
      pais: { id: null },
      sector: { id: null }
    },
    grupo: { nombre: '' },
    rol: { id: 1 }
  };

  // Catálogos
  paises: Pais[] = [];
  sectores: Sector[] = [];

  // Estado de catálogos (signals)
  loadingPaises = signal(false);
  errorPaises = signal<string | null>(null);

  loadingSectores = signal(false);
  errorSectores = signal<string | null>(null);

  // UI state (signals)
  loading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  acceptedTerms = false;

  // === NUEVO: confirmación de password y control de autocompletado de usuario ===
  confirmPassword = '';
  private userEditedUsername = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cfg: ConfigService
  ) { }

  ngOnInit(): void {
    this.loadPaises();
    this.loadSectores();
  }

  // ---------- Catálogo: Países ----------
  async loadPaises() {
    this.loadingPaises.set(true);
    this.errorPaises.set(null);
    try {
      const apiBase = this.cfg.get<string>('apiBaseUrl');
      if (!apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const res = await firstValueFrom(
        this.http.get<PaisListOk>(`${apiBase}/country/list`).pipe(timeout(12000))
      );

      this.paises = res?.data ?? [];
      if (!this.paises.length) this.errorPaises.set('No se recibieron países.');
    } catch (e: any) {
      const be = e?.error as { error?: Array<{ msgError?: string; descError?: string }> };
      const apiMsgs = be?.error?.map(x => x?.msgError || x?.descError).filter(Boolean) ?? [];
      const messageFromApi = apiMsgs.join(' | ');
      this.errorPaises.set(
        (e instanceof TimeoutError)
          ? 'La carga de países tardó demasiado.'
          : messageFromApi || e?.message || e?.error?.message || 'No fue posible cargar la lista de países.'
      );
    } finally {
      this.loadingPaises.set(false);
    }
  }

  // ---------- Catálogo: Sectores ----------
  async loadSectores() {
    this.loadingSectores.set(true);
    this.errorSectores.set(null);
    try {
      const apiBase = this.cfg.get<string>('apiBaseUrl');
      if (!apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const res = await firstValueFrom(
        this.http.get<SectorListOk>(`${apiBase}/sector/list`).pipe(timeout(12000))
      );

      this.sectores = res?.data ?? [];
      if (!this.sectores.length) this.errorSectores.set('No se recibieron sectores.');
    } catch (e: any) {
      const be = e?.error as { error?: Array<{ msgError?: string; descError?: string }> };
      const apiMsgs = be?.error?.map(x => x?.msgError || x?.descError).filter(Boolean) ?? [];
      const messageFromApi = apiMsgs.join(' | ');
      this.errorSectores.set(
        (e instanceof TimeoutError)
          ? 'La carga de sectores tardó demasiado.'
          : messageFromApi || e?.message || e?.error?.message || 'No fue posible cargar la lista de sectores.'
      );
    } finally {
      this.loadingSectores.set(false);
    }
  }

  // ---------- Navegación entre pasos ----------
  goToStep(n: number) {
    if (n === 2 && !this.isStep1Valid()) return;
    if (n === 3 && !this.isStep2Valid()) return;

    this._step = n;

    if (n > 1) {
      this.successMessage.set('¡Progreso guardado! Sigue así 🙌');
      setTimeout(() => this.successMessage.set(null), 1800);
    }
  }

  // ---------- Helpers usuario sugerido ----------
  private normalizeToken(s?: string): string {
    if (!s) return '';
    return s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')                     // solo letras/números/espacios
      .trim()
      .split(/\s+/)[0] || '';                          // primer token
  }

  private computeUsername(): string {
    const first = this.normalizeToken(this.model.nombre);
    const last = this.normalizeToken(this.model.apellido);
    if (!first || !last) return '';
    return `${first}.${last}`;
  }

  updateSuggestedUser(): void {
    if (this.userEditedUsername) return;
    const sugg = this.computeUsername();
    if (sugg) this.model.usuario = sugg;
  }

  onUsuarioInput(): void {
    this.userEditedUsername = true;
  }

  get invalidUsername(): boolean {
    const u = this.model.usuario ?? '';
    if (!u) return false; // no mostramos advertencia si está vacío
    return !/^[a-z0-9.]+$/.test(u);
  }

  // ---------- Validaciones ----------
  get passwordsMatch(): boolean {
    return !!this.model.password && this.model.password === this.confirmPassword;
  }

  isStep1Valid(): boolean {
    const m = this.model;
    const baseOk = !!m.usuario && !!m.email && !!m.nombre && !!m.apellido && !!m.password;
    // (Opcional) Forzar mínimo de 8 caracteres:
    // const strongEnough = (m.password?.length ?? 0) >= 8;
    // return baseOk && this.passwordsMatch && strongEnough;
    return baseOk && this.passwordsMatch;
  }

  isStep2Valid(): boolean {
    const e = this.model.empresa;
    return !!e?.nombre && !!e?.nit && !!e?.pais?.id && !!e?.sector?.id;
  }

  isStep3Valid(): boolean {
    return !!this.model.grupo?.nombre && this.acceptedTerms;
  }

  // ---------- Helpers de vista ----------
  viewPais(id: number | null | undefined) {
    return this.paises.find(p => p.id === id)?.nombre ?? '-';
  }
  viewSector(id: number | null | undefined) {
    return this.sectores.find(s => s.id === id)?.nombre ?? '-';
  }

  // ---------- Envío ----------
  async submit() {
    if (!this.isStep1Valid() || !this.isStep2Valid() || !this.isStep3Valid()) {
      this.error.set('Completa los pasos obligatorios antes de continuar.');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
      return;
    }

    this.error.set(null);
    this.successMessage.set(null);
    this.loading.set(true);

    try {
      const apiBase = this.cfg.get<string>('apiBaseUrl');
      if (!apiBase) throw new Error('Config no cargada: falta apiBaseUrl');

      const res = await firstValueFrom(
        this.http.post<CreateOkResponse>(`${apiBase}/user/register`, this.model, {
          headers: { 'Content-Type': 'application/json' }
        }).pipe(timeout(12000))
      );

      // Caso 200 pero con response="ERROR"
      if (res?.dataResponse?.response === 'ERROR') {
        throw { error: { error: [{ msgError: 'Ocurrió un error en el registro.' }], ...res } };
      }

      // ÉXITO → flash en login
      const status = res?.dataResponse?.response ?? 'SUCCESS';
      const flash = `🎉 ¡Cuenta creada! (Estado: ${status}). Ya puedes iniciar sesión.`;
      this.router.navigate(['/login'], { state: { flash } });

    } catch (e: any) {
      if (e instanceof TimeoutError) {
        this.error.set('La solicitud tardó demasiado. Intenta de nuevo en un momento.');
      } else {
        const be: CreateErrorResponse | undefined = e?.error;
        const apiMsgs = be?.error?.map(x => x?.msgError || x?.descError).filter(Boolean) ?? [];
        const messageFromApi = apiMsgs.join(' | ');

        const code = be?.error?.[0]?.descError;
        if (code === 'E001') this._step = 1; // Usuario ya existe
        if (code === 'E002') this._step = 2; // NIT ya existe

        this.error.set(messageFromApi || e?.message || e?.error?.message || 'No se pudo completar el registro.');
      }

      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);

    } finally {
      this.loading.set(false);
    }
  }
}
