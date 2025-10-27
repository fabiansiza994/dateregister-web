import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlanesService } from '../suscripcion/planes.service';

type PaymentStatus = 'success' | 'pending' | 'failure';

@Component({
  selector: 'app-payment-return',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="mx-auto max-w-2xl p-4">
      <div class="text-center">
        @if (status === 'success') {
          <div class="text-green-600 mb-4">
            <i class="bi bi-check-circle-fill text-4xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-green-700 mb-2">¡Pago exitoso!</h1>
          <p class="text-slate-600 mb-4">Tu suscripción ha sido activada correctamente.</p>
          <div class="alert alert-success">
            <strong>ID de suscripción:</strong> {{ subscriptionId || 'N/A' }}
          </div>
        } @else if (status === 'pending') {
          <div class="text-yellow-600 mb-4">
            <i class="bi bi-clock-fill text-4xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-yellow-700 mb-2">Pago pendiente</h1>
          <p class="text-slate-600 mb-4">Tu pago está siendo procesado. Te notificaremos cuando esté listo.</p>
          <div class="alert alert-warning">
            <strong>ID de pago:</strong> {{ paymentId || 'N/A' }}
          </div>
        } @else {
          <div class="text-red-600 mb-4">
            <i class="bi bi-x-circle-fill text-4xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-red-700 mb-2">Error en el pago</h1>
          <p class="text-slate-600 mb-4">Hubo un problema con tu pago. Por favor intenta nuevamente.</p>
          @if (message) {
            <div class="alert alert-danger">
              {{ message }}
            </div>
          }
        }

        <div class="mt-6 flex gap-3 justify-center">
          <a routerLink="/suscripcion" class="btn btn-primary">
            <i class="bi bi-arrow-left me-1"></i>
            Volver a suscripciones
          </a>
          <a routerLink="/perfil" class="btn btn-outline">
            <i class="bi bi-person me-1"></i>
            Ver perfil
          </a>
        </div>
      </div>
    </div>
  `
})
export class PaymentReturnComponent implements OnInit {
  status: PaymentStatus = 'success';
  subscriptionId?: string;
  paymentId?: string;
  message?: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private planesService: PlanesService
  ) {}

  ngOnInit() {
    // Obtener el status de la URL
    const segment = this.route.snapshot.url[this.route.snapshot.url.length - 1]?.path;
    
    if (segment === 'success' || segment === 'pending' || segment === 'failure') {
      this.status = segment as PaymentStatus;
    }

    // Obtener parámetros de query
    this.route.queryParams.subscribe(params => {
      this.subscriptionId = params['subscription_id'];
      this.paymentId = params['payment_id'];
      this.message = params['message'];

      // Si es exitoso, actualizar el plan localmente
      if (this.status === 'success' && params['plan_id']) {
        // Aquí podrías hacer una llamada al backend para confirmar el estado
        // Por ahora solo actualizamos localmente
        console.log('Pago exitoso para plan:', params['plan_id']);
      }
    });
  }
}