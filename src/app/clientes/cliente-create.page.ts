import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ClienteFormComponent, ClienteFormModel } from './cliente-form.component';
import { ClientService } from '../core/client.service';

@Component({
  selector: 'app-cliente-create-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ClienteFormComponent],
  template: `
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Nuevo cliente</h2>
      <a routerLink="/clientes" class="btn btn-outline">Volver</a>
    </div>
    <app-cliente-form [model]="model()" (save)="save($event)" (cancel)="goBack()" />
  </div>
  `
})
export class ClienteCreatePage {
  model = signal<ClienteFormModel>({ id:0, nombre:'', email:'', telefono:'', direccion:'', estado:'ACTIVE' });
  constructor(private clientService: ClientService, private router: Router) {}

  async save(m: ClienteFormModel){
    const res = await this.clientService.create({
      name: m.nombre,
      email: m.email,
      phone: m.telefono,
      address: m.direccion,
      status: m.estado
    });
    if(res.ok){ this.router.navigateByUrl('/clientes'); }
    else { alert(res.message || 'No se pudo crear el cliente'); }
  }
  goBack(){ this.router.navigateByUrl('/clientes'); }
}
