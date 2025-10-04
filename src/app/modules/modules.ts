// src/app/modules/modules.component.ts
import { Component, computed, signal, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, JwtClaims } from '../core/auth.service';
import { TourService } from '../core/tour.service';

// 👇 agrega estos imports
import { UsageService } from '../core/usage.service';
import { ConfigService } from '../core/config.service';

@Component({
  selector: 'app-modules',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './modules.html',
  styleUrls: ['./modules.css']
})
export class Modules implements AfterViewInit {

  private readonly auth = inject(AuthService);
  private readonly tour = inject(TourService);

  // 👇 nuevos servicios
  private readonly usage = inject(UsageService);
  private readonly cfg   = inject(ConfigService);

  private readonly _claims = signal<JwtClaims | null>(null);

  sector    = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  role      = computed(() => (this._claims()?.role ?? '').toUpperCase());
  empresa   = computed(() => this._claims()?.empresa ?? '');
  user      = computed(() => this._claims()?.sub ?? '');
  empresaId = computed(() => Number(this._claims()?.empresaId ?? 0));

  constructor() {
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());

    // Configura base del servicio de uso
    this.usage.setApiBase(this.cfg.get<string>('apiBaseUrl', ''));
  }

  async ngAfterViewInit(): Promise<void> {
    // Asegura que los cards estén en el DOM
    setTimeout(async () => {
      const hasOneKey   = `mop:hasOne:${this.empresaId()}`;
      const userKeyPart = `${this.empresa()}:${this.user()}`;

      // 1) Si es ADMIN y aún no tiene métodos → forzar flujo de pagos y salir
      if (this.role() === 'ADMIN' && localStorage.getItem(hasOneKey) !== '1') {
        this.tour.startAdminPaymentEnforcedTour(this.role(), userKeyPart);
        // Igual enviamos ping de uso (pero no bloqueamos)
        this.safePingOncePerSession();
        return;
      }

      // 2) Tour normal + nudge
      this.tour.startModulesTour(this.role(), this.sector(), userKeyPart, () => {
        this.tour.startPaymentNudge(this.role(), userKeyPart);
      });

      // 3) Ping de uso (una sola vez por sesión)
      this.safePingOncePerSession();
    }, 200);
  }

  // ====== Helpers ======
  private sessionPingKey(): string {
    // Un ping por sesión y por usuario/empresa
    return `usagePing:${this.empresaId()}:${this.user()}`;
  }

  private async safePingOncePerSession() {
    const k = this.sessionPingKey();
    if (sessionStorage.getItem(k) === '1') return;

    try {
      await this.sendPing();           // no lanza; maneja errores internamente
      sessionStorage.setItem(k, '1'); // marca como enviado
    } catch {
      // fail-silent
    }
  }

  private async sendPing(): Promise<void> {
    // Geolocalización opcional (HTTPS o permiso)
    const getPosition = () =>
      new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 4000 }
        );
      });

    const pos = await getPosition();

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const platform = navigator.userAgent;

    // Enviamos info útil para tu backend
    this.usage.ping({
      lat: pos?.coords?.latitude ?? null,
      lng: pos?.coords?.longitude ?? null,
      appVersion: 'web-1.0.0',
      tz,
      platform,
      // campos “de negocio” útiles en tu lado
      empresaId: this.empresaId() || null,
      usuario: this.user() || null,
      sector: this.sector() || null,
      rol: this.role() || null
    }).subscribe({
      next: () => { /* ok */ },
      error: () => { /* fail-silent */ }
    });
  }
}
