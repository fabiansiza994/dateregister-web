import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: any = {};

  setConfig(cfg: any) { this.config = cfg || {}; }
  get<T = any>(key: string, fallback?: T): T {
    return (this.config?.[key] as T) ?? (fallback as T);
  }
}