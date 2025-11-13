import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ProductoFormModel {
  id: number;
  nombre: string;
  categoria: string; // category id as string
  precio: number;
  stock: number;
  status: string; // AVAILABLE | NO AVALIABLE
  image?: string; // base64
}

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="card max-w-3xl mx-auto">
    <h2 class="text-lg font-semibold mb-4">{{ model.id ? 'Editar' : 'Crear' }} producto</h2>
  <form (ngSubmit)="submit()" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-slate-600">Nombre</label>
          <input class="input" [(ngModel)]="model.nombre" name="nombre" required>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-slate-600">Categoría</label>
          <select class="input" [(ngModel)]="model.categoria" name="categoria" required>
            <option value="" disabled>Selecciona</option>
            <option *ngFor="let c of categorias" [value]="c.id">{{ c.nombre }}</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-slate-600">Precio</label>
          <input class="input" type="text" [(ngModel)]="precioView" (ngModelChange)="onPriceInputChange($event)" (blur)="onPriceBlur()" name="precio" required placeholder="0">
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-slate-600">Stock</label>
          <input class="input" type="number" [(ngModel)]="model.stock" name="stock" required min="0">
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-slate-600">Estado</label>
          <select class="input" [(ngModel)]="model.status" name="status" required>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="NO AVALIABLE">NO AVALIABLE</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-slate-600">Imagen</label>
          <input #fileInput class="hidden" type="file" accept="image/*" (change)="onFileChange($event)">
          <div
            class="border border-dashed rounded-lg p-4 bg-white hover:bg-slate-50 cursor-pointer transition flex items-center gap-4"
            [class.ring-2]="isDragging" [class.ring-blue-500]="isDragging"
            (click)="triggerFile(fileInput)"
            (keydown.enter)="triggerFile(fileInput)" (keydown.space)="triggerFile(fileInput)" tabindex="0"
            (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
            <div class="h-12 w-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 15.75V18a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-2.25M16.5 9 12 4.5 7.5 9M12 4.5V15" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="flex-1">
              <div class="text-sm text-slate-700" *ngIf="!model.image">Arrastra y suelta una imagen o <span class="text-blue-600 underline">haz clic para seleccionar</span></div>
              <div class="text-sm text-slate-700" *ngIf="model.image">Haz clic para reemplazar la imagen</div>
              <div class="text-xs text-slate-500">Se enviará como Base64 al guardar</div>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-1" *ngIf="model.image">
          <label class="text-xs text-slate-600">Vista previa</label>
          <div class="rounded-lg border bg-white p-2 inline-flex">
            <img [src]="imageSrc(model.image)" alt="preview" class="max-h-40 object-contain rounded" />
          </div>
          <div class="flex gap-2 mt-2">
            <button type="button" class="btn btn-outline" (click)="clearImage()">Quitar imagen</button>
            <button type="button" class="btn btn-outline" (click)="triggerFile(fileInput)">Cambiar</button>
          </div>
        </div>
      </div>
      <div class="flex flex-col md:flex-row gap-3 mt-2">
        <button type="submit" class="btn btn-primary md:w-auto w-full">{{ model.id ? 'Guardar cambios' : 'Crear producto' }}</button>
        <button type="button" class="btn btn-outline md:w-auto w-full" (click)="cancel.emit()">Cancelar</button>
      </div>
    </form>
  </div>
  `
})
export class ProductoFormComponent implements OnInit {
  @Input() model: ProductoFormModel = { id:0, nombre:'', categoria:'', precio:0, stock:0, status:'AVAILABLE', image: undefined };
  @Input() categorias: {id:number; nombre:string}[] = [];
  @Output() save = new EventEmitter<ProductoFormModel>();
  @Output() cancel = new EventEmitter<void>();
  precioView = '';

  ngOnInit(){
    this.precioView = this.model.precio ? this.formatPrice(this.model.precio) : '';
  }

  submit(){
    if(!this.model.nombre.trim()) return;
    this.save.emit(this.model);
  }

  onPriceInputChange(raw: string){
    // Formato ES: '.' miles, ',' decimales. Permitir escribir con puntos como miles y coma como decimal.
    if(raw == null) raw = '';
    // Mantener solo dígitos, puntos y comas
    let cleaned = raw.replace(/[^0-9.,]/g, '');
    // Separar por la primera coma como separador decimal; los puntos son miles
    const commaIndex = cleaned.indexOf(',');
    let intPartRaw = commaIndex >= 0 ? cleaned.substring(0, commaIndex) : cleaned;
    let decPartRaw = commaIndex >= 0 ? cleaned.substring(commaIndex + 1) : '';
    // Quitar puntos y cualquier otro no-dígito del entero
    const intDigits = intPartRaw.replace(/[^0-9]/g, '');
    const intNumber = intDigits ? parseInt(intDigits, 10) : 0;
    const formattedInt = intDigits ? new Intl.NumberFormat('es-ES').format(intNumber) : '';
    // Limitar decimales a 2, sólo dígitos
    let decPart = decPartRaw.replace(/[^0-9]/g, '');
    if(decPart.length > 2) decPart = decPart.substring(0,2);
    // Componer visual usando coma como decimal si hay parte decimal
    this.precioView = formattedInt + (commaIndex >= 0 && decPart.length > 0 ? ',' + decPart : (commaIndex >= 0 ? ',' : ''));
    // Valor numérico: usar punto para decimal en el número
    const numeric = decPart.length > 0 ? parseFloat(intNumber + '.' + decPart) : intNumber;
    this.model.precio = isNaN(numeric) ? 0 : numeric;
  }

  onPriceBlur(){
    const n = this.model.precio || 0;
    this.precioView = n ? this.formatPrice(n) : '';
  }

  // parsePrice no longer needed for real-time; retained if future reuse required
  private parsePrice(s: string): number { return this.model.precio; }

  private formatPrice(n: number): string {
    try {
      return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
    } catch {
      return n.toString();
    }
  }

  async onFileChange(evt: Event){
    const input = evt.target as HTMLInputElement;
    const file = input?.files?.[0];
    if(!file) return;
    const base64 = await this.readFileAsDataUrl(file);
    this.model.image = base64;
  }
  clearImage(){ this.model.image = undefined; }
  private readFileAsDataUrl(file: File){
    return new Promise<string>((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  imageSrc(img?: string){
    if(!img) return '';
    if(img.startsWith('data:')) return img;
    // fallback to jpeg when no mime provided
    return `data:image/jpeg;base64,${img}`;
  }
  isDragging = false;
  triggerFile(input: HTMLInputElement){ input.click(); }
  onDragOver(ev: DragEvent){ ev.preventDefault(); this.isDragging = true; }
  onDragLeave(ev: DragEvent){ ev.preventDefault(); this.isDragging = false; }
  async onDrop(ev: DragEvent){
    ev.preventDefault();
    this.isDragging = false;
    const file = ev.dataTransfer?.files?.[0];
    if(!file) return;
    if(!file.type.startsWith('image/')) return;
    const base64 = await this.readFileAsDataUrl(file);
    this.model.image = base64;
  }
}
