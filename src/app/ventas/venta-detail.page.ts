import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SalesService } from '../core/sales.service';

@Component({
  selector: 'app-venta-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="card" *ngIf="loaded(); else loadingTpl">
    <div class="flex items-center justify-between">
      <h2 style="margin:0">Venta #{{ sale()?.id }}</h2>
      <button class="btn btn-outline" (click)="back()">Volver</button>
    </div>
    <div class="mt-2 grid md:grid-cols-2 gap-2 text-sm text-slate-700">
      <div><span class="font-medium">Cliente:</span> {{ clienteNombre() }}</div>
      <div><span class="font-medium">Fecha:</span> {{ fecha() }}</div>
      <div><span class="font-medium">Estado:</span> {{ sale()?.status }}</div>
      <div><span class="font-medium">Total:</span> $ {{ sale()?.total | number:'1.0-0' }}</div>
    </div>
    <h3 class="mt-4 mb-2" style="margin:0">Productos</h3>
    <div class="inv-list">
      <div class="inv-item justify-between" *ngFor="let p of (sale()?.productList || [])">
        <div>
          <div class="inv-item-title">{{ p.name }}</div>
          <div class="inv-item-sub">$ {{ p.price | number:'1.0-0' }}</div>
        </div>
        <div class="text-sm">x{{ p.quantity }}</div>
      </div>
      <div class="text-center text-xs" *ngIf="!(sale()?.productList?.length)">Sin productos</div>
    </div>
    <div *ngIf="errorMsg()" class="mt-4 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{{ errorMsg() }}</div>
  </div>
  <ng-template #loadingTpl>
    <div class="card">Cargando venta...</div>
  </ng-template>
  `
})
export class VentaDetailPage implements OnInit {
  sale = signal<any | null>(null);
  loaded = signal(false);
  errorMsg = signal('');
  constructor(private route: ActivatedRoute, private salesService: SalesService, private router: Router) {}

  async ngOnInit(){
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if(!id){ this.errorMsg.set('ID inválido'); this.loaded.set(true); return; }
    const data = await this.salesService.detail(id);
    if(!data){ this.errorMsg.set('No se pudo obtener el detalle de la venta'); }
    this.sale.set(data);
    this.loaded.set(true);
  }
  back(){ this.router.navigate(['/ventas']); }
  clienteNombre(){
    const c = this.sale()?.client;
    if(!c) return 'Cliente desconocido';
    return (c.name || c.fullName || `${c.firstName||''} ${c.lastName||''}`).trim();
  }
  fecha(){ const d = this.sale()?.date || this.sale()?.createdAt; return d ? String(d).slice(0,10) : '—'; }
}
