import { Component, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { FooterComponent } from './shared/footer/footer.component';
import { MobileBottomNavComponent } from './shared/mobile-bottom-nav/mobile-bottom-nav.component';
import { filter } from 'rxjs/operators';
import { trigger, transition, style, query, group, animate } from '@angular/animations';
import { RouteAnimService } from './core/route-anim.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FooterComponent, MobileBottomNavComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],   // <- en plural
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        style({ position: 'relative', overflowX: 'hidden' }),
        query(':enter, :leave', [ style({ position: 'absolute', width: '100%' }) ], { optional: true }),
        group([
          query(':leave', [ animate('220ms ease', style({ transform: 'translateX({{leaveX}})' })) ], { optional: true }),
          query(':enter', [ style({ transform: 'translateX({{enterFrom}})' }), animate('280ms ease', style({ transform: 'translateX(0%)' })) ], { optional: true }),
        ])
      ], { params: { enterFrom: '100%', leaveX: '-30%' } })
    ])
  ]
})
export class App {
  title = 'dataregister-web';
  isTrabajos = signal(false);
  isModules = signal(false);
  isLogin = signal(false);
  // 'forward' or 'backward' based on bottom tab order
  private dir = signal<'forward' | 'backward'>('forward');

  constructor(private router: Router, private routeAnim: RouteAnimService) {
    // Estado inicial (por si arranca en /trabajos)
  const url0 = this.router.url || '';
  this.isTrabajos.set(url0.startsWith('/trabajos'));
  this.isLogin.set(
    url0.startsWith('/login') || url0.startsWith('/register') || url0.startsWith('/verifycode')
  );
  this.isModules.set(url0.startsWith('/modules'));
    // Actualizar al navegar
    this.router.events
      .pipe(filter((e: any) => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const u = e.urlAfterRedirects || e.url || '';
        this.isTrabajos.set(u.startsWith('/trabajos'));
        this.isLogin.set(
          u.startsWith('/login') || u.startsWith('/register') || u.startsWith('/verifycode')
        );
        this.isModules.set(u.startsWith('/modules'));
        // Sync current tab and capture last direction
        this.routeAnim.setCurrentFromUrl(u);
        this.dir.set(this.routeAnim.getDirection());
      });
  }

  routeAnimParams() {
    // Sólo animar en móvil; en md+ usamos desplazamientos 0.
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) {
      return { value: 'slide', params: { enterFrom: '0%', leaveX: '0%' } };
    }
    const forward = this.dir() === 'forward';
    return forward
      ? { value: 'slide', params: { enterFrom: '100%', leaveX: '-30%' } }
      : { value: 'slide', params: { enterFrom: '-100%', leaveX: '30%' } };
  }
}
