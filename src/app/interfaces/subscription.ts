export type SubscriptionPeriod = 'MONTHLY' | 'ANNUAL';

export interface SubscribeRequest {
  planId: string;           // "BASIC", "PRO", "ENTERPRISE"
  period: SubscriptionPeriod;
  payerEmail: string;
  empresaId: number;
}

export interface SubscribeResponse {
  dataResponse: {
    idTx: string;
    response: 'SUCCESS' | 'ERROR';
  };
  data: {
    subscriptionId?: string;
    nextAction: 'none' | 'redirect';
    redirectUrl?: string;
    message?: string;
  };
  message: string;
  error?: Array<{
    msgError?: string;
    descError?: string;
  }>;
}

// Para URLs de retorno de Mercado Pago
export interface PaymentReturn {
  status: 'success' | 'pending' | 'failure';
  subscriptionId?: string;
  paymentId?: string;
  message?: string;
}