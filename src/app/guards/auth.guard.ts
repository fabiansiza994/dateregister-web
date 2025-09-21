import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  const token = localStorage.getItem('token');

  if (token) {
    return true; // ✅ tiene token, puede entrar
  } else {
    // ❌ no tiene token, redirige a login
    router.navigate(['/login']);
    return false;
  }
};