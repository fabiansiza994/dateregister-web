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

  sector  = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  role    = computed(() => (this._claims()?.role ?? '').toUpperCase());
  empresa = computed(() => this._claims()?.empresa ?? '');
  user    = computed(() => this._claims()?.sub ?? '');

  constructor() {
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());
  }

  ngAfterViewInit(): void {
    // Asegura que los cards estén en DOM
    setTimeout(() => {
      // 1) Corre tour de módulos (solo 1 vez por key)
      this.tour.startModulesTour(this.role(), this.sector(), () => {
        // 2) Al terminar, si es ADMIN, muestra el nudge de pagos (también puedes guardarlo con una key)
        const NUDGE_KEY = 'tour:nudge:pagos:v1';
        if (!localStorage.getItem(NUDGE_KEY) && this.role() === 'ADMIN') {
          this.tour.startPaymentNudge(this.role());
          localStorage.setItem(NUDGE_KEY, '1');
        }
      });
    }, 200);
  }
}
