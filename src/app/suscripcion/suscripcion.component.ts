import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Plan, PlanId } from '../interfaces/plan';
import { PlanesService } from './planes.service';

@Component({
  selector: 'app-suscripcion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './suscripcion.component.html',
  styleUrls: ['./suscripcion.component.css']
})
export class SuscripcionComponent implements OnInit {
  plans = signal<Plan[]>([]);
  selectedPlanId = signal<PlanId>('free');
  saving = signal(false);
  loading = signal(false);
  success = signal<string | null>(null);
  error = signal<string | null>(null);

  constructor(private planesService: PlanesService) {
    this.selectedPlanId.set(this.planesService.currentPlanId());
  }

  async ngOnInit() {
    await this.loadPlans();
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

  current(): Plan { return this.planesService.current(); }
  isSelected(p: Plan) { return this.selectedPlanId() === p.publicId; }
  select(p: Plan) { this.selectedPlanId.set(p.publicId); this.success.set(null); this.error.set(null); }

  actualizar() {
    if (this.saving()) return;
    this.saving.set(true);
    this.success.set(null);
    this.error.set(null);
    try {
      // Aquí en el futuro llamaríamos al backend para crear/actualizar la suscripción.
      this.planesService.select(this.selectedPlanId());
      this.success.set('Tu suscripción se actualizó correctamente.');
    } catch (e) {
      this.error.set('No se pudo actualizar la suscripción. Intenta nuevamente.');
    } finally {
      this.saving.set(false);
    }
  }
}
