import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, interval } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './config.service';

export interface OnlineUser {
  id: number;
  usuario: string;
  nombre?: string;
  apellido?: string;
  ts?: number; // epoch millis
}

export interface PresenceOnlineResponse {
  dataResponse?: { response?: 'SUCCESS'|'ERROR' };
  data?: Array<string | OnlineUser>;
  message?: string;
  error?: Array<{ msgError?: string; descError?: string }>;
}

@Injectable({ providedIn: 'root' })
export class PresenceService implements OnDestroy {
  private apiBase = '';
  private pingSub?: Subscription;

  private _online$ = new BehaviorSubject<OnlineUser[]>([]);
  online$ = this._online$.asObservable();

  constructor(private http: HttpClient, private cfg: ConfigService) {
    this.apiBase = this.cfg.get<string>('apiBaseUrl','');
  }

  /** Llamado desde Modules para empezar el auto-ping. */
  start(): void {
    this.stop();
    this.pingOnce();
    this.pingSub = interval(30_000).subscribe(() => this.pingOnce());
  }

  stop(): void {
    this.pingSub?.unsubscribe();
    this.pingSub = undefined;
  }

  ngOnDestroy(): void { this.stop(); }

  /** Ping inmediato (silencioso). */
  private pingOnce(): void {
    if (!this.apiBase) return;
    this.http.post(`${this.apiBase}/presence/ping`, {})
      .pipe(catchError(() => [] as any))
      .subscribe();
  }

  /** GET /presence/online */
  getOnline(): Observable<PresenceOnlineResponse> {
    return this.http.get<PresenceOnlineResponse>(`${this.apiBase}/presence/online`);
  }

  /** Parsea la respuesta (por si `data` trae strings JSON). */
  parseResponse(res: PresenceOnlineResponse): OnlineUser[] {
    const raw = res?.data ?? [];
    const list = raw.map(v => {
      if (typeof v === 'string') {
        try { return JSON.parse(v) as OnlineUser; } catch { return null; }
      }
      return v as OnlineUser;
    }).filter(Boolean) as OnlineUser[];
    // Más recientes primero
    list.sort((a,b) => (b.ts ?? 0) - (a.ts ?? 0));
    return list;
  }

  /** Útil si quieres poblar online$ desde fuera. */
  refreshOnlineList(): void {
    this.getOnline()
      .pipe(
        map(res => this.parseResponse(res)),
        catchError(() => [ [] as OnlineUser[] ])
      )
      .subscribe(list => this._online$.next(list));
  }
}
