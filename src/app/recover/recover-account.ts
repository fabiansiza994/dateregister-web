import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfigService } from '../core/config.service';

@Component({
  standalone: true,
  selector: 'app-recover-account',
  imports: [CommonModule, FormsModule],
  templateUrl: './recover-account.html',
  styleUrls: ['./recover-account.css']
})
export class RecoverAccountComponent {
  password = signal<string>('');
  confirm = signal<string>('');
  loading = signal(false);
  info = signal<string | null>(null);
  error = signal<string | null>(null);

  private apiBase = '';
  userId = signal<number>(0);

  pwdMismatch = computed(()=> !!this.password() && !!this.confirm() && this.password() !== this.confirm());
  pwdWeak = computed(()=> (this.password()?.length || 0) < 8);
  canSubmit = computed(()=> !!this.password() && !this.pwdWeak() && !this.pwdMismatch() && !this.loading());

  constructor(private http: HttpClient, private cfg: ConfigService, private route: ActivatedRoute, private router: Router) {
    this.apiBase = this.cfg.get<string>('apiBaseUrl', '');
    const idStr = this.route.snapshot.paramMap.get('id') || '0';
    this.userId.set(Number(idStr));
    try { document.body.classList.add('page-login'); } catch {}
  }

  ngOnDestroy() { try { document.body.classList.remove('page-login'); } catch {} }

  async submit() {
    this.error.set(null); this.info.set(null);
    if (!this.canSubmit()) return;
    this.loading.set(true);
    try {
      const url = `${this.apiBase}/user/recoverAccount`;
      const body = { userId: this.userId(), password: this.password() };
      await this.http.post(url, body).toPromise();
      this.info.set('Tu contraseña fue actualizada. Ya puedes iniciar sesión.');
      setTimeout(()=> this.router.navigate(['/login']), 1500);
    } catch (e: any) {
      // Si el backend tiene GET en vez de POST, mostrar mensaje claro
      const msg = e?.status === 405 ? 'El servidor rechazó la solicitud. Por favor, intenta más tarde.' : (e?.error?.message || 'No fue posible actualizar la contraseña.');
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
