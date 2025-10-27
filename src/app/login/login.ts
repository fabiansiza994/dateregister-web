import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { ConfigService } from '../core/config.service';

import { LoginResponse } from '../interfaces/LoginResponse.interface';
import { LoginErrorResponse } from '../interfaces/ErrorDetail.interface';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  // ===== UI state
  successFlash = signal<string | null>(history.state?.flash ?? null);
  loading = signal(false);
  error = signal<string | null>(null);

  // ===== Form state
  usuario = signal('');
  password = signal('');
  showPassword = signal(false);
  userInvalid = signal<boolean>(false);
  capsOn = signal<boolean>(false);
  remember = signal<boolean>(false);

  readonly currentYear = new Date().getFullYear();
  private readonly REMEMBER_KEY = 'login:remember:username';

  constructor(private http: HttpClient, private router: Router, private cfg: ConfigService) {}

  ngOnInit() {
    if (this.successFlash()) setTimeout(() => this.successFlash.set(null), 4000);

    // Precarga "remember me"
    const saved = localStorage.getItem(this.REMEMBER_KEY);
    if (saved) {
      const n = this.normalizeUsername(saved);
      this.usuario.set(n);
      this.userInvalid.set(!this.usernameRegex.test(n));
      this.remember.set(true);
    }
  }

  // ===== Normalización & Validación de usuario (formato flexible)
  private normalizeUsername(raw: string): string {
    return raw
      .normalize('NFD').replace(/\p{Diacritic}/gu, '') // quita tildes
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')   // ✅ permite letras, números, punto, guión bajo y guión
      .replace(/\.{2,}/g, '.')        // colapsa múltiples puntos consecutivos
      .trim();
  }

  // permite cualquier combinación de letras, números, puntos, guiones bajos y guiones (mínimo 3 caracteres)
  private usernameRegex = /^[a-z0-9._-]{3,}$/;

  onUserInput(v: string) {
    const n = this.normalizeUsername(v);
    this.usuario.set(n);
    this.userInvalid.set(!this.usernameRegex.test(n));
  }

  validateUser() {
    this.userInvalid.set(!this.usernameRegex.test(this.usuario()));
  }

  // Caps Lock detection
  onPasswordKey(ev: KeyboardEvent) {
    try { this.capsOn.set(ev.getModifierState && ev.getModifierState('CapsLock')); }
    catch { this.capsOn.set(false); }
  }

  get isFormValid() {
    return !!this.usuario().trim() && !!this.password().trim();
  }

  toggleShowPassword() { this.showPassword.set(!this.showPassword()); }

  onRememberChange(checked: boolean) {
    this.remember.set(checked);
    if (!checked) localStorage.removeItem(this.REMEMBER_KEY);
  }

  async login() {
    if (!this.isFormValid || this.userInvalid() || this.loading()) return;

    this.error.set(null);
    this.loading.set(true);

    const body = {
      username: this.usuario(),
      password: this.password()
    };

    try {
      const apiBase = this.cfg.get<string>('apiBaseUrl');
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${apiBase}/auth/login`, body)
      );

      // Persistencia de sesión (ideal: cookie httpOnly desde backend)
      localStorage.setItem('token', response?.data?.token ?? '');

      // Recordarme (solo username)
      if (this.remember()) localStorage.setItem(this.REMEMBER_KEY, this.usuario());
      else localStorage.removeItem(this.REMEMBER_KEY);

      this.router.navigate(['/modules']);
    } catch (e: any) {
      const err: LoginErrorResponse | undefined = e?.error;
      const backendError =
        err?.error?.[0]?.descError ??
        e?.error?.message ??
        'No se pudo iniciar sesión.';

      this.error.set(backendError);
    } finally {
      this.loading.set(false);
    }
  }

  reset() {
    this.usuario.set('');
    this.password.set('');
    this.userInvalid.set(false);
    this.capsOn.set(false);
    this.error.set(null);
    // no tocamos remember(); el usuario decide
  }
}
