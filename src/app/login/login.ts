import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  usuario = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  readonly currentYear = new Date().getFullYear();

  constructor(private http: HttpClient) { }

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
      const response = await this.http
        .post<{ token: string }>('http://localhost:8081/auth/login', body)
        .toPromise(); // ⬅️ convertir Observable a Promise (modo async/await)

      console.log('Login exitoso:', response);

      // Ejemplo: guardar token en localStorage
      localStorage.setItem('token', response?.token ?? '');
    } catch (e: any) {
      console.error('Error login', e);

      const backendError =
        e?.error?.error?.[0]?.descError ?? // nuestro descError
        e?.error?.message ??               // si el backend manda message
        'No se pudo iniciar sesión.';      // fallback

      this.error.set(backendError);
    } finally {
      this.loading.set(false);
    }
  }

  reset() { this.usuario.set(''); this.password.set(''); this.error.set(null); }
}