// src/app/shared/presence-badge.component.ts
import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresenceService } from '../core/presence.service';

@Component({
  selector: 'app-presence-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge rounded-pill"
          [class.bg-success-subtle]="count()>0"
          [class.bg-secondary-subtle]="count()===0"
          title="Usuarios conectados en los últimos minutos">
      <span class="status-dot me-1" [class.on]="count()>0"></span>
      {{ count() }} online
    </span>
  `,
  styles: [`
    .status-dot {
      display:inline-block; width:8px; height:8px; border-radius:50%;
      background:#adb5bd; vertical-align:middle;
    }
    .status-dot.on { background:#2ecc71; }
  `]
})
export class PresenceBadgeComponent implements OnInit, OnDestroy {
  private destroy = false;
  count = signal(0);

  constructor(private presence: PresenceService) {}

  ngOnInit(): void {
    // escucha el stream y actualiza
    this.presence.online$.subscribe(list => {
      if (!this.destroy) this.count.set(list.length);
    });
  }

  ngOnDestroy(): void { this.destroy = true; }
}
