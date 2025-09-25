import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './menu.html',
  styleUrls: ['./menu.css']
})
export class Menu {
  private readonly _claims = signal<any | null>(null);

  empresa = computed(() => this._claims()?.empresa ?? 'DataRegister');
  sector = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  role = computed(() => (this._claims()?.role ?? '').toUpperCase());
  
  isOpen = signal(false);
  toggle() { this.isOpen.update(v => !v); }
  close() { this.isOpen.set(false); }

  constructor(private router: Router, private auth: AuthService) {
    // refresca claims al cargar
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}