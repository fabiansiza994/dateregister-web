import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from './config.service';

export interface JwtClaims {
  role: string;
  empresaId: number;
  grupoId: number;
  empresa: string;
  userId: number;
  sector: string;
  pais: string;
  sub: string; // username
  iat: number; // issued-at (epoch seconds)
  exp: number; // expires (epoch seconds)
  [k: string]: any;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _claims = signal<JwtClaims | null>(null);

  constructor(private http: HttpClient, private cfg: ConfigService) {
    this.refreshFromStorage();
  }

  /** Lee el token de localStorage, decodifica y actualiza los claims */
  refreshFromStorage() {
    const raw = localStorage.getItem('token');
    if (!raw) { this._claims.set(null); return; }
    try {
      const payload = this.decodeJwt(raw);
      this._claims.set(payload as JwtClaims);
    } catch {
      this._claims.set(null);
    }
  }

  claims() {
    return this._claims();
  }

  sector(): string | null {
    return this._claims()?.sector ?? null;
  }

  role(): string | null {
    return this._claims()?.role ?? null;
  }

  isExpired(): boolean {
    const exp = this._claims()?.exp;
    if (!exp) return true;
    return Date.now() >= exp * 1000;
  }

  isLoggedIn(): boolean {
    return !!this._claims() && !this.isExpired();
  }

  logout() {
    localStorage.removeItem('token');
    this._claims.set(null);
  }

  private decodeJwt(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Token inválido');
    // base64url → base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // padding
    const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
    const json = atob(b64 + pad);
    return JSON.parse(json);
  }

  // ===== Recuperación de cuenta =====
  sendRecoveryEmail(email: string) {
    const apiBase = this.cfg.get<string>('apiBaseUrl', '');
    // encodeURI para mantener '@' en el path (evita %40)
    return this.http.get(`${apiBase}/code/recoverAccount/${encodeURI(email)}`);
  }

  recoverAccount(userId: number, password: string) {
    const apiBase = this.cfg.get<string>('apiBaseUrl', '');
    return this.http.post(`${apiBase}/user/recoverAccount`, { userId, password });
  }
}