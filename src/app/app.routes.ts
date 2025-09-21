import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard'; 
import { Layout } from './layout/layout';

export const routes: Routes = [
  // Ruta pública
  { path: 'login', loadComponent: () => import('./login/login').then(m => m.Login) },
  { path: 'register', loadComponent: () => import('./register/register').then(m => m.Register) }, 
  // Grupo protegido por el layout + guard
  {
    path: '',
    component: Layout,           // ⬅️ layout global
    canActivate: [authGuard],    // ⬅️ protege todo lo de adentro
    children: [
      { path: 'modules', loadComponent: () => import('./modules/modules').then(m => m.Modules) },
      // Si luego creas estas páginas:
      // { path: 'clientes', loadComponent: () => import('./clientes/clientes').then(m => m.Clientes) },
      // { path: 'trabajos', loadComponent: () => import('./trabajos/trabajos').then(m => m.Trabajos) },
      // { path: 'reportes', loadComponent: () => import('./reportes/reportes').then(m => m.Reportes) },
      { path: '', pathMatch: 'full', redirectTo: 'modules' }
    ]
  },

  // Cualquier otra cosa → login
  { path: '**', redirectTo: 'login' }
];
