import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryService, CategoryDTO } from '../core/category.service';

@Component({
  selector: 'app-categoria-edit-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="max-w-3xl mx-auto" *ngIf="loaded(); else loadingTpl">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Editar categoría</h2>
    </div>
    <div class="card">
      <div class="grid gap-4">
        <input class="input" placeholder="Nombre" [(ngModel)]="nombre">
        <input class="input" placeholder="Código" [(ngModel)]="codigo">
        <textarea class="input" rows="3" placeholder="Descripción" [(ngModel)]="descripcion"></textarea>
        <div>
          <label class="text-xs text-slate-600">Icono (Bootstrap Icons)</label>
          <div class="grid grid-cols-6 gap-2 mt-2">
            <button type="button" class="icon-cell" *ngFor="let bi of bootstrapIcons" [ngClass]="icon===bi ? 'ring-2 ring-blue-400' : ''" (click)="icon=bi">
              <i class="bi" [ngClass]="bi"></i>
            </button>
          </div>
          <input class="input mt-2" placeholder="Clase personalizada (ej: bi bi-tv)" [(ngModel)]="icon">
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <button class="btn btn-primary" (click)="save()" [disabled]="loading">Guardar</button>
        <button class="btn btn-outline" (click)="cancel()" [disabled]="loading">Cancelar</button>
        <button class="btn btn-outline" (click)="remove()" [disabled]="loading">Eliminar</button>
      </div>
      <div class="text-xs text-red-600 mt-2" *ngIf="error">{{ error }}</div>
    </div>
  </div>
  <ng-template #loadingTpl>
    <div class="text-center text-xs">Cargando...</div>
  </ng-template>
  `
})
export class CategoriaEditPage {
  id=0; nombre=''; codigo=''; descripcion=''; icon='';
  loaded = signal(false);
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
  constructor(private route: ActivatedRoute, private categoryService: CategoryService, private router: Router){ this.init(); }
  private async init(){
    this.id = Number(this.route.snapshot.paramMap.get('id')) || 0;
    if(!this.id){ this.router.navigateByUrl('/categorias'); return; }
    try {
      const dto = await this.categoryService.get(this.id);
      if(!dto){ this.router.navigateByUrl('/categorias'); return; }
      this.nombre = dto.name; this.codigo = dto.code; this.descripcion = dto.description || dto.desctiption || ''; this.icon = dto.icon || '';
      this.loaded.set(true);
    } catch { this.router.navigateByUrl('/categorias'); }
  }
  async save(){
    this.error='';
    if(!this.nombre.trim()){ this.error='Nombre requerido'; return; }
    this.loading=true;
    try {
      const dto: CategoryDTO = { id: this.id, name: this.nombre, code: this.codigo, description: this.descripcion, status: 'ACTIVE', icon: this.icon };
      await this.categoryService.update(dto);
      this.router.navigateByUrl('/categorias');
    } catch(e:any){ this.error = e?.message || 'Error guardando'; }
    this.loading=false;
  }
  async remove(){
    if(!confirm('¿Eliminar categoría?')) return;
    this.loading=true;
    const res = await this.categoryService.remove(this.id);
    this.loading=false;
    if(res.ok){ this.router.navigateByUrl('/categorias'); }
    else { this.error = res.message || 'Error eliminando'; }
  }
  cancel(){ this.router.navigateByUrl('/categorias'); }
}
