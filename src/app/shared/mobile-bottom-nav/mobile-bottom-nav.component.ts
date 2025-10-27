import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { filter } from 'rxjs/operators';
import { RouteAnimService } from '../../core/route-anim.service';

@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  styles: [`
    :host { position: fixed; inset-inline: 0; bottom: 0; z-index: 40; }
    nav { height: 5rem; /* 80px ~ h-20 */ background: #ffffff; border-top: 1px solid rgba(100,116,139,.25); box-shadow: 0 -2px 10px rgba(16,24,40,.08); padding-bottom: env(safe-area-inset-bottom); display:flex;flex-direction:column; }
    .tabs { height: 3.5rem; display:flex; align-items:stretch; justify-content:space-around; }
    .brand { height: 1.5rem; border-top: 1px solid rgba(100,116,139,.18); display:flex; align-items:center; justify-content:center; gap:.35rem; color:#64748b; font-size:.72rem; }
    .brand i { color:#7c3aed; font-size:.9rem; }
    .tab { color: #475569; /* slate-600 */ text-decoration: none; min-width: 0; position:relative; transition: color .18s ease, background-color .18s ease, transform .08s ease; border-radius:.5rem; margin:.25rem .25rem; }
    .tab i { font-size: 1.1rem; line-height: 1; }
    /* Indicador superior + realce suave para la pestaña activa */
    .tab.active { color: #0ea5e9; background: rgba(14,165,233,.08); }
    .tab.active::before { content:""; position:absolute; left:18%; right:18%; top:-.25rem; height:3px; background:#0ea5e9; border-radius:2px; }
    /* Feedback táctil al tocar */
    .tab:active { transform: scale(.96); }
  `],
  template: `
  <nav class="md:hidden">
    <div class="tabs">
      @for (it of items(); track it.path) {
      <a [routerLink]="it.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: false }"
        class="tab flex flex-col items-center justify-center gap-0.5 flex-1" (click)="onTabClick(it.key)">
          <i [ngClass]="['bi', it.icon]"></i>
          <span class="text-[11px] leading-none">{{ it.label }}</span>
        </a>
      }
    </div>
    <div class="brand">
      <i class="bi bi-shield-lock"></i>
      <span>DataRegister</span>
    </div>
  </nav>
  `
})
export class MobileBottomNavComponent {
  private readonly _claims = signal<any | null>(null);
  sector = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  private current = signal<'clientes'|'pacientes'|'reportes'|'trabajos'|''>('');

  items = computed(() => {
    const out: Array<{ path: string; label: string; icon: string; key: 'clientes'|'pacientes'|'trabajos'|'reportes' }> = [] as any;
    const cur = this.current();
    const isSalud = this.sector() === 'SALUD';

    // Prioridad: Clientes, Pacientes (si aplica), Trabajos, Reportes
    if (cur !== 'clientes') out.push({ path: '/clientes', label: 'Clientes', icon: 'bi-people', key: 'clientes' });
    if (isSalud && cur !== 'pacientes') out.push({ path: '/pacientes', label: 'Pacientes', icon: 'bi-heart-pulse', key: 'pacientes' });
    if (cur !== 'trabajos') out.push({ path: '/trabajos', label: 'Trabajos', icon: 'bi-briefcase', key: 'trabajos' });
    if (cur !== 'reportes') out.push({ path: '/reportes', label: 'Reportes', icon: 'bi-bar-chart', key: 'reportes' });

    // Limitar a 3 para no saturar la barra
    return out.slice(0, 3);
  });

  constructor(private auth: AuthService, private router: Router, private routeAnim: RouteAnimService) {
    this._claims.set(this.auth.claims());
    // Calcular módulo actual por primer segmento
    const setFromUrl = (url: string) => {
      const seg = (url || '').split('?')[0].split('#')[0];
      const first = seg.startsWith('/') ? seg.slice(1).split('/')[0] : seg.split('/')[0];
      const key = (first || '').toLowerCase();
      if (key === 'clientes' || key === 'pacientes' || key === 'reportes' || key === 'trabajos') {
        this.current.set(key as any);
        this.routeAnim.setCurrentFromUrl(url);
      } else {
        this.current.set('');
        this.routeAnim.setCurrentFromUrl('');
      }
    };
    setFromUrl(this.router.url || '');
    this.router.events.pipe(filter((e: any) => e instanceof NavigationEnd)).subscribe((e: NavigationEnd) => {
      setFromUrl(e.urlAfterRedirects || e.url || '');
    });
  }

  onTabClick(key: 'clientes'|'pacientes'|'trabajos'|'reportes') {
    this.routeAnim.setTarget(key);
  }
}
