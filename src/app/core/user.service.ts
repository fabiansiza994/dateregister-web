import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api.config';

const USERS_SEARCH_URL = `${API_BASE}/users/search`;
const USERS_REGISTER_URL = `${API_BASE}/users/register`;
const USERS_DETAIL_URL = (id:number) => `${API_BASE}/users/${id}`;
const USERS_UPDATE_URL = `${API_BASE}/users/update`;

export interface UserDTO { id: number; username: string; name: string; email?: string; status?: string; role?: any; rol?: any; }

@Injectable({ providedIn: 'root' })
export class UserService {
  loading = signal(false);
  lastError = signal<string>('');
  constructor(private http: HttpClient) {}

  async search(name?: string, page = 0, size = 10): Promise<UserDTO[]> {
    this.loading.set(true); this.lastError.set('');
    try {
      const params: any = { page, size };
      if ((name||'').trim()) params.name = (name||'').trim();
      const res: any = await firstValueFrom(this.http.get(USERS_SEARCH_URL, { params }));
      if (Array.isArray(res)) return res as UserDTO[];
      if (res?.data) {
        if (Array.isArray(res.data)) return res.data as UserDTO[];
        if (Array.isArray(res.data.content)) return res.data.content as UserDTO[];
      }
      return [];
    } catch (e:any) {
      this.lastError.set(e?.message || 'Error buscando usuarios');
      return [];
    } finally { this.loading.set(false); }
  }

  async register(payload: { username:string; name:string; email?:string; password:string; rolId:number }): Promise<{ ok:boolean; message?: string; id?: number }>{
    this.loading.set(true); this.lastError.set('');
    try {
      const body = { username: payload.username, name: payload.name, email: payload.email, password: payload.password, rol: { id: payload.rolId } };
      const res: any = await firstValueFrom(this.http.post(USERS_REGISTER_URL, body));
      const success = res?.dataResponse?.response === 'SUCCESS' || res?.status === 'SUCCESS' || !!res?.id || !!res?.data?.id;
      if(success) return { ok:true, message: res?.message || 'Usuario creado', id: res?.id || res?.data?.id };
      const msg = res?.error?.[0]?.descError || res?.message || 'No se pudo crear el usuario';
      return { ok:false, message: msg };
    } catch(e:any) {
      const msg = e?.error?.error?.[0]?.descError || e?.error?.message || e?.message || 'Error de red creando usuario';
      return { ok:false, message: msg };
    } finally { this.loading.set(false); }
  }

  async getById(id: number): Promise<UserDTO | undefined> {
    this.loading.set(true); this.lastError.set('');
    try {
      const res: any = await firstValueFrom(this.http.get(USERS_DETAIL_URL(id)));
      if (!res) return undefined;
      if (res?.data) return res.data as UserDTO;
      return res as UserDTO;
    } catch(e:any) {
      this.lastError.set(e?.message || 'Error obteniendo usuario');
      return undefined;
    } finally { this.loading.set(false); }
  }

  async update(payload: { id:number; name?:string; email?:string; roleId:number; password?: string }): Promise<{ ok:boolean; message?: string }>{
    this.loading.set(true); this.lastError.set('');
    try {
      const body: any = { id: payload.id, name: payload.name, email: payload.email, role: { id: payload.roleId } };
      if((payload.password||'').trim()){ body.password = (payload.password||'').trim(); }
      const res: any = await firstValueFrom(this.http.put(USERS_UPDATE_URL, body));
      const success = res?.dataResponse?.response === 'SUCCESS' || res?.status === 'SUCCESS' || res?.success === true;
      if(success) return { ok:true, message: res?.message || 'Usuario actualizado' };
      const msg = res?.error?.[0]?.descError || res?.message || 'No se pudo actualizar el usuario';
      return { ok:false, message: msg };
    } catch(e:any) {
      const msg = e?.error?.error?.[0]?.descError || e?.error?.message || e?.message || 'Error de red actualizando usuario';
      return { ok:false, message: msg };
    } finally { this.loading.set(false); }
  }
}
