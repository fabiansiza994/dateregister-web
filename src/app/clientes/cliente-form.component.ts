import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ClienteFormModel {
  id: number;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  estado?: string; // ACTIVE | INACTIVE
}

@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="card max-w-2xl mx-auto">
    <h2 class="text-lg font-semibold mb-3">{{ model.id ? 'Editar' : 'Crear' }} cliente</h2>
    <form (ngSubmit)="submit()" class="grid gap-3">
      <input class="input" placeholder="Nombre" [(ngModel)]="model.nombre" name="nombre" required>
      <input class="input" placeholder="Email" [(ngModel)]="model.email" name="email" type="email">
      <input class="input" placeholder="Teléfono" [(ngModel)]="model.telefono" name="telefono">
      <input class="input" placeholder="Dirección" [(ngModel)]="model.direccion" name="direccion">
      <select class="input" [(ngModel)]="model.estado" name="estado">
        <option value="ACTIVE">ACTIVO</option>
        <option value="INACTIVE">INACTIVO</option>
      </select>
      <div class="flex items-center gap-2 mt-1">
        <button type="submit" class="btn btn-primary">{{ model.id ? 'Guardar cambios' : 'Crear' }}</button>
        <button type="button" class="btn btn-outline" (click)="cancel.emit()">Cancelar</button>
      </div>
    </form>
  </div>
  `
})
export class ClienteFormComponent {
  @Input() model: ClienteFormModel = { id:0, nombre:'', email:'', telefono:'', direccion:'', estado:'ACTIVE' };
  @Output() save = new EventEmitter<ClienteFormModel>();
  @Output() cancel = new EventEmitter<void>();

  submit(){
    if(!this.model.nombre?.trim()) return;
    this.save.emit(this.model);
  }
}
