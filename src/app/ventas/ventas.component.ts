import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductDTO } from '../core/product.service';
import { SalesService } from '../core/sales.service';
import { ClientService, ClientDTO } from '../core/client.service';
import { Router } from '@angular/router';

// Venta listing UI interface removed; ventas ahora sólo registra nuevas ventas.
interface SaleLine { id:number; name:string; price:number; quantity:number; stock:number; }
interface Venta { id:number; cliente:string; cantidad:number; total:number; fecha:string; status?: string; }

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="flex items-center justify-between">
    <h2 style="margin:0" class="text-xl font-semibold">Ventas</h2>
  </div>
  <div class="mt-4 grid gap-4">
    <div class="card">
      <h3 style="margin:0">Registrar venta</h3>
      <div class="mt-2 grid" style="gap:.6rem">
        <div class="grid md:grid-cols-3 gap-2">
          <div>
            <input class="input" placeholder="Buscar cliente..." [(ngModel)]="clientQuery" (ngModelChange)="onClientQueryChange($event)">
            <div class="mt-2 card" *ngIf="clientSuggestions().length">
              <div class="inv-item" *ngFor="let c of clientSuggestions()" (click)="selectClient(c)">
                <div class="inv-item-title">{{ c.name }}</div>
                <div class="inv-item-sub">ID: {{ c.id }}</div>
              </div>
            </div>
            <div class="mt-2 flex items-center gap-2" *ngIf="selectedClient">
              <span class="chip">{{ selectedClient?.name }} (ID {{ selectedClient?.id }})</span>
              <button type="button" class="btn btn-outline" (click)="clearClient()">Quitar</button>
            </div>
          </div>
          <!-- Estado oculto: siempre PENDANT -->
          <input type="hidden" [(ngModel)]="status">
          <input class="input" [value]="total() | number:'1.0-0'" readonly placeholder="Total" />
        </div>
        <div>
          <div class="relative">
            <input class="input with-icon" placeholder="Buscar productos..." [(ngModel)]="productQuery" (ngModelChange)="onProductQueryChange($event)">
          </div>
          <div class="mt-2 card" *ngIf="productSuggestions().length">
            <div class="inv-item" *ngFor="let p of productSuggestions()" (click)="addProduct(p)">
              <div class="inv-item-title">{{ p.name }}</div>
              <div class="inv-item-sub">$ {{ p.price | number:'1.0-0' }}</div>
            </div>
          </div>
        </div>
        <div class="inv-list" *ngIf="lines().length">
          <div class="inv-item justify-between" *ngFor="let l of lines(); let i = index">
            <div>
              <div class="inv-item-title">{{ l.name }}</div>
              <div class="inv-item-sub">$ {{ l.price | number:'1.0-0' }} • Stock: {{ l.stock }}</div>
            </div>
            <div class="flex items-center gap-2">
              <input class="input" style="width:90px" type="number" min="1" [max]="l.stock" [(ngModel)]="l.quantity" (ngModelChange)="onQtyChange(l)">
              <button class="btn btn-outline" (click)="removeLine(i)">Quitar</button>
            </div>
          </div>
        </div>
      </div>
      <div *ngIf="errorMsg" class="mt-2 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{{ errorMsg }}</div>
      <div *ngIf="successMsg" class="mt-2 rounded border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-sm">{{ successMsg }}</div>
      <div class="mt-4 flex items-center gap-2">
        <button class="btn btn-primary" (click)="submitSale()" [disabled]="!canSubmit()">Crear venta</button>
        <button class="btn btn-outline" (click)="resetForm()">Limpiar</button>
      </div>
    </div>
    
    <!-- Listado sencillo -->
    <div class="card">
      <div class="flex items-center gap-2">
        <input class="input" placeholder="Buscar por cliente" [(ngModel)]="q">
      </div>
      <div class="mt-4 inv-list">
            <div class="inv-item cursor-pointer" *ngFor="let v of filtered()" (click)="goToDetail(v.id)">
              <div class="flex items-start justify-between w-full gap-3">
                <div>
                  <div class="inv-item-title">{{v.cliente}} ({{v.cantidad}} ítems)</div>
                  <div class="inv-item-sub">{{v.fecha}} • $ {{v.total | number:'1.0-0'}}</div>
                </div>
                <span class="badge h-fit" [ngClass]="statusBadgeClass(v.status)">{{ (v.status || '—') }}</span>
              </div>
            </div>
        <div class="text-center text-xs" *ngIf="filtered().length===0">Sin resultados</div>
      </div>
      <div class="mt-3 flex items-center gap-2 justify-end text-xs">
        <button class="btn btn-outline" (click)="prevSales()" [disabled]="!canPrevSales()">Anterior</button>
        <div>Página {{salesPage+1}}</div>
        <button class="btn btn-outline" (click)="nextSales()" [disabled]="!hasNextSales()">Siguiente</button>
      </div>
    </div>
  </div>
  `
})
export class VentasComponent {
  // Listado sencillo
  q='';
  items = signal<Venta[]>([]);
  filtered = computed(()=> {
    const s = this.q.trim().toLowerCase();
    return this.items().filter(x=> !s || x.cliente.toLowerCase().includes(s));
  });
  // Sales form state
  // Cliente seleccionado
  clientQuery = '';
  private clientTimer: any = null;
  clientSuggestions = signal<ClientDTO[]>([]);
  selectedClient: ClientDTO | null = null;
  // Estado siempre PENDANT (no editable)
  status: string = 'PENDANT';
  productQuery = '';
  private searchTimer: any = null;
  productSuggestions = signal<ProductDTO[]>([]);
  lines = signal<SaleLine[]>([]);
  total = signal<number>(0);
  errorMsg = '';
  successMsg = '';
  // Paginación simple para el listado
  salesPage = 0;
  salesPageSize = 10;
  lastSalesCount = 0;
  constructor(private productService: ProductService, private salesService: SalesService, private clientService: ClientService, private router: Router) {
    this.loadSales();
  }

  recalc(){
    const sum = this.lines().reduce((acc, l)=> acc + (Number(l.price)||0) * (Number(l.quantity)||0), 0);
    this.total.set(sum);
  }
  addProduct(p: ProductDTO){
    const stock = Number(p.quantity) || 0;
    const exists = this.lines().find(l=> l.id === p.id);
    if(exists){
      if(exists.quantity + 1 > stock){ this.errorMsg = `Stock insuficiente para ${p.name}. Disponible: ${stock}`; return; }
      exists.quantity += 1; this.lines.set([...this.lines()]);
    } else {
      if(stock < 1){ this.errorMsg = `Sin stock para ${p.name}`; return; }
      this.lines.set([...this.lines(), { id: p.id!, name: p.name, price: p.price, quantity: 1, stock }]);
    }
    this.productQuery=''; this.productSuggestions.set([]); this.recalc();
  }
  onQtyChange(l: SaleLine){
    if(l.quantity > l.stock) l.quantity = l.stock;
    if(l.quantity < 1) l.quantity = 1;
    this.recalc();
  }
  removeLine(i:number){ const arr = [...this.lines()]; arr.splice(i,1); this.lines.set(arr); this.recalc(); }
  onProductQueryChange(val: string){
    const q = (val||'').trim();
    if(this.searchTimer) clearTimeout(this.searchTimer);
    if(q.length < 2){ this.productSuggestions.set([]); return; }
    this.searchTimer = setTimeout(()=> this.performProductSearch(q), 300);
  }
  private async performProductSearch(q:string){
    try {
      const res = await this.productService.search(q, 0, 8);
      // Only show products with AVAILABLE status
      const filtered = (res || []).filter(p => (p as any).status === 'AVAILABLE');
      this.productSuggestions.set(filtered);
    } catch { this.productSuggestions.set([]); }
  }
  canSubmit(){ return !!this.selectedClient && this.lines().length>0 && this.total()>0; }
  async submitSale(){
    this.errorMsg=''; this.successMsg='';
    if(!this.canSubmit()) return;
    const payload = {
      total: this.total(),
      status: this.status,
  client: { id: Number(this.selectedClient!.id) },
      productList: this.lines().map(l=> ({ id: l.id, name: l.name, price: l.price, quantity: l.quantity }))
    };
    const res = await this.salesService.create(payload);
    if(res.ok){
      this.successMsg = res.message || 'Venta registrada correctamente';
      // refrescar listado
      this.salesPage = 0;
      await this.loadSales();
      this.resetForm();
    } else {
      this.errorMsg = res.message || 'No se pudo registrar la venta';
    }
  }
  resetForm(){ this.selectedClient = null; this.clientQuery=''; this.status='PENDANT'; this.productQuery=''; this.productSuggestions.set([]); this.lines.set([]); this.total.set(0); }
  // Client search
  onClientQueryChange(val: string){
    const q = (val||'').trim();
    if(this.clientTimer) clearTimeout(this.clientTimer);
    if(q.length < 2){ this.clientSuggestions.set([]); return; }
    this.clientTimer = setTimeout(()=> this.performClientSearch(q), 300);
  }
  private async performClientSearch(q:string){
    try { const res = await this.clientService.search(q, 0, 8); this.clientSuggestions.set(res || []); }
    catch { this.clientSuggestions.set([]); }
  }
  selectClient(c: ClientDTO){ this.selectedClient = c; this.clientQuery=''; this.clientSuggestions.set([]); }
  clearClient(){ this.selectedClient = null; }
  async loadSales(){
    const list = await this.salesService.list(undefined, this.salesPage, this.salesPageSize);
    const mapped: Venta[] = (list||[]).map((s:any)=> ({
      id: s.id || 0,
      cliente: (s.client && (s.client.name || s.client.fullName || s.client.firstName+' '+(s.client.lastName||'')))?.trim() || 'Cliente desconocido',
      cantidad: s.productList ? s.productList.reduce((a:number,p:any)=> a + (p.quantity||0), 0) : 0,
      total: s.total || 0,
      fecha: (s.date || s.createdAt || '').slice(0,10),
      status: s.status || s.state || s.responseStatus || 'PENDANT'
    }));
    this.items.set(mapped);
    this.lastSalesCount = mapped.length;
  }
  canPrevSales(){ return this.salesPage > 0; }
  hasNextSales(){ return this.lastSalesCount === this.salesPageSize; }
  async nextSales(){ if(!this.hasNextSales()) return; this.salesPage++; await this.loadSales(); }
  async prevSales(){ if(!this.canPrevSales()) return; this.salesPage--; await this.loadSales(); }
  goToDetail(id: number){ this.router.navigate(['/ventas', id]); }
  statusBadgeClass(status:any){
    const v = String(status||'').toUpperCase();
    if(v==='SUCCESS' || v==='COMPLETED' || v==='COMPLETE' || v==='PAID') return 'badge-success';
    if(v==='PENDANT' || v==='PENDING' || v==='IN_PROGRESS') return 'badge-warning';
    if(v==='CANCELLED' || v==='FAILED' || v==='REJECTED') return 'badge-danger';
    return '';
  }
}
