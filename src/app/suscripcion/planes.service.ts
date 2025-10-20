import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Plan, PlanId, PlansApiResponse } from '../interfaces/plan';

const STORAGE_KEY = 'app.currentPlanId';

@Injectable({ providedIn: 'root' })
export class PlanesService {
  private plans = signal<Plan[]>([]);
  private loaded = signal(false);
  
  currentPlanId = signal<PlanId>(this.loadInitialPlan());

  constructor(private http: HttpClient) {}

  private loadInitialPlan(): PlanId {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw === 'basic' || raw === 'advance' || raw === 'enterprise' || raw === 'free') return raw;
    return 'free';
  }

  private persist(planId: PlanId) {
    try {
      localStorage.setItem(STORAGE_KEY, planId);
    } catch {
      // ignore
    }
  }

  async loadPlans(): Promise<Plan[]> {
    if (this.loaded()) {
      return this.plans();
    }

    try {
      const apiBase = 'http://localhost:8081';
      const response = await firstValueFrom(
        this.http.get<PlansApiResponse>(`${apiBase}/pay/plans`)
      );

      if (response.dataResponse.response === 'SUCCESS') {
        this.plans.set(response.data);
        this.loaded.set(true);
        return response.data;
      } else {
        throw new Error('Error al cargar planes desde la API');
      }
    } catch (error) {
      console.error('Error loading plans from API:', error);
      // Fallback a datos locales en caso de error
      const fallbackPlans = this.getFallbackPlans();
      this.plans.set(fallbackPlans);
      this.loaded.set(true);
      return fallbackPlans;
    }
  }

  private getFallbackPlans(): Plan[] {
    return [
      {
        id: 'BASIC',
        publicId: 'free',
        name: 'Free',
        description: 'Ideal para comenzar',
        currency: 'USD',
        monthlyPrice: null,
        annualPrice: null,
        priceCop: 0,
        popular: false,
        limits: {
          maxTrabajos: 200,
          maxUsers: 3,
          maxImagesPerJob: 4,
          maxPacientes: 100,
          maxClientes: 100
        }
      },
      {
        id: 'BASIC',
        publicId: 'basic',
        name: 'Basic',
        description: 'Para equipos pequeños',
        currency: 'USD',
        monthlyPrice: null,
        annualPrice: null,
        priceCop: 50,
        popular: false,
        limits: {
          maxTrabajos: 1000,
          maxUsers: 6,
          maxImagesPerJob: 6,
          maxPacientes: 500,
          maxClientes: 500
        }
      },
      {
        id: 'PRO',
        publicId: 'advance',
        name: 'Advance',
        description: 'Más capacidad y control',
        currency: 'USD',
        monthlyPrice: null,
        annualPrice: null,
        priceCop: 80,
        popular: true,
        limits: {
          maxTrabajos: 2000,
          maxUsers: 25,
          maxImagesPerJob: 8,
          maxPacientes: 1000,
          maxClientes: 1000
        }
      },
      {
        id: 'ENTERPRISE',
        publicId: 'enterprise',
        name: 'Enterprise',
        description: 'Empresas con alta demanda',
        currency: 'USD',
        monthlyPrice: null,
        annualPrice: null,
        priceCop: 100,
        popular: false,
        limits: {
          maxTrabajos: 3000,
          maxUsers: 100,
          maxImagesPerJob: 10,
          maxPacientes: 2000,
          maxClientes: 2000
        }
      }
    ];
  }

  async list(): Promise<Plan[]> {
    return await this.loadPlans();
  }

  getById(publicId: PlanId): Plan | undefined {
    return this.plans().find(p => p.publicId === publicId);
  }

  current(): Plan {
    if (this.plans().length === 0) {
      // Si no hay planes cargados, usar fallback simple
      return {
        id: 'BASIC',
        publicId: 'free',
        name: 'Free',
        description: 'Ideal para comenzar',
        currency: 'USD',
        monthlyPrice: null,
        annualPrice: null,
        priceCop: 0,
        popular: false,
        limits: {
          maxTrabajos: 200,
          maxUsers: 3,
          maxImagesPerJob: 4,
          maxPacientes: 100,
          maxClientes: 100
        }
      };
    }
    
    const currentPlan = this.getById(this.currentPlanId());
    return currentPlan || this.plans()[0];
  }

  select(planId: PlanId) {
    this.currentPlanId.set(planId);
    this.persist(planId);
  }
}
