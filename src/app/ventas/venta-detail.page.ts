import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SalesService } from '../core/sales.service';

@Component({
  selector: 'app-venta-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="card" *ngIf="loaded(); else loadingTpl">
    <!-- Encabezado -->
    <div class="flex items-center gap-3 mb-3">
      <h2 style="margin:0">Venta #{{ sale()?.id }}</h2>
      <span class="badge" [ngClass]="statusBadgeClass(sale()?.status)">{{ (sale()?.status || '—') }}</span>
    </div>

    <!-- Meta / Cliente -->
    <div class="grid gap-3 md:grid-cols-2">
      <!-- Cliente -->
      <div class="rounded-xl border border-slate-200 bg-white p-3">
        <div class="text-xs text-slate-600 mb-1">Cliente</div>
        <div class="font-medium">{{ clienteNombre() }}</div>
        <div class="text-xs text-slate-600 mt-1" *ngIf="clienteDocumento()">Documento: {{ clienteDocumento() }}</div>
        <div class="text-xs text-slate-600" *ngIf="clienteEmail()">Correo: {{ clienteEmail() }}</div>
        <div class="text-xs text-slate-600" *ngIf="clienteTelefono()">Teléfono: {{ clienteTelefono() }}</div>
        <div class="text-xs text-slate-600" *ngIf="clienteDireccion()">Dirección: {{ clienteDireccion() }}</div>
      </div>
      <!-- Resumen -->
      <div class="rounded-xl border border-slate-200 bg-white p-3">
        <div class="grid grid-cols-2 gap-y-2 text-sm text-slate-800">
          <div class="text-slate-600">Fecha</div>
          <div class="text-right">{{ fecha() }}</div>

          <!-- Ítems con borde punteado -->
          <div class="col-span-2 border border-dotted border-slate-300 rounded-lg px-3 py-1 flex items-center justify-between">
            <div class="text-slate-600">Ítems</div>
            <div class="text-right">{{ itemsCount() }}</div>
          </div>

          <!-- Subtotal con borde punteado -->
          <div class="col-span-2 border border-dotted border-slate-300 rounded-lg px-3 py-1 flex items-center justify-between">
            <div class="text-slate-600">Subtotal</div>
            <div class="text-right">$ {{ subtotal() | number:'1.0-0' }}</div>
          </div>

          <!-- Impuesto / Descuento / Método (normales) -->
          <ng-container *ngIf="impuesto() > 0">
            <div class="text-slate-600">Impuesto</div>
            <div class="text-right">$ {{ impuesto() | number:'1.0-0' }}</div>
          </ng-container>
          <ng-container *ngIf="descuento() > 0">
            <div class="text-slate-600">Descuento</div>
            <div class="text-right">- $ {{ descuento() | number:'1.0-0' }}</div>
          </ng-container>
          <ng-container *ngIf="metodoPago()">
            <div class="text-slate-600">Método</div>
            <div class="text-right">{{ metodoPago() }}</div>
          </ng-container>

          <!-- Total con borde punteado -->
          <div class="col-span-2 border border-dotted border-slate-400 rounded-lg px-3 py-1 flex items-center justify-between mt-1">
            <div class="text-slate-700 font-semibold">Total</div>
            <div class="text-right font-semibold">$ {{ total() | number:'1.0-0' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Productos -->
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

    <!-- Acciones -->
    <div class="mt-4 flex justify-end gap-2">
      <button *ngIf="isAdmin() && !isRejected()" class="btn btn-outline text-red-700 border-red-300 bg-red-50 hover:bg-red-100" (click)="openReverse()">Reversar</button>
      <button class="btn btn-outline" (click)="back()">Volver</button>
    </div>

    <!-- Modal Confirmación Reversar -->
    <div *ngIf="showReverse()" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="card" style="max-width:480px; width:92%">
        <h3 style="margin:0">Confirmar reverso</h3>
        <p class="mt-2 text-sm text-slate-700">Esta acción marcará la venta como <span class="font-semibold">REJECTED</span>. ¿Deseas continuar?</p>
        <div class="mt-4 flex justify-end gap-2">
          <button class="btn btn-outline" (click)="closeReverse()">Cancelar</button>
          <button class="btn btn-primary bg-red-600" (click)="confirmReverse()" [disabled]="confirmingReverse">Reversar</button>
        </div>
        <div class="text-xs text-red-600 mt-2" *ngIf="reverseError()">{{ reverseError() }}</div>
      </div>
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
  showReverse = signal(false);
  confirmingReverse = false;
  reverseError = signal('');
  constructor(private route: ActivatedRoute, private salesService: SalesService, private router: Router, private auth: AuthService) {}

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
  isRejected(){ const v=String(this.sale()?.status||'').toUpperCase(); return v==='REJECTED'; }
  isAdmin(){ return this.auth.role() === 'ADMIN'; }
  openReverse(){ this.reverseError.set(''); this.showReverse.set(true); }
  closeReverse(){ if(this.confirmingReverse) return; this.showReverse.set(false); }
  async confirmReverse(){
  if(this.confirmingReverse) return;
  if(!this.isAdmin()){ this.reverseError.set('No autorizado'); return; }
    this.reverseError.set('');
    const id = this.sale()?.id;
    if(!id){ this.reverseError.set('ID inválido'); return; }
    this.confirmingReverse = true;
    const res = await this.salesService.reverse(Number(id));
    this.confirmingReverse = false;
    if(res.ok){
      // Actualizar estado en la vista
      const current = this.sale();
      this.sale.set({ ...(current||{}), status: 'REJECTED' });
      this.showReverse.set(false);
    } else {
      this.reverseError.set(res.message || 'No se pudo reversar la venta');
    }
  }
  clienteEmail(){ const c=this.sale()?.client; return c?.email || c?.mail || ''; }
  clienteTelefono(){ const c=this.sale()?.client; return c?.phone || c?.telefono || c?.mobile || ''; }
  clienteDocumento(){ const c=this.sale()?.client; return c?.document || c?.documentId || c?.dni || c?.idNumber || ''; }
  clienteDireccion(){ const c=this.sale()?.client; return c?.address || c?.direccion || ''; }
  itemsCount(){ const list=this.sale()?.productList||[]; return list.reduce((a:any,p:any)=> a + (Number(p.quantity)||0), 0); }
  subtotal(){
    const s=this.sale(); if(!s) return 0;
    if(typeof s.subtotal === 'number') return s.subtotal;
    const list=s.productList||[]; return list.reduce((a:number,p:any)=> a + (Number(p.price)||0)*(Number(p.quantity)||0), 0);
  }
  impuesto(){ const s=this.sale(); const t = s?.tax ?? s?.iva ?? 0; return Number(t)||0; }
  descuento(){ const s=this.sale(); const d = s?.discount ?? s?.descuento ?? 0; return Number(d)||0; }
  total(){ const s=this.sale(); return Number(s?.total)|| (this.subtotal()+this.impuesto()-this.descuento()); }
  metodoPago(){ const s=this.sale(); return s?.paymentMethod || s?.method || s?.payment?.method || ''; }
  statusBadgeClass(status:any){
    const v = String(status||'').toUpperCase();
    if(v==='SUCCESS' || v==='COMPLETED' || v==='COMPLETE' || v==='PAID') return 'badge-success';
    if(v==='PENDANT' || v==='PENDING' || v==='IN_PROGRESS') return 'badge-warning';
    if(v==='CANCELLED' || v==='FAILED' || v==='REJECTED') return 'badge-danger';
    return '';
  }
}
