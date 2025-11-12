import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientService, ClientDTO } from '../core/client.service';
import { Router, RouterLink } from '@angular/router';

interface Cliente { id:number; nombre:string; email?:string; telefono?:string; }

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="flex items-center justify-between">
    <h2 style="margin:0" class="text-xl font-semibold">Clientes</h2>
  </div>
  <div class="mt-4 card">
    <div class="flex items-center gap-2">
      <input class="input" placeholder="Buscar clientes..." [(ngModel)]="q" (ngModelChange)="onQueryChange($event)">
      <button class="btn btn-outline" (click)="clearQuery()">Limpiar</button>
    </div>
    <div class="mt-4 inv-list">
      <div class="inv-item cursor-pointer" *ngFor="let c of filtered()" (click)="goEditPage(c.id)">
        <div>
          <div class="inv-item-title">{{c.nombre}}</div>
          <div class="inv-item-sub">{{c.email || '—'}} • {{c.telefono || '—'}}</div>
        </div>
      </div>
      <div class="text-center text-xs" *ngIf="filtered().length===0">Sin resultados</div>
    </div>
    <div class="mt-3 flex justify-end gap-2" *ngIf="remoteMode">
      <button class="btn btn-outline" (click)="prevPage()" [disabled]="!canPrev()">Anterior</button>
      <button class="btn btn-outline" (click)="nextPage()" [disabled]="!hasNext()">Siguiente</button>
      <span class="text-xs text-slate-500 self-center">Página {{ page + 1 }}</span>
    </div>
  </div>
  <a routerLink="/clientes/nuevo" class="fixed bottom-6 right-6 rounded-full bg-blue-600 text-white h-12 w-12 flex items-center justify-center shadow-lg hover:bg-blue-700" aria-label="Nuevo cliente">
    <svg class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 10 3.5Z"/></svg>
  </a>
  `
  ,
  styles: [`
    @keyframes shake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
    .delete-btn:hover .trash { animation: shake .28s ease-in-out 1; transform-origin: 50% 10%; }
  `]
})
export class ClientesComponent implements OnInit {
  q='';
  private seq=3;
  items = signal<Cliente[]>([]);
  editing = signal(false);
  form: Cliente = { id:0, nombre:'', email:'', telefono:'', direccion:'', estado:'ACTIVE' } as any;
  saving = false;
  filtered = computed(()=> {
    const s = this.q.trim().toLowerCase();
    return this.items().filter(x=> !s || x.nombre.toLowerCase().includes(s) || x.email?.toLowerCase().includes(s));
  });
  // remote search state
  private searchTimer: any = null;
  page = 0;
  pageSize = 10;
  lastCount = 0;
  remoteMode = false;
  constructor(private clientService: ClientService, private router: Router) {}
  async ngOnInit(){ await this.load(); }
  async onQueryChange(val: string){
    const text = (val||'').trim();
    if(this.searchTimer) clearTimeout(this.searchTimer);
    if(text.length < 2){ this.page = 0; await this.load(); return; }
    this.page = 0;
    this.searchTimer = setTimeout(()=> this.performRemoteSearch(text), 350);
  }
  clearQuery(){ this.q=''; this.page=0; this.lastCount=0; this.load(); }
  private async load(){
    try {
      const results = await this.clientService.list(this.page, this.pageSize);
      const mapped: Cliente[] = (results||[]).map((c:ClientDTO)=> ({ id: c.id, nombre: c.name, email: (c as any).email || '', telefono: (c as any).phone || '' }));
      this.items.set(mapped);
      this.lastCount = mapped.length;
      this.remoteMode = true;
    } catch { /* keep state */ }
  }
  private async performRemoteSearch(text: string){
    const name = (text||'').trim(); if(name.length<2) { this.items.set([]); return; }
    try {
      const results = await this.clientService.search(name, this.page, this.pageSize);
      if(this.q.trim().toLowerCase() !== name.toLowerCase()) return;
      const mapped: Cliente[] = (results||[]).map((c:ClientDTO)=> ({ id: c.id, nombre: c.name, email: (c as any).email || '', telefono: (c as any).phone || '' }));
      this.items.set(mapped);
      this.lastCount = mapped.length;
      this.remoteMode = true;
    } catch { /* keep current */ }
  }
  hasNext(){ return this.remoteMode && this.lastCount === this.pageSize; }
  canPrev(){ return this.remoteMode && this.page > 0; }
  async nextPage(){ if(!this.hasNext()) return; this.page++; if(this.q.trim().length<2) await this.load(); else await this.performRemoteSearch(this.q); }
  async prevPage(){ if(!this.canPrev()) return; this.page--; if(this.q.trim().length<2) await this.load(); else await this.performRemoteSearch(this.q); }
  startCreate(){ this.router.navigate(['/clientes/nuevo']); }
  goEditPage(id:number){ this.router.navigate(['/clientes', id, 'editar']); }
}
