import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface LoginResponse {
  dataResponse?: { idTx?: string; response?: string };
  data: { token: string; username: string; role: string };
  message?: string;
}

const API_URL = 'http://localhost:8081';

export type Role = 'ADMIN' | 'VENDEDOR' | 'SUPERVISOR';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _role = signal<Role | null>(null);
  private _token = signal<string | null>(null);
  private _username = signal<string | null>(null);
  constructor(private http: HttpClient) {}

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
    try { const r = (localStorage.getItem('inventra-role') || '') as Role; if (r) this._role.set(r); return r || null; } catch { return null; }
  }
  username(): string | null {
    if (this._username()) return this._username();
    try { const u = localStorage.getItem('inventra-username'); if (u) this._username.set(u); return u; } catch { return null; }
  }
  isLogged(): boolean { return !!(this._token() || localStorage.getItem('inventra-token')); }
}
