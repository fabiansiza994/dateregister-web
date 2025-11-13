import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../core/category.service';
import { AuthService } from '../core/auth.service';
import { Router, RouterLink } from '@angular/router';

interface CategoriaUI { id:number; nombre:string; descripcion:string; codigo:string; estado:string; icon?: string; }
interface PendingDelete { item: CategoriaUI | null; }

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="flex items-center justify-between">
    <h2 style="margin:0" class="text-xl font-semibold flex items-center">
      <i class="bi bi-tags-fill me-2"></i>
      Categorías
    </h2>
  </div>
  <div class="mt-4 card">
    <div *ngIf="errorMsg()" class="mb-2 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{{ errorMsg() }}</div>
    <div class="relative">
      <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.478 9.8l3.611 3.611a.75.75 0 1 0 1.06-1.06l-3.61-3.612A5.5 5.5 0 0 0 9 3.5Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd"/>
      </svg>
      <input class="input with-icon placeholder:text-slate-400" placeholder="Buscar categorías..." [(ngModel)]="q" (ngModelChange)="onQueryChange($event)">
      <button *ngIf="q" type="button" (click)="clearQuery()" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Limpiar">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.22 4.22a.75.75 0 0 1 1.06 0L10 8.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L11.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
      </button>
    </div>
    <div class="mt-4 inv-list">
      <div class="inv-item items-start gap-4 cursor-pointer" *ngFor="let c of filtered()" [routerLink]="['/categorias', c.id, 'editar']">
        <!-- Icono a la derecha al comienzo del ítem -->
        <span class="ml-auto order-2 h-10 w-10 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600" title="Icono">
          <ng-container *ngIf="isBootstrapIcon(c.icon); else iconText">
            <i class="bi text-lg" [ngClass]="c.icon"></i>
          </ng-container>
          <ng-template #iconText>
            <span *ngIf="c.icon; else noIcon" class="text-base">{{ c.icon }}</span>
          </ng-template>
          <ng-template #noIcon><svg class="h-5 w-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 6v12M6 12h12" stroke-linecap="round"/></svg></ng-template>
        </span>
        <div class="flex-1 order-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inv-item-title">{{ c.nombre }}</span>
            <span class="hidden sm:inline text-xs text-slate-500">{{ c.codigo }}</span>
            <span class="badge badge-success" *ngIf="c.estado==='ACTIVE'">ACTIVO</span>
            <span class="badge badge-warning" *ngIf="c.estado!=='ACTIVE'">{{ c.estado }}</span>
          </div>
          <div class="inv-item-sub mt-1">{{ c.descripcion || 'Sin descripción' }}</div>
        </div>
        <button class="delete-btn order-3 rounded-md bg-white text-red-600 border border-red-300 hover:bg-red-50 hover:text-red-700 px-3 py-2" title="Eliminar" *ngIf="isAdmin()" (click)="$event.stopPropagation(); deleteItem(c)">
          <svg class="h-4 w-4 trash" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 7.5a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7A.75.75 0 0 1 6 7.5Zm4 .75a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0v-7Zm3.25-.75a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7a.75.75 0 0 1 .75-.75Z"/><path fill-rule="evenodd" d="M3.5 5.75A.75.75 0 0 1 4.25 5h3.86l.43-.86A1.75 1.75 0 0 1 10.14 3h-.28c.67 0 1.29.38 1.58.99l.43.86h3.88a.75.75 0 0 1 0 1.5h-.62l-.74 10.06A2.25 2.25 0 0 1 12.17 19H7.83a2.25 2.25 0 0 1-2.24-2.09L4.86 6.5h-.61a.75.75 0 0 1-.75-.75Zm2.62.75.73 9.9c.03.39.36.7.75.7h4.34c.39 0 .72-.31.75-.7l.73-9.9H6.12Z" clip-rule="evenodd"/></svg>
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
  <a routerLink="/categorias/nueva"
     class="fixed bottom-6 right-6 rounded-full bg-blue-600 text-white h-12 w-12 flex items-center justify-center shadow-lg hover:bg-blue-700"
     [ngClass]="{ 'fab-spin-right': fabSpinRight, 'fab-spin-left': fabSpinLeft }"
     (mouseenter)="onFabEnter()" (mouseleave)="onFabLeave()"
     aria-label="Nueva categoría">
    <svg class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 10 3.5Z"/></svg>
  </a>
  <!-- Form inline eliminado: edición y creación van a vistas separadas -->
  <div *ngIf="toast.visible" class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
    <div class="card w-[320px]">
      <div class="flex items-center justify-between gap-3">
        <span>{{ toast.message }} ({{ toast.seconds }}s)</span>
        <button class="btn btn-outline" (click)="undoDelete()">Deshacer</button>
      </div>
      <div class="mt-2 w-full h-1.5 bg-slate-200 rounded overflow-hidden">
        <div class="toast-progress"></div>
      </div>
    </div>
  </div>
  `
  ,
  styles: [`
    @keyframes shake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
    .delete-btn:hover .trash { animation: shake .28s ease-in-out 1; transform-origin: 50% 10%; }
    @keyframes toastbar { from { width: 100%; } to { width: 0%; } }
    .toast-progress { height: 100%; background-color: #3b82f6; animation: toastbar 7s linear forwards; }
  `]
})
export class CategoriasComponent implements OnInit {
  q='';
  private seq = 3;
  items = signal<CategoriaUI[]>([]); // visible list
  allItems = signal<CategoriaUI[]>([]); // full list for local filtering/restore
  editing = signal(false); // mantenido para compat, ya no se usa inline
  form: CategoriaUI = { id:0, nombre:'', descripcion:'', codigo:'', estado:'ACTIVE', icon: '' }; // legacy
  toast = { visible:false, message:'', timeoutId: 0 as any, seconds: 0 };
  pendingDelete: PendingDelete = { item: null };
  errorMsg = signal<string>('');
  filtered = computed(()=> this.items());
  page = 0;
  pageSize = 10;
  lastCount = 0;
  remoteMode = false;
  // Métodos inline obsoletos; migrados a páginas separadas
  startCreate(){}
  edit(c:CategoriaUI){}
  cancel(){}
  async save(){}
  deleteItem(c: CategoriaUI){
    if(!this.isAdmin()){ this.errorMsg.set('Acción restringida a ADMIN.'); return; }
    this.errorMsg.set('');
    const current = this.items();
    this.items.set(current.filter(x => x.id !== c.id));
    this.pendingDelete.item = c;
    this.toast.message = `Categoría "${c.nombre}" eliminada`;
    this.toast.visible = true;
    this.editing.set(false);
    // cuenta regresiva de 7s
    this.toast.seconds = 7;
    const tick = () => {
      if(!this.toast.visible) return;
      this.toast.seconds = this.toast.seconds - 1;
      if(this.toast.seconds <= 0){ this.commitDelete(); }
      else { this.toast.timeoutId = setTimeout(tick, 1000); }
    };
    this.toast.timeoutId = setTimeout(tick, 1000);
  }

  async commitDelete(){
    const c = this.pendingDelete.item;
    this.toast.visible = false;
    if(!c) return;
    if(!this.isAdmin()){
      // Restaurar si alguien intenta forzar la eliminación sin permisos
      this.items.set(c ? [c, ...this.items()] : this.items());
      this.pendingDelete.item = null;
      this.errorMsg.set('Acción restringida a ADMIN.');
      return;
    }
    this.pendingDelete.item = null;
    try {
      const result = await this.categoryService.remove(c.id);
      if(!result.ok){
        // restore item and show error message
        this.items.set([c, ...this.items()]);
        this.errorMsg.set(result.message || 'No se pudo eliminar la categoría.');
      }
    } catch (e:any) {
      this.items.set([c, ...this.items()]);
      this.errorMsg.set(e?.message || 'Error inesperado eliminando la categoría.');
    }
  }

  undoDelete(){
    if(this.toast.timeoutId){ clearTimeout(this.toast.timeoutId); }
    const c = this.pendingDelete.item;
    this.toast.visible = false;
    if(c){ this.items.set([c, ...this.items()]); this.pendingDelete.item = null; }
  }

  constructor(private categoryService: CategoryService, private router: Router, private auth: AuthService){}

  async ngOnInit(){ await this.load(); }

  private async load(){
    this.errorMsg.set('');
    const list = await this.categoryService.list();
    const mapped = list.map(c=> ({
      id: c.id!,
      nombre: c.name,
      descripcion: c.description || c.desctiption || '',
      codigo: c.code,
      estado: c.status,
      icon: c.icon
    }));
    this.allItems.set(mapped);
    this.items.set(mapped);
  }

  private searchTimer: any = null;
  onQueryChange(val: string){
    const text = (val || '').trim();
    if(this.searchTimer) clearTimeout(this.searchTimer);
    if(text.length < 2){
      const s = text.toLowerCase();
      const base = this.allItems();
      const filtered = s ? base.filter(x=> x.nombre.toLowerCase().includes(s) || x.descripcion.toLowerCase().includes(s) || x.codigo.toLowerCase().includes(s)) : base;
      this.items.set(filtered);
      this.remoteMode = false;
      return;
    }
    this.page = 0;
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
      const results = await this.categoryService.search(name, this.page, this.pageSize);
      if(this.q.trim().toLowerCase() !== name.toLowerCase()) return; // evitar respuestas antiguas
      const mapped = (results || []).map(c=> ({
        id: c.id!,
        nombre: c.name,
        descripcion: c.description || c.desctiption || '',
        codigo: c.code,
        estado: c.status,
        icon: c.icon
      }));
      this.items.set(mapped);
      this.lastCount = mapped.length;
      this.remoteMode = true;
    } catch {
      // mantener lista actual
      this.errorMsg.set('Error buscando categorías.');
    }
  }
  hasNext(){ return this.remoteMode && this.lastCount === this.pageSize; }
  canPrev(){ return this.remoteMode && this.page > 0; }
  async nextPage(){ if(!this.hasNext()) return; this.page++; await this.performRemoteSearch(this.q); }
  async prevPage(){ if(!this.canPrev()) return; this.page--; await this.performRemoteSearch(this.q); }
  isBootstrapIcon(icon?: string){ return !!icon && icon.includes('bi'); }
  isAdmin(){ return this.auth.role() === 'ADMIN'; }
  // FAB hover spin state
  fabSpinRight = false;
  fabSpinLeft = false;
  private fabTimer: any = null;
  onFabEnter(){
    if(this.fabTimer) { clearTimeout(this.fabTimer); this.fabTimer = null; }
    this.fabSpinLeft = false;
    this.fabSpinRight = false;
    requestAnimationFrame(()=> { this.fabSpinRight = true; });
  }
  onFabLeave(){
    this.fabSpinRight = false;
    this.fabSpinLeft = true;
    this.fabTimer = setTimeout(()=> { this.fabSpinLeft = false; this.fabTimer = null; }, 380);
  }
}
