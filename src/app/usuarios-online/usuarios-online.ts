import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresenceService, PresenceOnlineResponse, OnlineUser } from '../core/presence.service';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-usuarios-online',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.9rem;
      background: #e9f2ff; color: #2a62d1;
    }
    .dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #22c55e; /* verde */
      box-shadow: 0 0 0 2px #fff;
    }
    .chip {
      font-size: .75rem;
      padding: .15rem .5rem;
      border-radius: 999px;
      background: rgba(34,197,94,.12);
      color: #166534;
    }
    .card-hover {
      transition: transform .12s ease, box-shadow .12s ease;
    }
    .card-hover:hover {
      transform: translateY(-2px);
      box-shadow: 0 .5rem 1rem rgba(0,0,0,.08)!important;
    }
    .empty {
      border: 2px dashed #e9ecef;
      border-radius: 1rem;
      padding: 2rem;
      text-align: center;
      color: #6c757d;
    }
  `],
  template: `
  <div class="card border-0 shadow-sm rounded-4">
    <div class="card-body">

      <!-- Header -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div class="d-flex align-items-center gap-2">
          <h5 class="mb-0 fw-semibold">Usuarios online</h5>
          <span class="badge bg-success-subtle text-dark">{{ online().length }}</span>
        </div>

        <div class="d-flex align-items-center gap-2">
          <span class="text-secondary small d-none d-sm-inline">Se actualiza cada 10s</span>
          <button class="btn btn-sm btn-outline-primary" (click)="manualRefresh()" title="Actualizar ahora">
            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
          </button>
        </div>
      </div>

      <!-- Error -->
      <div *ngIf="error()" class="alert alert-warning py-2 small mb-0">
        {{ error() }}
      </div>

      <!-- Empty -->
      <div *ngIf="!error() && online().length===0" class="empty">
        <div class="mb-1">Nadie online por ahora</div>
        <div class="small">Apenas un usuario navegue por el sistema, lo verás aquí.</div>
      </div>

      <!-- Grid -->
      <div *ngIf="!error() && online().length>0" class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
        <div class="col" *ngFor="let u of online()">
          <div class="card border-0 shadow-sm rounded-4 card-hover h-100">
            <div class="card-body d-flex align-items-start gap-3">
              <div class="avatar text-uppercase">{{ initials(u) }}</div>
              <div class="flex-grow-1">
                <div class="d-flex align-items-center gap-2">
                  <span class="fw-semibold">{{ u.usuario }}</span>
                  <span class="dot"></span>
                </div>
                <div class="text-secondary small">
                  {{ u.nombre }} {{ u.apellido || '' }}
                </div>
                <div class="d-flex align-items-center gap-2 mt-1">
                  <span class="chip">Activo</span>
                  <span class="text-secondary small">· {{ timeAgo(u.ts ?? 0) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div> <!-- col -->
      </div>

    </div>
  </div>
  `
})
export class UsuariosOnlineComponent implements OnInit, OnDestroy {
  online = signal<OnlineUser[]>([]);
  error  = signal<string|null>(null);
  private sub?: Subscription;

  constructor(private presence: PresenceService) {}

  ngOnInit(): void {
    // refresco periódico
    this.sub = interval(10_000)
      .pipe(switchMap(() => this.presence.getOnline()))
      .subscribe({
        next: (res: PresenceOnlineResponse) => {
          const data = this.presence.parseResponse(res);
          this.online.set(data);
          this.error.set(null);
        },
        error: (err: any) => {
          this.error.set(err?.error?.message || err?.message || 'No se pudo cargar la presencia.');
        }
      });

    // primer tiro inmediato
    this.manualRefresh();
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  manualRefresh(): void {
    this.presence.getOnline().subscribe({
      next: (res: PresenceOnlineResponse) => {
        const data = this.presence.parseResponse(res);
        this.online.set(data);
      },
      error: (err: any) => {
        this.error.set(err?.error?.message || err?.message || 'No se pudo cargar la presencia.');
      }
    });
  }

  initials(u: OnlineUser): string {
    const name = `${u.nombre || ''} ${u.apellido || ''}`.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] ?? '';
      const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
      return (first + last).slice(0,2);
    }
    // fallback al usuario
    return (u.usuario || '?').slice(0,2);
  }

  timeAgo(ts: number): string {
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.round(diff / 1000);
    if (s < 60) return `hace ${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `hace ${m}m`;
    const h = Math.round(m / 60);
    return `hace ${h}h`;
  }
}
