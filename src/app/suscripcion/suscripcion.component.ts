import { Component, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Plan, PlanId } from '../interfaces/plan';
import { PlanesService } from './planes.service';
import { SubscriptionPeriod } from '../interfaces/subscription';
import { AuthService } from '../core/auth.service';
import { UserProfileService } from '../core/user-profile.service';

@Component({
  selector: 'app-suscripcion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './suscripcion.component.html',
  styleUrls: ['./suscripcion.component.css']
})
export class SuscripcionComponent implements OnInit, OnDestroy {
  plans = signal<Plan[]>([]);
  selectedPlanId = signal<PlanId>('free');
  selectedPeriod = signal<SubscriptionPeriod>('MONTHLY');
  saving = signal(false);
  loading = signal(false);
  success = signal<string | null>(null);
  error = signal<string | null>(null);
  userEmail = signal('');
  
  // Variables para el manejo de la ventana de checkout
  private checkoutWindow: Window | null = null;
  private checkoutCheckInterval: any = null;
  lastCheckoutUrl: string | null = null;
  checkoutWindowClosed = signal(false);

  constructor(
    private planesService: PlanesService, 
    private authService: AuthService,
    public userProfileService: UserProfileService
  ) {
    this.selectedPlanId.set(this.planesService.currentPlanId());
  }

  async ngOnInit() {
    await Promise.all([
      this.loadPlans(),
      this.loadUserEmail()
    ]);
  }

  async loadPlans() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const plans = await this.planesService.list();
      this.plans.set(plans);
    } catch (e) {
      this.error.set('Error al cargar los planes. Intenta recargar la página.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadUserEmail() {
    try {
      const email = await this.userProfileService.getUserEmail();
      this.userEmail.set(email);
    } catch (e) {
      console.error('Error loading user email:', e);
      // Fallback silencioso - el email se mostrará vacío pero la validación lo detectará
    }
  }

  current(): Plan { return this.planesService.current(); }
  isSelected(p: Plan) { return this.selectedPlanId() === p.publicId; }
  select(p: Plan) { 
    this.selectedPlanId.set(p.publicId); 
    this.success.set(null); 
    this.error.set(null); 
    // Limpiar el estado de checkout previo
    this.checkoutWindowClosed.set(false);
    this.lastCheckoutUrl = null;
  }

  getSelectedPlan(): Plan | undefined {
    return this.plans().find(p => p.publicId === this.selectedPlanId());
  }

  getPriceForPeriod(plan: Plan): number {
    if (this.selectedPeriod() === 'ANNUAL') {
      // Descuento del 20% para anual (12 meses * precio mensual * 0.8)
      return Math.round(plan.priceCop * 12 * 0.8);
    }
    return plan.priceCop;
  }

  async suscribirse() {
    if (this.saving()) return;
    
    const selectedPlan = this.getSelectedPlan();
    if (!selectedPlan) {
      this.error.set('Por favor selecciona un plan.');
      return;
    }

    if (!this.userEmail().trim()) {
      this.error.set('No se pudo obtener el email del usuario logueado.');
      return;
    }

    this.saving.set(true);
    this.success.set(null);
    this.error.set(null);
    // Limpiar estado de checkout previo
    this.checkoutWindowClosed.set(false);
    this.lastCheckoutUrl = null;

    try {
      const response = await this.planesService.subscribe(
        selectedPlan.id,
        this.selectedPeriod(),
        this.userEmail(),
        this.authService.claims()?.empresaId || 1
      );

      if (response.dataResponse.response === 'SUCCESS') {
        if (response.data.nextAction === 'none') {
          // Plan gratuito
          this.planesService.select(this.selectedPlanId());
          this.success.set(response.data.message || 'Plan actualizado correctamente.');
        } else if (response.data.nextAction === 'redirect' && response.data.redirectUrl) {
          // Abrir checkout en nueva pestaña
          this.openCheckoutInNewTab(response.data.redirectUrl);
        }
      } else {
        const errorMsg = response.error?.map(e => e.descError || e.msgError).filter(Boolean).join(', ');
        throw new Error(errorMsg || response.message || 'Error desconocido');
      }
    } catch (e: any) {
      console.error('Error al suscribirse:', e);
      this.error.set(e.message || 'No se pudo procesar la suscripción. Intenta nuevamente.');
    } finally {
      this.saving.set(false);
    }
  }

  private openCheckoutInNewTab(redirectUrl: string) {
    this.success.set('Abriendo ventana de pago...');
    this.lastCheckoutUrl = redirectUrl;
    this.checkoutWindowClosed.set(false);
    
    // Abrir nueva ventana/pestaña
    this.checkoutWindow = window.open(
      redirectUrl, 
      'mercadopago_checkout',
      'width=800,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes'
    );

    if (!this.checkoutWindow) {
      this.error.set('No se pudo abrir la ventana de pago. Por favor habilita las ventanas emergentes e intenta nuevamente.');
      return;
    }

    // Mostrar mensaje informativo
    this.success.set('Ventana de pago abierta. Completa tu pago en la nueva pestaña.');

    // Iniciar monitoreo de la ventana
    this.startCheckoutMonitoring();
  }

  private startCheckoutMonitoring() {
    // Limpiar cualquier monitoreo previo
    this.clearCheckoutMonitoring();

    // Verificar cada segundo si la ventana se cerró
    this.checkoutCheckInterval = setInterval(() => {
      if (this.checkoutWindow && this.checkoutWindow.closed) {
        this.onCheckoutWindowClosed();
      }
    }, 1000);

    // También escuchar si el usuario vuelve a esta ventana (focus)
    window.addEventListener('focus', this.onWindowFocus);
  }

  private onCheckoutWindowClosed() {
    console.log('Ventana de checkout cerrada');
    this.clearCheckoutMonitoring();
    this.checkoutWindowClosed.set(true);
    
    // Mostrar mensaje de error/cancelación después de un breve delay
    // para dar tiempo a que se procese cualquier redirect de éxito
    setTimeout(() => {
      if (!this.success()?.includes('correctamente')) {
        this.error.set('La ventana de pago se cerró. Si completaste el pago, por favor espera unos momentos para que se actualice tu suscripción. Si cancelaste o cerraste la ventana por error, puedes reabrirla.');
        this.success.set(null);
      }
    }, 2000);
  }

  private onWindowFocus = () => {
    // Cuando el usuario vuelve a esta ventana, verificar si la ventana de checkout sigue abierta
    if (this.checkoutWindow && this.checkoutWindow.closed) {
      this.onCheckoutWindowClosed();
    }
  }

  private clearCheckoutMonitoring() {
    if (this.checkoutCheckInterval) {
      clearInterval(this.checkoutCheckInterval);
      this.checkoutCheckInterval = null;
    }
    window.removeEventListener('focus', this.onWindowFocus);
  }

  reopenCheckoutWindow() {
    if (this.lastCheckoutUrl) {
      this.openCheckoutInNewTab(this.lastCheckoutUrl);
    }
  }

  ngOnDestroy() {
    // Limpiar recursos al destruir el componente
    this.clearCheckoutMonitoring();
    if (this.checkoutWindow && !this.checkoutWindow.closed) {
      this.checkoutWindow.close();
    }
  }
}
