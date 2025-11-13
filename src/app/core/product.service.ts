import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api.config';

const API_URL = `${API_BASE}/products`;
const SEARCH_URL = `${API_BASE}/products/search`;

export interface ProductCategory { id: number; name?: string; }
export interface ProductDTO {
  id?: number;
  name: string;
  description: string;
  price: number;
  quantity: number | string;
  category: ProductCategory;
  brand: string;
  status: string;
  image?: string; // base64 image string
}

interface ApiListResponse { data: ProductDTO[]; message?: string; }
interface ApiItemResponse { data: ProductDTO; message?: string; }
interface ApiDeleteResponse { data?: any; message?: string; dataResponse?: { idTx?: string; response?: string }; error?: Array<{ codError?: string; descError?: string; msgError?: string }>; }

@Injectable({ providedIn: 'root' })
export class ProductService {
  loading = signal(false);
  constructor(private http: HttpClient) {}

  async list(): Promise<ProductDTO[]> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.http.get<ApiListResponse>(`${API_URL}/list`));
      return res?.data || [];
    } finally { this.loading.set(false); }
  }

  async get(id: number): Promise<ProductDTO | null> {
    const res = await firstValueFrom(this.http.get<ApiItemResponse>(`${API_URL}/${id}`));
    return res?.data || null;
  }

  async create(p: ProductDTO): Promise<ProductDTO | null> {
    const res = await firstValueFrom(this.http.post<ApiItemResponse>(`${API_URL}/create`, p));
    return res?.data || null;
  }

  async update(p: ProductDTO): Promise<ProductDTO | null> {
    const res = await firstValueFrom(this.http.put<ApiItemResponse>(`${API_URL}/update`, p));
    return res?.data || null;
  }

  async remove(id: number): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await firstValueFrom(this.http.delete<ApiDeleteResponse>(`${API_URL}/${id}`));
      const success = res?.dataResponse?.response === 'SUCCESS' || (res as any)?.status === 'SUCCESS' || !!res?.data;
      if (success) return { ok: true, message: res?.message };
      const err = res?.error?.[0];
      const msg = err?.descError || err?.msgError || res?.message || 'No se pudo eliminar el producto.';
      return { ok: false, message: msg };
    } catch (e: any) {
      const msg = e?.error?.error?.[0]?.descError || e?.error?.message || e?.message || 'Error de red eliminando producto.';
      return { ok: false, message: msg };
    }
  }

  async search(name: string, page = 0, size = 10): Promise<ProductDTO[]> {
    const q = (name || '').trim();
    if(!q) return [];
    this.loading.set(true);
    try {
      // Backend may return either { data: ProductDTO[] } or ProductDTO[] directly
      const res: any = await firstValueFrom(this.http.get<any>(`${SEARCH_URL}`, { params: { name: q, page, size } as any }));
      if (Array.isArray(res)) return res as ProductDTO[];
      if (res?.data) {
        if (Array.isArray(res.data)) return res.data as ProductDTO[];
        if (Array.isArray(res.data.content)) return res.data.content as ProductDTO[];
      }
      return [];
    } finally { this.loading.set(false); }
  }
}
