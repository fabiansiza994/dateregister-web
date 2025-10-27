import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // Primero verificar si está autenticado
  const token = localStorage.getItem('token');
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  // Obtener los claims del usuario
  const claims = authService.claims();
  
  // Verificar si tiene rol de administrador
  const userRole = (claims?.role || '').toUpperCase();
  
  if (userRole === 'ADMIN') {
    return true; // ✅ es admin, puede acceder
  } else {
    // ❌ no es admin, redirigir a página de acceso no autorizado
    router.navigate(['/unauthorized']);
    return false;
  }
};