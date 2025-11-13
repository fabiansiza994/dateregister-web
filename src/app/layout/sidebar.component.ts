import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
  <aside class="sidebar" [class.collapsed]="collapsed">
    <div class="brand" [class.center]="collapsed">
      <div class="logo-wrap" aria-label="Inventra">
        <svg class="logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h7v7h-7z" />
          <path d="M3 10h18" />
          <path d="M10 3v18" />
        </svg>
      </div>
      <span class="brand-text" *ngIf="!collapsed" aria-hidden="true">Inventra</span>
    </div>

    <nav class="menu">
      <a routerLink="/productos" routerLinkActive="active" [title]="collapsed ? 'Productos' : ''">
        <span class="icon">📦</span>
        <span class="label" *ngIf="!collapsed">Productos</span>
      </a>
      <a routerLink="/categorias" routerLinkActive="active" [title]="collapsed ? 'Categorías' : ''">
        <span class="icon">🏷️</span>
        <span class="label" *ngIf="!collapsed">Categorías</span>
      </a>
      <a routerLink="/clientes" routerLinkActive="active" [title]="collapsed ? 'Clientes' : ''">
        <span class="icon">👥</span>
        <span class="label" *ngIf="!collapsed">Clientes</span>
      </a>
      <a routerLink="/ventas" routerLinkActive="active" [title]="collapsed ? 'Ventas' : ''">
        <span class="icon">🧾</span>
        <span class="label" *ngIf="!collapsed">Ventas</span>
      </a>
      <a routerLink="/ventas/historial" routerLinkActive="active" [title]="collapsed ? 'Historial' : ''">
        <span class="icon">📜</span>
        <span class="label" *ngIf="!collapsed">Historial</span>
      </a>
      <a *ngIf="isAdmin()" routerLink="/usuarios" routerLinkActive="active" [title]="collapsed ? 'Usuarios' : ''">
        <span class="icon">👤</span>
        <span class="label" *ngIf="!collapsed">Usuarios</span>
      </a>
    </nav>

    <div class="spacer"></div>
    <footer class="footer">
      <div class="user" *ngIf="!collapsed">
        <span class="user-name">{{ username || 'Usuario' }}</span>
      </div>
      <button class="logout" type="button" (click)="doLogout()" [title]="'Salir'">
        <span class="icon">⎋</span>
        <span class="label" *ngIf="!collapsed">Salir</span>
      </button>
      <div class="version" *ngIf="!collapsed">v1.0.0</div>
    </footer>

    <button class="toggle" type="button" (click)="onToggle()" [attr.aria-label]="collapsed ? 'Expandir' : 'Colapsar'">
      <span class="chev">{{ collapsed ? '›' : '‹' }}</span>
    </button>
  </aside>
  `,
  styles: [`
    :host { display:block; height:100%; }
    .sidebar { position:relative; width:240px; transition: width .2s ease; background:#f8fafc; border-right:1px solid #e2e8f0; height:100vh; display:flex; flex-direction:column; }
    .sidebar.collapsed { width:64px; }
    .brand { display:flex; align-items:center; gap:.5rem; height:56px; padding:0 1rem; border-bottom:1px solid #e2e8f0; }
    .brand.center { justify-content:center; }
    .logo-wrap { width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:.6rem; background:#1e293b; color:#f8fafc; }
  /* When collapsed we keep logo visible and center it via .brand.center */
    .logo-svg { width:22px; height:22px; }
    .brand-text { font-weight:600; color:#334155; }
    .menu { display:flex; flex-direction:column; padding:.5rem; gap:.25rem; }
    .menu a { display:flex; align-items:center; gap:.75rem; padding:.55rem .75rem; color:#334155; text-decoration:none; border-radius:.5rem; }
    .menu a.active, .menu a:hover { background:#e2e8f0; }
    .icon { width:20px; text-align:center; }
    .spacer { flex:1; }
  .user { padding:.25rem 1rem; font-size:.8rem; color:#475569; }
  .logout { margin:.25rem .5rem; width:auto; display:flex; align-items:center; gap:.75rem; padding:.55rem .75rem; border:1px solid #cbd5e1; background:#fff; color:#334155; border-radius:.5rem; cursor:pointer; }
    .logout:hover { background:#e2e8f0; }
  .footer { padding:.5rem 0 .75rem; border-top:1px solid #e2e8f0; }
  .version { padding:0 1rem; font-size:.7rem; color:#94a3b8; }
    .toggle { position:absolute; top:50%; right:-12px; transform:translateY(-50%); width:24px; height:24px; border-radius:999px; border:1px solid #cbd5e1; background:#ffffff; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 2px rgba(0,0,0,.06); }
    .chev { line-height:1; font-size:14px; color:#334155; }
  `]
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();
  missingLogo = false;
  private auth = inject(AuthService);
  username = this.auth.username();
  isAdmin(){ return this.auth.role() === 'ADMIN'; }

  onToggle(){
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  doLogout(){
    this.auth.logout();
    // Use location to avoid DI Router if not imported; simpler here.
    window.location.href = '/login';
  }
}
