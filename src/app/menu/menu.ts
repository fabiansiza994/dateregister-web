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

  // Divide el nombre de empresa en dos líneas para móvil
  private splitCompanyName(name: string): { l1: string; l2: string } {
    const trimmed = (name || '').trim();
    if (!trimmed) return { l1: 'DataRegister', l2: '' };
    // Si es corto, todo en la primera línea
    if (trimmed.length <= 18) return { l1: trimmed, l2: '' };

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      // sin espacios: corta por caracteres
      const cut = Math.min(16, Math.max(10, Math.floor(trimmed.length / 2)));
      return { l1: trimmed.slice(0, cut), l2: trimmed.slice(cut) };
    }

    // Greedy: llena l1 hasta ~18–22 chars sin cortar palabras
    const targetMin = 18, targetMax = 22;
    let l1 = '';
    let i = 0;
    while (i < words.length) {
      const candidate = (l1 ? l1 + ' ' : '') + words[i];
      if (candidate.length > targetMax && l1.length >= targetMin) break;
      l1 = candidate;
      i++;
    }
    const l2 = words.slice(i).join(' ');
    return { l1: l1.trim(), l2: l2.trim() };
  }

  brandLines = computed(() => this.splitCompanyName(this.empresa() ?? ''));
}
