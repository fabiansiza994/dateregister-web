import { Component, signal, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './layout/sidebar.component';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  template: `
  <div class="layout" *ngIf="showLayout()">
    <app-sidebar [(collapsed)]="isCollapsed"></app-sidebar>
    <main class="content">
      <router-outlet />
    </main>
    <!-- User badge top-right -->
    <div class="user-badge" *ngIf="username">
      <span class="dot" aria-hidden="true"></span>
      <span class="label">{{ username }}</span>
    </div>
  </div>
  <ng-container *ngIf="!showLayout()">
    <router-outlet />
  </ng-container>
  `,
  styles:[`
    .layout { display:flex; align-items:stretch; min-height:100vh; }
    .content { flex:1; padding:1rem; min-height:100vh; overflow:auto; }
    .user-badge { position:fixed; top:10px; right:12px; display:inline-flex; align-items:center; gap:.4rem; background:#f1f5f9; color:#0f172a; border:1px solid #e2e8f0; border-radius:999px; padding:.35rem .6rem; box-shadow:0 1px 2px rgba(0,0,0,.06); z-index:50; font-size:.85rem; }
    .user-badge .dot { width:8px; height:8px; background:#16a34a; border-radius:999px; box-shadow:0 0 0 2px #e2e8f0 inset; }
    .user-badge .label { font-weight:600; }
  `]
})
export class AppComponent {
  isCollapsed = false;
  showLayout = signal(true);
  private auth = inject(AuthService);
  username = this.auth.username();

  constructor(private router: Router){
    // initialize and listen for navigation to toggle layout on /login
    const update = () => this.showLayout.set(!this.router.url.startsWith('/login'));
    update();
    this.router.events.subscribe(ev => { if(ev instanceof NavigationEnd){ update(); } });
  }
}
