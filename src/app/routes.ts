import { Routes } from '@angular/router';
// Type-only imports to help TS module resolution for lazy pages
// Removed problematic type-only imports; dynamic imports provide types implicitly
import { LoginComponent } from './auth/login.component';
import { RoleGuard } from './core/role.guard';

export const APP_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivate: [RoleGuard],
    children: [
      { path: '', redirectTo: 'productos', pathMatch: 'full' },
      {
        path: 'productos',
        loadComponent: () => import('./productos/productos.component').then(m => m.ProductosComponent)
      },
      {
        path: 'productos/nuevo',
        loadComponent: () => import('./productos/producto-create.page').then(m => m.ProductoCreatePage)
      },
      {
        path: 'productos/:id/editar',
        loadComponent: () => import('./productos/producto-edit.page').then(m => m.ProductoEditPage)
      },
      {
        path: 'categorias',
        loadComponent: () => import('./categorias/categorias.component').then(m => m.CategoriasComponent)
      },
      {
        path: 'categorias/nueva',
        loadComponent: () => import('./categorias/categoria-create.page').then(m => m.CategoriaCreatePage)
      },
      {
        path: 'categorias/:id/editar',
        loadComponent: () => import('./categorias/categoria-edit.page').then(m => m.CategoriaEditPage)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./clientes/clientes.component').then(m => m.ClientesComponent)
      },
      {
        path: 'clientes/nuevo',
        loadComponent: () => import('./clientes/cliente-create.page').then(m => m.ClienteCreatePage)
      },
      {
        path: 'clientes/:id/editar',
        loadComponent: () => import('./clientes/cliente-edit.page').then(m => m.ClienteEditPage)
      },
      {
        path: 'ventas',
        loadComponent: () => import('./ventas/ventas.component').then(m => m.VentasComponent)
      },
      {
        path: 'ventas/historial',
        loadComponent: () => import('./ventas/historial-ventas.component').then(m => m.HistorialVentasComponent)
      },
      {
        path: 'ventas/:id',
        loadComponent: () => import('./ventas/venta-detail.page').then(m => m.VentaDetailPage)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
