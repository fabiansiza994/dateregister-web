import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesService } from '../core/sales.service';
import { Router } from '@angular/router';

interface VentaHistorial { id:number; cliente:string; cantidad:number; total:number; fecha:string; status?: string; }

@Component({
  selector: 'app-historial-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="flex items-center justify-between">
    <h2 style="margin:0" class="text-xl font-semibold">Historial de ventas</h2>
  </div>
  <div class="mt-4 card">
    <div class="flex flex-wrap gap-2 items-end">
      <input class="input" placeholder="Buscar por cliente" [(ngModel)]="q" (keyup.enter)="applyFilters()">
      <input class="input" type="date" style="width:170px" [(ngModel)]="date" (change)="applyFilters()">
      <button class="btn btn-outline" (click)="applyFilters()">Filtrar</button>
      <button class="btn btn-outline" (click)="clearFilters()" [disabled]="!hasFilters()">Limpiar</button>
    </div>
    <div class="mt-4 inv-list">
      <div class="inv-item cursor-pointer" *ngFor="let v of filtered()" (click)="goToDetail(v.id)">
        <div class="flex items-start justify-between w-full gap-3">
          <div>
            <div class="inv-item-title">#{{v.id}} • {{v.cliente}} ({{v.cantidad}} ítems)</div>
            <div class="inv-item-sub">{{v.fecha}} • $ {{v.total | number:'1.0-0'}}</div>
          </div>
          <span class="badge h-fit" [ngClass]="statusBadgeClass(v.status)">{{ (v.status || '—') }}</span>
        </div>
      </div>
      <div class="text-center text-xs" *ngIf="filtered().length===0">Sin resultados</div>
    </div>
    <div class="mt-3 flex items-center gap-2 justify-end text-xs">
      <button class="btn btn-outline" (click)="prev()" [disabled]="!canPrev()">Anterior</button>
      <div>Página {{page+1}}</div>
      <button class="btn btn-outline" (click)="next()" [disabled]="!hasNext()">Siguiente</button>
    </div>
  </div>
  `
})
export class HistorialVentasComponent {
  items = signal<VentaHistorial[]>([]);
  q='';
  date='';
  // sin filtro de estado
  page=0;
  size=10;
  lastCount=0;

  filtered = computed(()=> {
    const q = this.q.trim().toLowerCase();
    return this.items().filter(v=> !q || v.cliente.toLowerCase().includes(q));
  });

  constructor(private sales: SalesService, private router: Router){
    this.reload();
  }

  async reload(){
    const list = await this.sales.list(this.date || undefined, this.page, this.size, undefined, this.q || undefined);
    const mapped: VentaHistorial[] = (list||[]).map((s:any)=> ({
      id: s.id || 0,
      cliente: (s.client && (s.client.name || s.client.fullName || (s.client.firstName+' '+(s.client.lastName||''))))?.trim() || 'Cliente desconocido',
      cantidad: s.productList ? s.productList.reduce((a:number,p:any)=> a + (p.quantity||0), 0) : 0,
      total: s.total || 0,
      fecha: (s.date || s.createdAt || '').slice(0,10),
      status: s.status || s.state || s.responseStatus || 'PENDANT'
    }));
    this.items.set(mapped);
    this.lastCount = mapped.length;
  }
  hasFilters(){ return !!(this.q||this.date); }
  applyFilters(){ this.page=0; this.reload(); }
  clearFilters(){ this.q=''; this.date=''; this.page=0; this.reload(); }
  canPrev(){ return this.page>0; }
  hasNext(){ return this.lastCount === this.size; }
  async next(){ if(!this.hasNext()) return; this.page++; await this.reload(); }
  async prev(){ if(!this.canPrev()) return; this.page--; await this.reload(); }
  goToDetail(id:number){ this.router.navigate(['/ventas', id]); }
  statusBadgeClass(status:any){
    const v = String(status||'').toUpperCase();
    if(v==='SUCCESS' || v==='COMPLETED' || v==='COMPLETE' || v==='PAID') return 'badge-success';
    if(v==='PENDANT' || v==='PENDING' || v==='IN_PROGRESS') return 'badge-warning';
    if(v==='CANCELLED' || v==='FAILED' || v==='REJECTED') return 'badge-danger';
    return '';
  }
}
