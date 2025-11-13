import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api.config';

export interface LoginResponse {
  dataResponse?: { idTx?: string; response?: string };
  data: { token: string; username: string; role: string };
  message?: string;
}

const API_URL = API_BASE;

export type Role = 'ADMIN' | 'VENDEDOR' | 'SUPERVISOR';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _role = signal<Role | null>(null);
  private _token = signal<string | null>(null);
  private _username = signal<string | null>(null);
  constructor(private http: HttpClient) {
    // Eagerly hydrate from localStorage so UI has role/token on first render (after refresh)
    try {
      const t = localStorage.getItem('inventra-token');
      if (t) this._token.set(t);
      const rawRole = (localStorage.getItem('inventra-role') || '').toString();
      if (rawRole) {
        const upper = rawRole.toUpperCase();
        const role: Role = upper.includes('ADMIN') ? 'ADMIN' : upper.includes('SUPERVISOR') ? 'SUPERVISOR' : 'VENDEDOR';
        this._role.set(role);
      }
      const u = localStorage.getItem('inventra-username');
      if (u) this._username.set(u);
    } catch {}
  }

  async login(user: string, pass: string): Promise<boolean> {
    const body = { username: user, password: pass };
    const res = await firstValueFrom(this.http.post<LoginResponse>(`${API_URL}/auth/login`, body));
  const token = res?.data?.token || '';
  const roleStr = (res?.data?.role || '').toString();
  const username = res?.data?.username || user;
    const role: Role = roleStr.includes('ADMIN') ? 'ADMIN' : roleStr.includes('SUPERVISOR') ? 'SUPERVISOR' : 'VENDEDOR';
    if (!token) return false;
    this._role.set(role);
    this._token.set(token);
    this._username.set(username);
    try { localStorage.setItem('inventra-token', token); localStorage.setItem('inventra-role', role); localStorage.setItem('inventra-username', username); } catch {}
    return true;
  }
  logout() {
    this._role.set(null);
    this._token.set(null);
    this._username.set(null);
    try { localStorage.removeItem('inventra-token'); localStorage.removeItem('inventra-role'); localStorage.removeItem('inventra-username'); } catch {}
  }
  token(): string | null {
    if (this._token()) return this._token();
    try { const t = localStorage.getItem('inventra-token'); if (t) this._token.set(t); return t; } catch { return null; }
  }
  role(): Role | null {
    if (this._role()) return this._role();
    try {
      const raw = (localStorage.getItem('inventra-role') || '').toString();
      let role: Role | null = null;
      if (raw) {
        const upper = raw.toUpperCase();
        role = upper.includes('ADMIN') ? 'ADMIN' : upper.includes('SUPERVISOR') ? 'SUPERVISOR' : 'VENDEDOR';
        this._role.set(role);
      }
      return role;
    } catch {
      return null;
    }
  }
  username(): string | null {
    if (this._username()) return this._username();
    try { const u = localStorage.getItem('inventra-username'); if (u) this._username.set(u); return u; } catch { return null; }
  }
  isLogged(): boolean { return !!(this._token() || localStorage.getItem('inventra-token')); }
}
