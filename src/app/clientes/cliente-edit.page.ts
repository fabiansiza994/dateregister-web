import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ClienteFormComponent, ClienteFormModel } from './cliente-form.component';
import { ClientService } from '../core/client.service';

@Component({
  selector: 'app-cliente-edit-page',
  standalone: true,
  imports: [CommonModule, ClienteFormComponent],
  template: `
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Editar cliente</h2>
    </div>
    <ng-container *ngIf="loaded(); else loadingTpl">
      <app-cliente-form [model]="model()" (save)="save($event)" (cancel)="goBack()" />
      
    </ng-container>
    <ng-template #loadingTpl>
      <div class="text-xs text-center">Cargando...</div>
    </ng-template>
  </div>
  `
})
export class ClienteEditPage {
  model = signal<ClienteFormModel>({ id:0, nombre:'', email:'', telefono:'', direccion:'', estado:'ACTIVE' });
  loaded = signal(false);
  private id = 0;
  constructor(private route: ActivatedRoute, private clientService: ClientService, private router: Router){
    this.init();
  }
  private async init(){
    this.id = Number(this.route.snapshot.paramMap.get('id')) || 0;
    if(!this.id){ this.router.navigateByUrl('/clientes'); return; }
    const dto = await this.clientService.get(this.id);
    if(!dto){ this.router.navigateByUrl('/clientes'); return; }
    this.model.set({ id: dto.id, nombre: dto.name, email: (dto as any).email || '', telefono: (dto as any).phone || '', direccion: (dto as any).address || '', estado: dto.status || 'ACTIVE' });
    this.loaded.set(true);
  }
  async save(m: ClienteFormModel){
    const res = await this.clientService.update({ id: m.id, name: m.nombre, email: m.email, phone: m.telefono, address: m.direccion, status: m.estado });
    if(res.ok){ this.router.navigateByUrl('/clientes'); }
    else { alert(res.message || 'No se pudo actualizar el cliente'); }
  }
  goBack(){ this.router.navigateByUrl('/clientes'); }
}
