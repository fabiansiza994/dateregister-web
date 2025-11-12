import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="login-wrapper">
    <div class="login-left">
      <div class="brand-block">
        <div class="brand-logo">Inventra</div>
        <h1 class="headline">Control inteligente de tu inventario</h1>
        <p class="tagline">Registra productos, gestiona ventas y consulta el historial <span class="highlight">en segundos</span>.</p>
        <div class="process-flow">
          <div class="flow-step">
            <div class="icon">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3.5A1.5 1.5 0 0 0 2.5 5v10A1.5 1.5 0 0 0 4 16.5h12A1.5 1.5 0 0 0 17.5 15V5A1.5 1.5 0 0 0 16 3.5H4ZM3.5 5A.5.5 0 0 1 4 4.5h12a.5.5 0 0 1 .5.5v.5h-13V5Zm0 2h13v8a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V7Zm5 1.75a.75.75 0 0 0-1.5 0V12a.75.75 0 0 0 1.5 0V8.75Zm3.25-.75a.75.75 0 0 1 .75.75V12a.75.75 0 0 1-1.5 0V8.75a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd"/></svg>
            </div>
            <span class="flow-label">Registro</span>
          </div>
          <div class="flow-separator"></div>
          <div class="flow-step">
            <div class="icon">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 4.75A1.75 1.75 0 0 1 3.75 3h12.5A1.75 1.75 0 0 1 18 4.75v3.5A1.75 1.75 0 0 1 16.25 10h-12.5A1.75 1.75 0 0 1 2 8.25v-3.5Zm1.75-.25a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25h-12.5Zm-.5 8.5a.75.75 0 0 0-1.5 0c0 1.519 1.231 2.75 2.75 2.75h9.5A2.75 2.75 0 0 0 18 13a.75.75 0 0 0-1.5 0c0 .69-.56 1.25-1.25 1.25h-9.5a1.25 1.25 0 0 1-1.25-1.25Z" clip-rule="evenodd"/></svg>
            </div>
            <span class="flow-label">Venta</span>
          </div>
          <div class="flow-separator"></div>
          <div class="flow-step">
            <div class="icon">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3.5a6.5 6.5 0 1 0 5.196 10.477.75.75 0 0 0-1.192-.905A5 5 0 1 1 15 10c0 .8-.187 1.556-.52 2.222a.75.75 0 0 0 1.342.666A6.462 6.462 0 0 0 16.5 10 6.5 6.5 0 0 0 10 3.5ZM10 6a.75.75 0 0 1 .75.75v2.19l1.28.64a.75.75 0 0 1-.66 1.34l-1.75-.875A.75.75 0 0 1 9.25 10V6.75A.75.75 0 0 1 10 6Z" clip-rule="evenodd"/></svg>
            </div>
            <span class="flow-label">Historial</span>
          </div>
        </div>
        <p class="mini-note">Optimiza stock, reduce errores y obtén visibilidad completa.</p>
      </div>
      <footer class="login-footer">© {{year}} Inventra</footer>
    </div>
    <div class="login-right">
      <div class="form-card">
        <h2 class="form-title">Accede a tu cuenta</h2>
        <form (ngSubmit)="login()" class="form-grid">
          <label class="field">
            <span class="field-label">Usuario</span>
            <input class="input field-input" [(ngModel)]="username" name="username" required autocomplete="username">
          </label>
          <label class="field">
            <span class="field-label">Contraseña</span>
            <input class="input field-input" type="password" [(ngModel)]="password" name="password" required autocomplete="current-password">
          </label>
          <button type="submit" class="btn btn-primary submit-btn" [disabled]="loading()">{{ loading() ? 'Ingresando...' : 'Entrar' }}</button>
          <div class="error-msg" *ngIf="error()">{{ error() }}</div>
        </form>
      </div>
    </div>
  </div>
  `,
  styles: [`
  .login-wrapper { display:flex; min-height:100vh; width:100vw; background:linear-gradient(115deg,#0f172a,#1e293b 55%,#0f172a); color:#f1f5f9; padding:1rem; gap:2rem; box-sizing:border-box; }
    .login-left { flex:1; padding:3.2rem 2.5rem 2.4rem; display:flex; flex-direction:column; justify-content:space-between; position:relative; }
    .brand-block { max-width:560px; }
    .brand-logo { font-size:1.25rem; font-weight:700; letter-spacing:.5px; background:linear-gradient(90deg,#38bdf8,#818cf8); -webkit-background-clip:text; color:transparent; margin-bottom:1rem; }
    .headline { font-size:2.25rem; line-height:1.15; margin:0 0 1rem; font-weight:700; }
    .tagline { font-size:1rem; margin:0 0 1.4rem; color:#cbd5e1; }
    .highlight { color:#38bdf8; font-weight:600; }
    .process-flow { display:flex; align-items:center; gap:1.25rem; margin:1.2rem 0 1.8rem; flex-wrap:wrap; }
    .flow-step { display:flex; flex-direction:column; align-items:center; gap:.35rem; }
    .flow-step .icon { width:46px; height:46px; border-radius:12px; background:#1e293b; display:flex; align-items:center; justify-content:center; color:#60a5fa; box-shadow:0 2px 6px rgba(0,0,0,.35); transition:background .25s, transform .25s; }
    .flow-step:hover .icon { background:#334155; transform:translateY(-4px); }
    .flow-label { font-size:.70rem; letter-spacing:.5px; text-transform:uppercase; font-weight:600; color:#94a3b8; }
    .flow-separator { width:34px; height:2px; background:linear-gradient(90deg,#38bdf8,#818cf8); border-radius:2px; }
    .mini-note { font-size:.75rem; color:#94a3b8; text-transform:uppercase; letter-spacing:.12em; font-weight:500; }
    .login-footer { font-size:.65rem; color:#475569; position:absolute; bottom:1rem; left:3.5rem; }
  .login-right { flex:1; display:flex; align-items:center; justify-content:center; padding:3rem 2.5rem; }
  .form-card { width:100%; max-width:420px; background:#ffffff; color:#0f172a; padding:2.75rem 2.4rem 2.2rem; border-radius:22px; box-shadow:0 8px 32px rgba(0,0,0,.35), 0 2px 8px rgba(0,0,0,.25); position:relative; isolation:isolate; }
  .form-card:before { content:''; position:absolute; inset:0; border-radius:inherit; padding:2px; background:linear-gradient(135deg,#38bdf8,#818cf8,#6366f1); -webkit-mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite:xor; mask-composite:exclude; pointer-events:none; z-index:0; }
    .form-title { margin:0 0 1.8rem; font-size:1.45rem; font-weight:600; letter-spacing:.5px; }
    .form-grid { display:flex; flex-direction:column; gap:1.1rem; }
    .field { display:flex; flex-direction:column; gap:.4rem; }
    .field-label { font-size:.7rem; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#475569; }
    .field-input { background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:.75rem .85rem; font-size:.9rem; transition:border-color .25s, background .25s, box-shadow .25s; }
    .field-input:focus { outline:none; border-color:#6366f1; background:#ffffff; box-shadow:0 0 0 3px rgba(99,102,241,.25); }
    .submit-btn { margin-top:.5rem; padding:.85rem 1rem; font-weight:600; letter-spacing:.5px; box-shadow:0 4px 14px rgba(99,102,241,.45); }
    .submit-btn:disabled { opacity:.55; box-shadow:none; }
    .error-msg { font-size:.7rem; color:#dc2626; margin-top:.25rem; }
    @media (max-width:1100px){ .login-wrapper { flex-direction:column; } .login-left { padding:3.2rem 2.4rem 2rem; } .login-right { padding:2.8rem 2.2rem 3.4rem; } .headline { font-size:2rem; } }
    @media (max-width:640px){ .process-flow { gap:.9rem; } .flow-separator { display:none; } .login-left { padding:3rem 1.4rem 1.6rem; } .login-right { padding:2.2rem 1.2rem 2.8rem; } .form-card { padding:2.15rem 1.55rem 1.8rem; } }
    @media (prefers-reduced-motion:reduce){ .flow-step:hover .icon { transform:none; } .submit-btn { transition:none; } .field-input { transition:none; } }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = signal(false);
  error = signal('');
  year = new Date().getFullYear();
  constructor(private auth: AuthService, private router: Router) {}
  async login() {
    this.error.set('');
    this.loading.set(true);
    try {
      const ok = await this.auth.login(this.username, this.password);
      if (ok) {
        this.router.navigateByUrl('/');
      } else {
        this.error.set('Credenciales inválidas');
      }
    } catch {
      this.error.set('Error de autenticación');
    } finally {
      this.loading.set(false);
    }
  }
}
