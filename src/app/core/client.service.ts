import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api.config';

const CLIENTS_BASE_URL = `${API_BASE}/clients`;
const CLIENTS_LIST_URL = `${CLIENTS_BASE_URL}/list`;
const CLIENTS_CREATE_URL = `${CLIENTS_BASE_URL}/create`;
const CLIENTS_UPDATE_URL = `${CLIENTS_BASE_URL}/update`;

export interface ClientDTO { id: number; name: string; email?: string; phone?: string; status?: string; }

@Injectable({ providedIn: 'root' })
export class ClientService {
  loading = signal(false);
  constructor(private http: HttpClient) {}

  async list(page = 0, size = 10): Promise<ClientDTO[]> {
    this.loading.set(true);
    try {
      const params: any = { page, size };
  const res: any = await firstValueFrom(this.http.get(CLIENTS_LIST_URL, { params }));
      if (Array.isArray(res)) return res as ClientDTO[];
      if (res?.data) {
        if (Array.isArray(res.data)) return res.data as ClientDTO[];
        if (Array.isArray(res.data.content)) return res.data.content as ClientDTO[];
      }
      return [];
    } finally { this.loading.set(false); }
  }

  async search(name: string, page = 0, size = 10): Promise<ClientDTO[]> {
    const q = (name || '').trim();
    if(!q) return [];
    this.loading.set(true);
    try {
      const params: any = { page, size, name: q };
  const res: any = await firstValueFrom(this.http.get(CLIENTS_LIST_URL, { params }));
      if (Array.isArray(res)) return res as ClientDTO[];
      if (res?.data) {
        if (Array.isArray(res.data)) return res.data as ClientDTO[];
        if (Array.isArray(res.data.content)) return res.data.content as ClientDTO[];
      }
      return [];
    } finally { this.loading.set(false); }
  }

  async create(payload: { name: string; email?: string; phone?: string; address?: string; status?: string }): Promise<{ ok:boolean; message?: string; id?: number }>{
    this.loading.set(true);
    try {
      const res: any = await firstValueFrom(this.http.post(CLIENTS_CREATE_URL, payload));
      // Possible success shapes: { dataResponse:{response:'SUCCESS'} }, { id: ... }, { data:{ id:... } }, 2xx with body
      const success = res?.dataResponse?.response === 'SUCCESS' || res?.status === 'SUCCESS' || !!res?.id || !!res?.data?.id;
      if(success) return { ok:true, message: res?.message || 'Cliente creado', id: res?.id || res?.data?.id };
      // try find error field
      const msg = res?.error?.[0]?.descError || res?.message || 'No se pudo crear el cliente';
      return { ok:false, message: msg };
    } catch(e:any){
      const msg = e?.error?.error?.[0]?.descError || e?.error?.message || e?.message || 'Error de red creando el cliente';
      return { ok:false, message: msg };
    } finally { this.loading.set(false); }
  }

  async get(id: number): Promise<ClientDTO | null> {
    if(!id) return null;
    try {
      const res: any = await firstValueFrom(this.http.get(`${CLIENTS_BASE_URL}/${id}`));
      if(res?.data) return res.data as ClientDTO;
      if(res?.client) return res.client as ClientDTO;
      return res as ClientDTO; // fallback if backend returns raw dto
    } catch { return null; }
  }

  async update(payload: { id:number; name: string; email?: string; phone?: string; address?: string; status?: string }): Promise<{ ok:boolean; message?: string }>{
    if(!payload?.id) return { ok:false, message:'ID inválido' };
    this.loading.set(true);
    try {
      const res: any = await firstValueFrom(this.http.put(CLIENTS_UPDATE_URL, payload));
      const success = res?.dataResponse?.response === 'SUCCESS' || res?.status === 'SUCCESS' || !!res?.data || res?.ok === true;
      if(success) return { ok:true, message: res?.message || 'Cliente actualizado' };
      const msg = res?.error?.[0]?.descError || res?.message || 'No se pudo actualizar el cliente';
      return { ok:false, message: msg };
    } catch(e:any){
      const msg = e?.error?.error?.[0]?.descError || e?.error?.message || e?.message || 'Error de red actualizando cliente';
      return { ok:false, message: msg };
    } finally { this.loading.set(false); }
  }
}
