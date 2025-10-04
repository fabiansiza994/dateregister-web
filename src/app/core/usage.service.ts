import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface UsagePingRequest {
  lat?: number | null;
  lng?: number | null;
  userId?: number | null;
  appVersion?: string | null;
  tz?: string | null;
  platform?: string | null;
}

export interface UsagePoint {
  lat: number;
  lng: number;
  city?: string | null;
  country?: string | null;
  ts?: string; // ISO
}

@Injectable({ providedIn: 'root' })
export class UsageService {
  private apiBase = ''; // setéalo (o inyéctalo desde ConfigService)

  constructor(private http: HttpClient) {}

  setApiBase(url: string) { this.apiBase = url; }

  ping(
    body: {
    lat: number | null;
    lng: number | null;
    appVersion?: string;
    tz?: string;
    platform?: string;
    empresaId?: number | null;
    usuario?: string | null;
    sector?: string | null;
    rol?: string | null;
  }
  ) {
    return this.http.post(`${this.apiBase}/usage/ping`, body);
  }

  list() {
    return this.http.get<{ data: UsagePoint[] }>(`${this.apiBase}/usage/list`);
  }
}