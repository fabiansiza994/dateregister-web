import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { Layout } from './layout/layout';

export const routes: Routes = [
  // Ruta pública
  { path: 'login', loadComponent: () => import('./login/login').then(m => m.Login) },
  { path: 'register', loadComponent: () => import('./register/register').then(m => m.Register) },
  { path: 'verify/:userId', loadComponent: () => import('./verifycode/verifycode').then(m => m.VerifyCodeComponent) },
  { path: 'mapa-uso', loadComponent: () => import('./usage-map/usage-map').then(m => m.UsageMap) },

  // Grupo protegido por el layout + guard
  {
    path: '',
    component: Layout,           // ⬅️ layout global
    canActivate: [authGuard],    // ⬅️ protege todo lo de adentro
    children: [
      { path: 'clientes', loadComponent: () => import('./cliente/cliente').then(m => m.ClientesComponent) },
      { path: 'pacientes', loadComponent: () => import('./pacientes/pacientes').then(m => m.Pacientes) },
      { path: 'pacientes/nuevo', loadComponent: () => import('./pacientes/paciente-nuevo').then(m => m.PacienteNuevoComponent) },
      { path: 'pacientes/:id', loadComponent: () => import('./pacientes/paciente-detalle').then(m => m.PacienteDetalleComponent) },
      { path: 'pacientes/:id/editar', loadComponent: () => import('./pacientes/paciente-editar').then(m => m.PacienteEditarComponent) },

      { path: 'clientes/nuevo', loadComponent: () => import('./cliente/cliente-nuevo').then(m => m.ClienteNuevoComponent) },
      { path: 'modules', loadComponent: () => import('./modules/modules').then(m => m.Modules) },
      { path: 'clientes/:id/editar', loadComponent: () => import('./cliente/cliente-editar').then(m => m.ClienteEditarComponent) },
      { path: 'clientes/:id', loadComponent: () => import('./cliente/cliente-detalle.component').then(m => m.ClienteDetalleComponent) },

      // dentro de children (mantén este orden)
      { path: 'trabajos', loadComponent: () => import('./trabajos/trabajos').then(m => m.JobsComponent) },
      { path: 'trabajos/nuevo', loadComponent: () => import('./trabajos/create-job.component').then(m => m.CreateJobComponent) },
      { path: 'trabajos/:id', loadComponent: () => import('./trabajos/job-detail.component').then(m => m.JobDetailComponent) },
      { path: 'trabajos/:id/editar', loadComponent: () => import('./trabajos/create-job.component').then(m => m.CreateJobComponent) },
      { path: 'usuarios/nuevo', loadComponent: () => import('./usuarios/usuario-nuevo').then(m => m.UsuarioNuevoComponent) },
      // app.routes.ts (dentro de children protegidas)
      { path: 'usuarios', loadComponent: () => import('./usuarios/usuarios').then(m => m.UsuariosComponent) },

      { path: 'formas-pago', loadComponent: () => import('./method-of-payment/method-of-payment').then(m => m.MethodOfPaymentComponent) },
      { path: 'grupos', loadComponent: () => import('./grupos/grupos').then(m => m.GruposComponent) },
      { path: 'reportes', loadComponent: () => import('./reportes-component/reportes-component').then(m => m.ReportesComponent) },
      { path: 'perfil', loadComponent: () => import('./perfil/perfil').then(m => m.PerfilComponent) },
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
