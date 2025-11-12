import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const SALES_URL = 'http://localhost:8081/sales';
const SALES_LIST_URL = 'http://localhost:8081/sales/list';

export interface SaleProductInput {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface SaleCreateRequest {
  total: number;
  status: string; // e.g. PENDANT
  client: { id: number };
  productList: SaleProductInput[];
}

interface ApiSaleResponse { data?: any; message?: string; dataResponse?: { response?: string; idTx?: string }; error?: Array<{ codError?: string; descError?: string; msgError?: string }>; }

@Injectable({ providedIn: 'root' })
export class SalesService {
  loading = signal(false);
  lastError = signal<string>('');
  constructor(private http: HttpClient) {}

  async create(req: SaleCreateRequest): Promise<{ ok:boolean; message?: string }> {
    this.loading.set(true); this.lastError.set('');
    try {
      const res = await firstValueFrom(this.http.post<ApiSaleResponse>(`${SALES_URL}/create`, req));
      const status = res?.dataResponse?.response;
      if(status === 'SUCCESS') return { ok:true, message: res?.message };
      const err = res?.error?.[0];
      const msg = err?.descError || err?.msgError || res?.message || 'No se pudo registrar la venta.';
      this.lastError.set(msg);
      return { ok:false, message: msg };
    } catch(e:any) {
      const msg = e?.error?.error?.[0]?.descError || e?.message || 'Error de red creando la venta.';
      this.lastError.set(msg);
      return { ok:false, message: msg };
    } finally { this.loading.set(false); }
  }

  async list(date: string | undefined, page = 0, size = 10, status?: string, q?: string): Promise<any[]> {
    this.loading.set(true); this.lastError.set('');
    try {
      const params: any = { page, size };
      if(date && date.trim()) params.date = date.trim();
      if(status && status.trim()) params.status = status.trim();
      if(q && q.trim()) params.q = q.trim();
      const res: any = await firstValueFrom(this.http.get(SALES_LIST_URL, { params }));
      // Support multiple shapes: [], {data:[]}, {data:{content:[]}}
      if (Array.isArray(res)) return res;
      if (res?.data) {
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res.data.content)) return res.data.content;
      }
      return [];
    } catch(e:any) {
      const msg = e?.error?.error?.[0]?.descError || e?.message || 'Error listando ventas.';
      this.lastError.set(msg);
      return [];
    } finally { this.loading.set(false); }
  }

  async detail(id: number): Promise<any | null> {
    if(id == null) return null;
    this.loading.set(true); this.lastError.set('');
    try {
      const res: any = await firstValueFrom(this.http.get(`${SALES_URL}/detail/${id}`));
      // Possible shapes: { data: {...} }, direct object, or { sale: {...} }
      if(res?.data) return res.data;
      if(res?.sale) return res.sale;
      return res || null;
    } catch(e:any) {
      const msg = e?.error?.error?.[0]?.descError || e?.message || 'Error obteniendo detalle de la venta.';
      this.lastError.set(msg);
      return null;
    } finally { this.loading.set(false); }
  }
}
