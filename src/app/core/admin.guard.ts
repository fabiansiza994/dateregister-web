import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const AdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLogged()) {
    router.navigateByUrl('/login');
    return false;
  }
  if (auth.role() !== 'ADMIN') {
    router.navigateByUrl('/productos');
    return false;
  }
  return true;
};
