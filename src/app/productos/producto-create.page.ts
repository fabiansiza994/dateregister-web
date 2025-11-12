import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProductoFormComponent, ProductoFormModel } from './producto-form.component';
import { ProductService } from '../core/product.service';
import { CategoryService } from '../core/category.service';

@Component({
  selector: 'app-producto-create-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductoFormComponent],
  template: `
  <div class="max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Nuevo producto</h2>
      <a routerLink="/productos" class="btn btn-outline">Volver</a>
    </div>
    <app-producto-form [model]="model()" [categorias]="categorias()" (save)="save($event)" (cancel)="goBack()" />
  </div>
  `
})
export class ProductoCreatePage {
  categorias = signal<{id:number; nombre:string}[]>([]);
  model = signal<ProductoFormModel>({ id:0, nombre:'', categoria:'', precio:0, stock:0, status:'AVAILABLE', image: undefined });

  constructor(private productService: ProductService, private categoryService: CategoryService, private router: Router){
    this.init();
  }

  private async init(){
    const cats = await this.categoryService.list();
    this.categorias.set(cats.map(c=> ({ id:c.id!, nombre:c.name })));
  }

  async save(m: ProductoFormModel){
    const created = await this.productService.create({
      name: m.nombre,
      description: '',
      price: m.precio,
      quantity: m.stock,
      category: { id: Number(m.categoria) || 1 },
      brand: '',
      status: m.status || 'AVAILABLE',
      image: this.sanitizeImage(m.image)
    });
    if(created){ this.router.navigateByUrl('/productos'); }
  }

  private sanitizeImage(img?: string){
    if(!img) return undefined;
    return img.startsWith('data:') ? img.split(',')[1] : img;
  }

  goBack(){ this.router.navigateByUrl('/productos'); }
}
