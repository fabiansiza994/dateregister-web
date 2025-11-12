import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductoFormComponent, ProductoFormModel } from './producto-form.component';
import { ProductService, ProductDTO } from '../core/product.service';
import { CategoryService } from '../core/category.service';

@Component({
  selector: 'app-producto-edit-page',
  standalone: true,
  imports: [CommonModule, ProductoFormComponent],
  template: `
  <div class="max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Editar producto</h2>
    </div>
    <ng-container *ngIf="loaded(); else loadingTpl">
      <app-producto-form [model]="model()" [categorias]="categorias()" (save)="save($event)" (cancel)="goBack()" />
      

    </ng-container>
    <ng-template #loadingTpl>
      <div class="text-xs text-center">Cargando...</div>
    </ng-template>
  </div>
  `
})
export class ProductoEditPage {
  categorias = signal<{id:number; nombre:string}[]>([]);
  model = signal<ProductoFormModel>({ id:0, nombre:'', categoria:'', precio:0, stock:0, status:'AVAILABLE', image: undefined });
  loaded = signal(false);
  private id: number = 0;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private categoryService: CategoryService,
    private router: Router
  ){
    this.init();
  }

  private async init(){
    this.id = Number(this.route.snapshot.paramMap.get('id')) || 0;
    const [cats, product] = await Promise.all([
      this.categoryService.list(),
      this.id ? this.productService.get(this.id) : Promise.resolve(null)
    ]);
    this.categorias.set(cats.map(c=> ({ id:c.id!, nombre:c.name })));
    if(product){
      this.model.set({
        id: product.id!,
        nombre: product.name,
        categoria: product.category?.id?.toString() || '',
        precio: product.price,
        stock: Number(product.quantity),
        status: product.status || 'AVAILABLE',
        image: product.image
      });
    }
    this.loaded.set(true);
  }

  async save(m: ProductoFormModel){
    const dto: ProductDTO = {
      id: m.id,
      name: m.nombre,
      description: '',
      price: m.precio,
      quantity: m.stock,
      category: { id: Number(m.categoria) || 1 },
      brand: '',
      status: m.status || 'AVAILABLE',
      image: this.sanitizeImage(m.image)
    };
    if(m.id){
      await this.productService.update(dto);
    }
    this.router.navigateByUrl('/productos');
  }

  async remove(){
    if(!this.model().id) return;
    await this.productService.remove(this.model().id!);
    this.router.navigateByUrl('/productos');
  }

  goBack(){ this.router.navigateByUrl('/productos'); }

  private sanitizeImage(img?: string){
    if(!img) return undefined;
    return img.startsWith('data:') ? img.split(',')[1] : img;
  }
}
