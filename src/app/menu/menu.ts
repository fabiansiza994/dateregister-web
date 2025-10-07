import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PresenceBadgeComponent } from "../shared/presence-badge.component";

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, PresenceBadgeComponent],
  templateUrl: './menu.html',
  styleUrls: ['./menu.css']
})
export class Menu {
  private readonly _claims = signal<any | null>(null);

  empresa = computed(() => this._claims()?.empresa ?? 'DataRegister');
  sector  = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  role    = computed(() => (this._claims()?.role ?? '').toUpperCase());
  user    = computed(() => this._claims()?.sub ?? this._claims()?.usuario ?? 'Usuario');

  // nombre amigable para avatar / dropdown
  userName = computed(() => {
    const n = this._claims()?.nombre;
    const a = this._claims()?.apellido;
    if (n || a) return [n, a].filter(Boolean).join(' ');
    return String(this.user());
  });

  isOpen = signal(false);
  toggle() { this.isOpen.update(v => !v); }
  close() { this.isOpen.set(false); }

  constructor(private router: Router, private auth: AuthService) {
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  initials(text?: string): string {
    const t = (text || '').trim();
    if (!t) return 'DR';
    const parts = t.split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || 'DR';
  }
}
