// src/app/modules/modules.component.ts
import { Component, computed, signal, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, JwtClaims } from '../core/auth.service';
import { TourService } from '../core/tour.service';

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

  private readonly _claims = signal<JwtClaims | null>(null);

  sector    = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  role      = computed(() => (this._claims()?.role ?? '').toUpperCase());
  empresa   = computed(() => this._claims()?.empresa ?? '');
  user      = computed(() => this._claims()?.sub ?? '');
  empresaId = computed(() => Number(this._claims()?.empresaId ?? 0));

  constructor() {
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());
  }

  ngAfterViewInit(): void {
    // Asegura que los cards estén en el DOM
    setTimeout(() => {
      const hasOneKey   = `mop:hasOne:${this.empresaId()}`;
      const userKeyPart = `${this.empresa()}:${this.user()}`;

      // 1) Si es ADMIN y aún no tiene métodos → forzar flujo de pagos y salir
      if (this.role() === 'ADMIN' && localStorage.getItem(hasOneKey) !== '1') {
        this.tour.startAdminPaymentEnforcedTour(this.role(), userKeyPart);
        return; // no ejecutar el tour de módulos en este caso
      }

      // 2) Si no aplica forzado, corre tour de módulos y luego el nudge (idempotente)
      this.tour.startModulesTour(this.role(), this.sector(), userKeyPart, () => {
        this.tour.startPaymentNudge(this.role(), userKeyPart);
      });
    }, 200);
  }
}