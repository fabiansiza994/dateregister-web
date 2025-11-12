import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
  <nav class="flex items-center justify-between gap-2" style="min-height:var(--menu-h)">
    <div class="flex items-center gap-2">
      <span class="font-semibold">Inventra</span>
      <span class="badge">INVENTARIO</span>
    </div>
    <div class="hidden md:flex items-center gap-2 text-xs">
      <a routerLink="/productos" routerLinkActive="active">Productos</a>
      <a routerLink="/categorias" routerLinkActive="active">Categorias</a>
      <a routerLink="/clientes" routerLinkActive="active">Clientes</a>
      <a routerLink="/ventas" routerLinkActive="active">Ventas</a>
    </div>
  </nav>
  <hr style="border:none;height:1px;background:#e2e8f0;margin:0;">
  `,
  styles:[`
    a { text-decoration:none; padding:.35rem .65rem; border-radius:.55rem; color:#334155; }
    a.active, a:hover { background:#e2e8f0; }
  `]
})
export class TopbarComponent {
  user = signal('demo');
  userLabel = computed(()=> this.user().toUpperCase());
}
