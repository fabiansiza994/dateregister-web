import { Component, signal, computed, OnInit } from '@angular/core';
import { ProductService } from '../core/product.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../core/category.service';
import { AuthService } from '../core/auth.service';

interface ProductoUI { id:number; nombre:string; categoria:string; categoriaId?:number; precio:number; stock:number; status:string; image?: string; }
interface PendingDelete { item: ProductoUI | null; }

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="flex items-center justify-between">
    <h2 class="m-0 text-xl font-semibold">Productos</h2>
  </div>
  <div class="mt-4 card">
    <div *ngIf="errorMsg()" class="mb-2 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{{ errorMsg() }}</div>
    <div class="relative">
      <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.478 9.8l3.611 3.611a.75.75 0 1 0 1.06-1.06l-3.61-3.612A5.5 5.5 0 0 0 9 3.5Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd"/>
      </svg>
      <input class="input with-icon placeholder:text-slate-400" placeholder="Buscar productos..." [(ngModel)]="q" (ngModelChange)="onQueryChange($event)">
      <button *ngIf="q" type="button" (click)="clearQuery()" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Limpiar">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.22 4.22a.75.75 0 0 1 1.06 0L10 8.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L11.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
      </button>
    </div>
    <!-- Category badges -->
    <div class="mt-3 flex flex-wrap gap-2">
      <button type="button" class="text-[11px] px-2 py-1 rounded-full border"
        [ngClass]="selectedCategoryId==null ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'"
        (click)="selectCategory(null)">Todos</button>
      <button type="button" class="text-[11px] px-2 py-1 rounded-full border"
        *ngFor="let c of categorias()"
        [ngClass]="(selectedCategoryId===c.id ? 'ring-2 ring-offset-1 ring-offset-white ' : '') + getCategoryBadgeClass(c.id)"
        (click)="selectCategory(c.id)">{{ c.nombre }}</button>
    </div>
    <div class="mt-4 inv-list">
      <div class="inv-item items-center gap-4" *ngFor="let p of filtered()" (click)="goEditPage(p.id)">
        <div class="shrink-0 h-16 w-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
          <img *ngIf="p.image; else placeholderImg" [src]="getImageSrc(p.image)" alt="{{p.nombre}}" class="h-full w-full object-contain" />
          <ng-template #placeholderImg>
            <svg class="h-8 w-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l1.828 1.828A2 2 0 0 0 12.828 6H19a2 2 0 0 1 2 2v2M3 5v14a2 2 0 0 0 2 2h7m7-10v10a2 2 0 0 1-2 2h-5m7-12h-5a2 2 0 0 0-1.414.586l-7 7A2 2 0 0 0 7 17h5m4-6h.01" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </ng-template>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{p.nombre}}</span>
            <span class="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium"
              [ngClass]="(p.status||'').toUpperCase()==='AVAILABLE' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'">
              {{ p.status }}
            </span>
          </div>
          <div class="text-xs text-slate-600 mt-1">{{p.categoria}} • $ {{ formatPrecio(p.precio) }} • stock {{p.stock}}</div>
        </div>
        <button *ngIf="isAdmin()" class="btn btn-outline" title="Eliminar" (click)="$event.stopPropagation(); deleteItem(p)">
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 7.5a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7A.75.75 0 0 1 6 7.5Zm4 .75a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0v-7Zm3.25-.75a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7a.75.75 0 0 1 .75-.75Z"/><path fill-rule="evenodd" d="M3.5 5.75A.75.75 0 0 1 4.25 5h3.86l.43-.86A1.75 1.75 0 0 1 10.14 3h-.28c.67 0 1.29.38 1.58.99l.43.86h3.88a.75.75 0 0 1 0 1.5h-.62l-.74 10.06A2.25 2.25 0 0 1 12.17 19H7.83a2.25 2.25 0 0 1-2.24-2.09L4.86 6.5h-.61a.75.75 0 0 1-.75-.75Zm2.62.75.73 9.9c.03.39.36.7.75.7h4.34c.39 0 .72-.31.75-.7l.73-9.9H6.12Z" clip-rule="evenodd"/></svg>
        </button>
      </div>
      <div class="text-center text-xs" *ngIf="filtered().length===0">Sin resultados</div>
    </div>
    <div class="mt-3 flex justify-end gap-2" *ngIf="remoteMode">
      <button class="btn btn-outline" (click)="prevPage()" [disabled]="!canPrev()">Anterior</button>
      <button class="btn btn-outline" (click)="nextPage()" [disabled]="!hasNext()">Siguiente</button>
      <span class="text-xs text-slate-500 self-center">Página {{ page + 1 }}</span>
    </div>
  </div>
  <a routerLink="/productos/nuevo" class="fixed bottom-6 right-6 rounded-full bg-blue-600 text-white h-12 w-12 flex items-center justify-center shadow-lg hover:bg-blue-700" aria-label="Nuevo">
    <svg class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 10 3.5Z"/></svg>
  </a>
  <div *ngIf="toast.visible" class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
    <div class="card flex items-center gap-3">
      <span>{{ toast.message }} ({{ toast.seconds }}s)</span>
      <button class="btn btn-outline" (click)="undoDelete()">Deshacer</button>
    </div>
  </div>
  `
})
export class ProductosComponent implements OnInit {
  q = '';
  items = signal<ProductoUI[]>([]); // visible list (local filtered or remote results)
  allItems = signal<ProductoUI[]>([]); // original full list to restore/local filter
  categorias = signal<{id:number; nombre:string}[]>([]);
  toast = { visible: false, message: '', timeoutId: 0 as any, seconds: 0 };
  pendingDelete: PendingDelete = { item: null };
  errorMsg = signal<string>('');
  // pagination state for remote search
  page = 0;
  pageSize = 10;
  lastCount = 0;
  remoteMode = false;

  // Already maintain items as the list to display
  filtered = computed(()=> this.items());


  constructor(private productService: ProductService, private categoryService: CategoryService, private router: Router, private auth: AuthService){}

  async ngOnInit(){ await this.load(); }
  private searchTimer: any = null;
  onQueryChange(val: string){
    const text = (val || '').trim();
    if(this.searchTimer) clearTimeout(this.searchTimer);
    if(text.length < 2){
      const s = text.toLowerCase();
      const base = this.allItems();
  let filtered = s ? base.filter(x=> x.nombre.toLowerCase().includes(s) || x.categoria.toLowerCase().includes(s)) : base;
  if(this.selectedCategoryId!=null){ filtered = filtered.filter(x=> x.categoriaId === this.selectedCategoryId); }
  this.items.set(filtered);
      this.remoteMode = false;
      return;
    }
    this.page = 0; // reset pagination when query changes
    // debounce remote search
    this.searchTimer = setTimeout(()=> this.performRemoteSearch(text), 350);
  }

  clearQuery(){
    this.q='';
    this.items.set(this.allItems());
    this.remoteMode = false;
    this.page = 0;
    this.lastCount = 0;
  }

  private async performRemoteSearch(text: string){
    const name = (text || '').trim();
    if(name.length < 2){ this.items.set(this.allItems()); return; }
    try {
      const results = await this.productService.search(name, this.page, this.pageSize);
      // ignore out-of-date responses
      if(this.q.trim().toLowerCase() !== name.toLowerCase()) return;
      let mapped = (results || []).map(p=> ({
        id: p.id!,
        nombre: p.name,
        categoria: p.category?.name || p.category?.id?.toString() || '',
        categoriaId: p.category?.id,
        precio: p.price,
        stock: Number(p.quantity),
        status: (p.status || 'AVAILABLE'),
        image: p.image
      }));
      if(this.selectedCategoryId!=null){ mapped = mapped.filter(x=> x.categoriaId === this.selectedCategoryId); }
      this.items.set(mapped);
      this.lastCount = mapped.length;
      this.remoteMode = true;
    } catch {
      // keep current items on error
    }
  }


  private async load(){
    const [list, cats] = await Promise.all([
      this.productService.list(),
      this.categoryService.list()
    ]);
    this.categorias.set(cats.map(c=> ({ id: c.id!, nombre: c.name })));
    // Adapt backend fields to UI structure
    const mapped = list.map(p=> ({
      id: p.id!,
      nombre: p.name,
      categoria: p.category?.name || p.category?.id?.toString() || '',
      categoriaId: p.category?.id,
      precio: p.price,
      stock: Number(p.quantity),
      status: (p.status || 'AVAILABLE'),
      image: p.image
    }));
    this.allItems.set(mapped);
    this.items.set(mapped);
  }

  // pagination controls
  hasNext(){ return this.remoteMode && this.lastCount === this.pageSize; }
  canPrev(){ return this.remoteMode && this.page > 0; }
  async nextPage(){ if(!this.hasNext()) return; this.page++; await this.performRemoteSearch(this.q); }
  async prevPage(){ if(!this.canPrev()) return; this.page--; await this.performRemoteSearch(this.q); }
  selectedCategoryId: number | null = null;
  selectCategory(id:number|null){
    this.selectedCategoryId = (this.selectedCategoryId === id)? null : id;
    const text=(this.q||'').trim();
    if(text.length<2){
      const s=text.toLowerCase();
      let base=this.allItems();
      let filtered = s ? base.filter(x=> x.nombre.toLowerCase().includes(s) || x.categoria.toLowerCase().includes(s)) : base;
      if(this.selectedCategoryId!=null){ filtered = filtered.filter(x=> x.categoriaId === this.selectedCategoryId); }
      this.items.set(filtered);
      this.remoteMode=false;
    } else {
      this.performRemoteSearch(text);
    }
  }
  getCategoryBadgeClass(id:number){
    const palette = [
      'bg-blue-100 text-blue-700 border-blue-300',
      'bg-emerald-100 text-emerald-700 border-emerald-300',
      'bg-indigo-100 text-indigo-700 border-indigo-300',
      'bg-rose-100 text-rose-700 border-rose-300',
      'bg-amber-100 text-amber-700 border-amber-300',
      'bg-teal-100 text-teal-700 border-teal-300',
      'bg-violet-100 text-violet-700 border-violet-300',
      'bg-cyan-100 text-cyan-700 border-cyan-300'
    ];
    return palette[id % palette.length] + ' border';
  }
  getImageSrc(img?: string){
    if(!img) return '';
    return img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
  }

  goEditPage(id:number){ this.router.navigate(['/productos', id, 'editar']); }
  formatPrecio(v:number){ return new Intl.NumberFormat('es-ES', { minimumFractionDigits:0 }).format(v); }

  isAdmin(){ return this.auth.role() === 'ADMIN'; }

  deleteItem(p: ProductoUI){
    if(!this.isAdmin()) return;
    this.errorMsg.set('');
    const current = this.items();
    this.items.set(current.filter(x => x.id !== p.id));
    this.pendingDelete.item = p;
    this.toast.message = `Producto "${p.nombre}" eliminado`;
    this.toast.visible = true;
    // iniciar cuenta regresiva de 4s
    this.toast.seconds = 4;
    const tick = () => {
      if(!this.toast.visible) return;
      this.toast.seconds = this.toast.seconds - 1;
      if(this.toast.seconds <= 0){ this.commitDelete(); }
      else { this.toast.timeoutId = setTimeout(tick, 1000); }
    };
    this.toast.timeoutId = setTimeout(tick, 1000);
  }

  async commitDelete(){
    const p = this.pendingDelete.item;
    this.toast.visible = false;
    if(!p) return;
    this.pendingDelete.item = null;
    try {
      const result = await this.productService.remove(p.id);
      if(!result.ok){
        this.items.set([p, ...this.items()]);
        this.errorMsg.set(result.message || 'No se pudo eliminar el producto.');
      }
    } catch(e:any) {
      this.items.set([p, ...this.items()]);
      this.errorMsg.set((e?.message as string) || 'Error inesperado eliminando el producto.');
    }
  }

  undoDelete(){
    if(this.toast.timeoutId){ clearTimeout(this.toast.timeoutId); }
    const p = this.pendingDelete.item;
    this.toast.visible = false;
    if(p){ this.items.set([p, ...this.items()]); this.pendingDelete.item = null; }
  }
}
