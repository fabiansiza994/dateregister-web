import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-modules',
  imports: [CommonModule, RouterLink],
  templateUrl: './modules.html',
  styleUrl: './modules.css'
})
export class Modules {

  private readonly _claims = signal<any | null>(null);

  sector = computed(() => (this._claims()?.sector ?? '').toUpperCase());
  role = computed(() => (this._claims()?.role ?? '').toUpperCase());
  empresa = computed(() => this._claims()?.empresa ?? '');
  user = computed(() => this._claims()?.sub ?? '');

  constructor(private auth: AuthService) {
    this.auth.refreshFromStorage();
    this._claims.set(this.auth.claims());
  }
}
