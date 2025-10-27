import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8 text-center">
        <div>
          <div class="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-red-100">
            <i class="bi bi-shield-exclamation text-red-600 text-3xl"></i>
          </div>
          <h2 class="mt-6 text-3xl font-extrabold text-gray-900">
            Acceso Restringido
          </h2>
          <p class="mt-2 text-sm text-gray-600">
            No tienes permisos para acceder a esta sección
          </p>
        </div>
        
        <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <i class="bi bi-exclamation-triangle text-yellow-400 text-lg"></i>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">
                Solo para administradores
              </h3>
              <div class="mt-2 text-sm text-yellow-700">
                <p>Esta función está disponible únicamente para usuarios con rol de administrador. Si necesitas acceso, contacta a tu administrador del sistema.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <a routerLink="/modules" 
             class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
            <i class="bi bi-house-door mr-2"></i>
            Volver al inicio
          </a>
          
          <a routerLink="/perfil" 
             class="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
            <i class="bi bi-person mr-2"></i>
            Mi perfil
          </a>
        </div>
      </div>
    </div>
  `
})
export class UnauthorizedComponent {}