export type PlanId = 'free' | 'basic' | 'advance' | 'enterprise';

export interface PlanLimits {
  maxTrabajos: number;              // Límite de trabajos
  maxUsers: number;                 // Número máximo de usuarios
  maxImagesPerJob: number;          // Imágenes por trabajo
  maxPacientes: number;             // Límite de pacientes
  maxClientes: number;              // Límite de clientes
}

export interface Plan {
  id: string;                       // ID interno del plan
  publicId: PlanId;                 // ID público para el frontend
  name: string;                     // Nombre visible del plan
  description: string;              // Breve descripción
  currency: string;                 // Moneda (USD, COP, etc.)
  monthlyPrice: number | null;      // Precio mensual
  annualPrice: number | null;       // Precio anual
  priceCop: number;                 // Precio en COP
  popular: boolean;                 // Para resaltar en el UI
  limits: PlanLimits;               // Capacidades del plan
}

// Respuesta de la API
export interface PlansApiResponse {
  dataResponse: {
    idTx: string;
    response: 'SUCCESS' | 'ERROR';
  };
  data: Plan[];
  message: string;
}
