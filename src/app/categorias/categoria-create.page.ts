import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoryService } from '../core/category.service';

@Component({
  selector: 'app-categoria-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Nueva categoría</h2>
      <a routerLink="/categorias" class="btn btn-outline">Volver</a>
    </div>
    <div class="card">
      <div class="grid gap-4">
        <input class="input" placeholder="Nombre" [(ngModel)]="nombre">
        <input class="input" placeholder="Código (opcional)" [(ngModel)]="codigo">
        <textarea class="input" rows="3" placeholder="Descripción" [(ngModel)]="descripcion"></textarea>
        <div>
          <label class="text-xs text-slate-600">Icono (Bootstrap Icons)</label>
          <div class="grid grid-cols-6 gap-2 mt-2">
            <button type="button" class="icon-cell" *ngFor="let bi of bootstrapIcons" [ngClass]="icon===bi ? 'ring-2 ring-blue-400' : ''" (click)="icon=bi">
              <i class="bi" [ngClass]="bi"></i>
            </button>
          </div>
          <input class="input mt-2" placeholder="O escribe clase bi personalizada (ej: bi bi-tv)" [(ngModel)]="icon">
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <button class="btn btn-primary" (click)="save()" [disabled]="loading">Guardar</button>
        <button class="btn btn-outline" (click)="router.navigateByUrl('/categorias')">Cancelar</button>
      </div>
      <div class="text-xs text-red-600 mt-2" *ngIf="error">{{ error }}</div>
    </div>
  </div>
  `
})
export class CategoriaCreatePage {
  nombre=''; codigo=''; descripcion=''; icon='';
  loading=false; error='';
  bootstrapIcons = [
    'bi-tv','bi-box','bi-basket','bi-bag','bi-bag-check','bi-battery-full','bi-bezier','bi-bicycle',
    'bi-binoculars','bi-bricks','bi-brightness-high','bi-bucket','bi-cake','bi-capsule','bi-cart','bi-cart-plus',
    'bi-cash-stack','bi-chat','bi-check-circle','bi-cloud','bi-cpu','bi-credit-card','bi-cup-hot','bi-droplet',
    'bi-emoji-smile','bi-gear','bi-gem','bi-gift','bi-globe','bi-hammer','bi-headset','bi-heart',
    'bi-house','bi-incognito','bi-joystick','bi-kanban','bi-key','bi-lamp','bi-lightning','bi-lightbulb',
    'bi-magic','bi-minecart','bi-palette','bi-patch-check','bi-pen','bi-phone','bi-printer','bi-recycle',
    'bi-router','bi-safe','bi-scooter','bi-shop','bi-sliders','bi-snow','bi-speedometer','bi-star',
    'bi-tablet','bi-tag','bi-tools','bi-trophy','bi-truck','bi-tv-fill','bi-umbrella','bi-wallet'
  ];
  constructor(private categoryService: CategoryService, public router: Router){}
  async save(){
    this.error='';
    if(!this.nombre.trim()) { this.error='Nombre requerido'; return; }
    this.loading=true;
    try {
      await this.categoryService.create({ name: this.nombre, code: this.codigo || undefined, description: this.descripcion, icon: this.icon || undefined });
      this.router.navigateByUrl('/categorias');
    } catch(e:any){ this.error = e?.message || 'Error creando categoría'; }
    this.loading=false;
  }
}
