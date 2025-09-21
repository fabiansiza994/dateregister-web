import { Routes } from '@angular/router';
import { Login } from './login/login';

export const routes: Routes = [
 { path: 'login', loadComponent: () => import('./login/login').then(m => m.Login) },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' }
];
