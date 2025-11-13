import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api.config';

const API_URL = `${API_BASE}/category`;
const SEARCH_URL = `${API_BASE}/category/search`;

export interface CategoryDTO {
  id?: number;
  name: string;
  code: string;
  description?: string | null;
  desctiption?: string | null; // algunos backends usan esta clave mal escrita
  status: string;
  icon?: string; // nuevo campo para mostrar icono en UI
}

interface ApiListResponse { data: CategoryDTO[]; message?: string; }
interface ApiItemResponse { data: CategoryDTO; message?: string; }
interface ApiDeleteResponse { data?: any; message?: string; dataResponse?: { idTx?: string; response?: string }; error?: Array<{ codError?: string; descError?: string; msgError?: string }>; }
interface ApiListResponseMaybe { data?: CategoryDTO[]; message?: string; }

@Injectable({ providedIn: 'root' })
export class CategoryService {
  loading = signal(false);
  constructor(private http: HttpClient) {}

  async list(): Promise<CategoryDTO[]> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.http.get<ApiListResponse>(`${API_URL}/list`));
      return res?.data || [];
    } finally { this.loading.set(false); }
  }

  async get(id: number): Promise<CategoryDTO | null> {
    const res = await firstValueFrom(this.http.get<ApiItemResponse>(`${API_URL}/${id}`));
    return res?.data || null;
  }

  async create(c: { name: string; code?: string; description?: string; icon?: string }): Promise<CategoryDTO | null> {
    const payload: CategoryDTO = {
      name: c.name,
      code: c.code || c.name.trim().toUpperCase().replace(/\s+/g, '_'),
      description: c.description || null,
      desctiption: c.description || null,
      status: 'ACTIVE',
      icon: c.icon || undefined
    };
    const res = await firstValueFrom(this.http.post<ApiItemResponse>(`${API_URL}/create`, payload));
    return res?.data || null;
  }

  async update(c: CategoryDTO): Promise<CategoryDTO | null> {
    const payload: CategoryDTO = {
      id: c.id,
      name: c.name,
      code: c.code,
      description: c.description ?? null,
      desctiption: c.description ?? null,
      status: c.status,
      icon: c.icon
    };
    const res = await firstValueFrom(this.http.put<ApiItemResponse>(`${API_URL}/update`, payload));
    return res?.data || null;
  }

  async remove(id: number): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await firstValueFrom(this.http.delete<ApiDeleteResponse>(`${API_URL}/${id}`));
      // Success only if dataResponse.response === 'SUCCESS'
      const status = res?.dataResponse?.response;
      if (status === 'SUCCESS') return { ok: true, message: res?.message };
      // Extract first error description if present
      const err = res?.error?.[0];
      const msg = err?.descError || err?.msgError || res?.message || 'No se pudo eliminar la categoría.';
      return { ok: false, message: msg };
    } catch (e: any) {
      const msg = e?.error?.error?.[0]?.descError || e?.message || 'Error de red eliminando categoría.';
      return { ok: false, message: msg };
    }
  }

  async search(name: string, page = 0, size = 10): Promise<CategoryDTO[]> {
    const q = (name || '').trim();
    if(!q) return [];
    this.loading.set(true);
    try {
      const res: any = await firstValueFrom(this.http.get(SEARCH_URL, { params: { name: q, page, size } as any }));
      if (Array.isArray(res)) return res as CategoryDTO[];
      if (res?.data) {
        if (Array.isArray(res.data)) return res.data as CategoryDTO[];
        if (Array.isArray(res.data.content)) return res.data.content as CategoryDTO[];
      }
      return [];
    } finally { this.loading.set(false); }
  }
}
