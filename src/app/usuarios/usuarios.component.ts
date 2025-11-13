import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserDTO } from '../core/user.service';

interface UsuarioUI { id:number; username:string; nombre:string; email?:string; rol?: string; estado?: string; }

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="flex items-center justify-between">
    <h2 style="margin:0" class="text-xl font-semibold flex items-center">
      <i class="bi bi-people-fill me-2"></i>
      Usuarios
    </h2>
  </div>
  <div class="mt-4 card">
    <div *ngIf="errorMsg()" class="mb-2 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{{ errorMsg() }}</div>
    <div class="relative">
      <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.478 9.8l3.611 3.611a.75.75 0 1 0 1.06-1.06l-3.61-3.612A5.5 5.5 0 0 0 9 3.5Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd"/>
      </svg>
      <input class="input with-icon placeholder:text-slate-400" placeholder="Buscar por nombre o usuario..." [(ngModel)]="q" (ngModelChange)="onQueryChange($event)">
      <button *ngIf="q" type="button" (click)="clearQuery()" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Limpiar">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.22 4.22a.75.75 0 0 1 1.06 0L10 8.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L11.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
      </button>
    </div>
    <div class="mt-4 inv-list">
        <div class="inv-item cursor-pointer" *ngFor="let u of filtered()" (click)="openEdit(u.id)">
          <div class="flex items-start justify-between w-full gap-3">
          <div class="flex items-start gap-3">
            <i class="bi bi-person-circle text-slate-500 text-xl mt-0.5"></i>
            <div>
            <div class="inv-item-title">{{ u.username }} — {{ u.nombre }}</div>
            <div class="inv-item-sub">{{ u.email || '—' }} • Rol: {{ u.rol || '—' }}</div>
            </div>
          </div>
          <span class="badge h-fit" [ngClass]="statusBadgeClass(u.estado)">{{ u.estado || '—' }}</span>
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

  <!-- FAB crear -->
  <button type="button"
     class="fixed bottom-6 right-6 rounded-full bg-blue-600 text-white h-12 w-12 flex items-center justify-center shadow-lg hover:bg-blue-700"
     [ngClass]="{ 'fab-spin-right': fabSpinRight, 'fab-spin-left': fabSpinLeft }"
     (mouseenter)="onFabEnter()" (mouseleave)="onFabLeave()" (click)="openCreate()"
     aria-label="Nuevo usuario">
    <svg class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 10 3.5Z"/></svg>
  </button>

  <!-- Modal crear usuario -->
  <div *ngIf="creating" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div class="card w-full max-w-md" (click)="$event.stopPropagation()">
      <h3 class="text-lg font-semibold m-0">Crear usuario</h3>
      <div *ngIf="formError" class="mt-2 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{{ formError }}</div>
      <div class="grid gap-3 mt-3">
        <div>
          <label class="text-xs text-slate-600">Usuario</label>
          <input class="input" [(ngModel)]="form.username" placeholder="user.name">
        </div>
        <div>
          <label class="text-xs text-slate-600">Nombre</label>
          <input class="input" [(ngModel)]="form.name" placeholder="Nombre completo">
        </div>
        <div>
          <label class="text-xs text-slate-600">Email</label>
          <input class="input" type="email" [(ngModel)]="form.email" placeholder="correo@dominio.com">
        </div>
        <div>
          <label class="text-xs text-slate-600">Contraseña</label>
          <input class="input" type="password" [(ngModel)]="form.password" placeholder="••••">
        </div>
        <div>
          <label class="text-xs text-slate-600">Rol</label>
          <select class="input" [(ngModel)]="form.rolId">
            <option [ngValue]="1">ADMIN</option>
            <option [ngValue]="2">VENDEDOR</option>
            <option [ngValue]="3">SUPERVISOR</option>
          </select>
        </div>
      </div>
      <div class="mt-4 flex items-center gap-2 justify-end">
        <button class="btn btn-outline" (click)="closeCreate()">Cancelar</button>
        <button class="btn btn-primary" (click)="submitCreate()" [disabled]="submitting">Crear</button>
      </div>
    </div>
  </div>

  <!-- Modal editar usuario -->
  <div *ngIf="editing" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" (click)="closeEdit()">
    <div class="card w-full max-w-md" (click)="$event.stopPropagation()">
      <h3 class="text-lg font-semibold m-0">Editar usuario</h3>
      <div *ngIf="editError" class="mt-2 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{{ editError }}</div>
      <div class="grid gap-3 mt-3" *ngIf="!editLoading; else loadingEditTpl">
        <div>
          <label class="text-xs text-slate-600">Usuario</label>
          <input class="input" [value]="editForm.username" readonly>
        </div>
        <div>
          <label class="text-xs text-slate-600">Nombre</label>
          <input class="input" [(ngModel)]="editForm.name" placeholder="Nombre completo">
        </div>
        <div>
          <label class="text-xs text-slate-600">Email</label>
          <input class="input" type="email" [(ngModel)]="editForm.email" placeholder="correo@dominio.com">
        </div>
        <div>
          <label class="text-xs text-slate-600">Rol</label>
          <select class="input" [(ngModel)]="editForm.roleId">
            <option [ngValue]="1">ADMIN</option>
            <option [ngValue]="2">USER</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-600">Nueva contraseña (opcional)</label>
          <input class="input" type="password" [(ngModel)]="editForm.password" placeholder="••••">
          <div class="text-[11px] text-slate-500 mt-1">Déjalo en blanco para mantener la actual.</div>
        </div>
        <div>
          <label class="text-xs text-slate-600">Confirmar contraseña</label>
          <input class="input" type="password" [(ngModel)]="editForm.confirmPassword" placeholder="••••">
        </div>
      </div>
      <ng-template #loadingEditTpl>
        <div class="mt-3 text-sm text-slate-500">Cargando...</div>
      </ng-template>
      <div class="mt-4 flex items-center gap-2 justify-end">
        <button class="btn btn-outline" (click)="closeEdit()">Cancelar</button>
        <button class="btn btn-primary" (click)="submitEdit()" [disabled]="editLoading">Guardar</button>
      </div>
    </div>
  </div>
  `
})
export class UsuariosComponent {
  q='';
  items = signal<UsuarioUI[]>([]);
  errorMsg = signal<string>('');
  page = 0; size = 10; lastCount = 0; remoteMode = true;
  filtered = computed(()=> {
    const s = this.q.trim().toLowerCase();
    return this.items().filter(x=> !s || x.username.toLowerCase().includes(s) || x.nombre.toLowerCase().includes(s));
  });
  private timer: any = null;

  // Create modal state
  creating = false; submitting = false; formError = '';
  form = { username:'', name:'', email:'', password:'', rolId: 2 };

  // Edit modal state
  editing = false; editLoading = false; editError = '';
  editForm: { id:number; username:string; name:string; email?:string; roleId:number; password?:string; confirmPassword?:string } = { id:0, username:'', name:'', email:'', roleId: 2, password:'', confirmPassword:'' };

  constructor(private users: UserService){ this.reload(); }

  async reload(){
    this.errorMsg.set('');
    const list = await this.users.search(this.q || undefined, this.page, this.size);
    const mapped: UsuarioUI[] = (list||[]).map((u:UserDTO)=> ({
      id: u.id,
      username: u.username,
      nombre: u.name,
      email: (u as any).email || '',
      rol: (u as any).role?.nombre || (u as any).role?.name || (u as any).rol?.nombre || (u as any).rol?.name || '',
      estado: (u as any).status || ''
    }));
    this.items.set(mapped);
    this.lastCount = mapped.length;
  }
  onQueryChange(val: string){
    const text = (val||'').trim();
    if(this.timer) clearTimeout(this.timer);
    this.page = 0;
    this.timer = setTimeout(()=> this.reload(), 350);
  }
  clearQuery(){ this.q=''; this.page=0; this.reload(); }
  hasNext(){ return this.lastCount === this.size; }
  canPrev(){ return this.page > 0; }
  async nextPage(){ if(!this.hasNext()) return; this.page++; await this.reload(); }
  async prevPage(){ if(!this.canPrev()) return; this.page--; await this.reload(); }
  statusBadgeClass(status:any){
    const v = String(status||'').toUpperCase();
    if(v==='ACTIVE' || v==='ENABLED') return 'badge-success';
    if(v==='INACTIVE' || v==='DISABLED' || v==='BANNED') return 'badge-danger';
    if(v) return 'badge-warning';
    return '';
  }

  // FAB hover spin state
  fabSpinRight = false; fabSpinLeft = false; private fabTimer:any=null;
  onFabEnter(){ if(this.fabTimer){ clearTimeout(this.fabTimer); this.fabTimer=null; } this.fabSpinLeft=false; this.fabSpinRight=false; requestAnimationFrame(()=> this.fabSpinRight = true); }
  onFabLeave(){ this.fabSpinRight=false; this.fabSpinLeft=true; this.fabTimer = setTimeout(()=> { this.fabSpinLeft=false; this.fabTimer=null; }, 620); }

  openCreate(){ this.creating = true; this.formError=''; }
  closeCreate(){ this.creating = false; this.submitting=false; this.formError=''; this.form = { username:'', name:'', email:'', password:'', rolId: 2 }; }
  async submitCreate(){
    if(!this.form.username.trim() || !this.form.name.trim() || !this.form.password.trim()){
      this.formError = 'Completa usuario, nombre y contraseña';
      return;
    }
    this.submitting = true; this.formError='';
    const res = await this.users.register(this.form);
    this.submitting = false;
    if(res.ok){ this.closeCreate(); this.page=0; await this.reload(); }
    else { this.formError = res.message || 'No se pudo crear el usuario'; }
  }

  async openEdit(id:number){
    this.editing = true; this.editError=''; this.editLoading = true;
    const u = await this.users.getById(id);
    if(!u){ this.editError = 'No se pudo cargar el usuario'; this.editLoading=false; return; }
    this.editForm = {
      id: u.id,
      username: u.username,
      name: u.name,
      email: (u as any).email || '',
      roleId: (u as any).role?.id || (u as any).rol?.id || 2
    };
    this.editLoading = false;
  }
  closeEdit(){ this.editing = false; this.editError=''; this.editLoading=false; }
  async submitEdit(){
    if(!this.editForm.id){ this.editError = 'Usuario inválido'; return; }
    // Validación de contraseña (opcional)
    const pwd = (this.editForm.password||'').trim();
    const cpwd = (this.editForm.confirmPassword||'').trim();
    if(pwd || cpwd){
      if(!pwd || !cpwd){ this.editError = 'Completa ambos campos de contraseña'; return; }
      if(pwd !== cpwd){ this.editError = 'Las contraseñas no coinciden'; return; }
      if(pwd.length < 4){ this.editError = 'La contraseña debe tener al menos 4 caracteres'; return; }
    }
    this.editLoading = true; this.editError='';
    const res = await this.users.update({ id: this.editForm.id, name: this.editForm.name, email: this.editForm.email, roleId: this.editForm.roleId, password: pwd || undefined });
    this.editLoading = false;
    if(res.ok){ this.closeEdit(); this.page=0; await this.reload(); }
    else { this.editError = res.message || 'No se pudo actualizar el usuario'; }
  }
}
