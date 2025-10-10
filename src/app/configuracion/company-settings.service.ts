// src/app/configuracion/company-settings.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ConfigService } from '../core/config.service';

export interface CompanySettingsDTO {
  id: number;
  nombre: string;
  allowView: boolean;
  allowEdit: boolean;
}
export interface ApiResponse<T> {
  dataResponse: { idTx?: string|null; response: 'SUCCESS'|'ERROR' };
  data?: T;
  message?: string;
  error?: Array<{ codError?: string; descError?: string; msgError?: string }>;
}

@Injectable({ providedIn: 'root' })
export class CompanySettingsService {
  private http = inject(HttpClient);
  private cfg  = inject(ConfigService);
  private base = this.cfg.get<string>('apiBaseUrl', '');

  getSettings(empresaId: number) {
    return this.http.get<ApiResponse<CompanySettingsDTO>>(`${this.base}/company/${empresaId}/settings`);
  }
  setAllowView(empresaId: number, enabled: boolean) {
    const params = new HttpParams().set('enabled', enabled);
    return this.http.put<ApiResponse<CompanySettingsDTO>>(`${this.base}/company/allowView/${empresaId}`, null, { params });
  }
  setAllowEdit(empresaId: number, enabled: boolean) {
    const params = new HttpParams().set('enabled', enabled);
    return this.http.put<ApiResponse<CompanySettingsDTO>>(`${this.base}/company/allowEdit/${empresaId}`, null, { params });
  }
  updateBoth(empresaId: number, allowView: boolean, allowEdit: boolean) {
    return this.http.put<ApiResponse<CompanySettingsDTO>>(`${this.base}/company/${empresaId}/settings`, { allowView, allowEdit });
  }
}
