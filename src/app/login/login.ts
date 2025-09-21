import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { LoginResponse } from '../interfaces/LoginResponse .interface';
import { LoginErrorResponse } from '../interfaces/ErrorDetail.interface';
import { Router } from '@angular/router';
import { ConfigService } from '../core/config.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  successFlash = signal<string | null>(history.state?.flash ?? null);

  ngOnInit() {
    if (this.successFlash()) {
      setTimeout(() => this.successFlash.set(null), 4000);
    }
  }

  usuario = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  readonly currentYear = new Date().getFullYear();

  constructor(private http: HttpClient, private router: Router, private cfg: ConfigService) {}

  get isFormValid() { return !!this.usuario().trim() && !!this.password().trim(); }

  toggleShowPassword() { this.showPassword.set(!this.showPassword()); }

  async login() {
    if (!this.isFormValid || this.loading()) return;

    this.error.set(null);
    this.loading.set(true);

    const body = {
      username: this.usuario(),
      password: this.password()
    };

    try {
      const apiBase = this.cfg.get<string>('apiBaseUrl');
      const response = await this.http
        .post<LoginResponse>(`${apiBase}/auth/login`, body)
        .toPromise(); // ⬅️ convertir Observable a Promise (modo async/await)

      console.log('Login exitoso:', response);

      // Ejemplo: guardar token en localStorage
      localStorage.setItem('token', response?.data.token ?? '');

      this.router.navigate(['/modules'])
    } catch (e: any) {
      console.error('Error login', e);

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

  reset() { this.usuario.set(''); this.password.set(''); this.error.set(null); }
}