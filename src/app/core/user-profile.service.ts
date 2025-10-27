import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from '../core/config.service';
import { AuthService } from '../core/auth.service';

interface ApiOk<T = any> {
  dataResponse?: { idTx?: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: T;
  message?: string;
  error?: Array<{ msgError?: string; descError?: string }>;
}

export interface UserProfile {
  id: number;
  nombre?: string;
  apellido?: string;
  usuario: string;
  email?: string;
  intentosFallidos?: number;
  bloqueado?: boolean;
  rol?: { id: number; nombre: string } | null;
  grupo?: { id: number; nombre: string } | null;
  empresa?: { 
    id: number; 
    nombre: string; 
    sectorNombre?: string; 
    paisNombre?: string; 
  } | null;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private profile = signal<UserProfile | null>(null);
  private loaded = signal(false);
  private loading = signal(false);

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private auth: AuthService
  ) {}

  async getProfile(): Promise<UserProfile | null> {
    if (this.loaded() && this.profile()) {
      return this.profile();
    }

    if (this.loading()) {
      // Si ya está cargando, esperar un poco y reintentar
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getProfile();
    }

    return await this.loadProfile();
  }

  private async loadProfile(): Promise<UserProfile | null> {
    this.loading.set(true);

    try {
      // Obtener ID del usuario desde los claims
      const claims = this.auth.claims();
      if (!claims) throw new Error('Usuario no autenticado');

      const userId = claims.userId || claims['id'] || claims['uid'] || claims['usuarioId'];
      if (!userId) throw new Error('No se pudo obtener el ID del usuario');

      const apiBase = this.config.get('apiBaseUrl', 'http://localhost:8081');
      const url = `${apiBase}/user/profile/${userId}`;

      const response = await firstValueFrom(
        this.http.get<ApiOk<UserProfile>>(url).pipe(timeout(12000))
      );

      if (response?.dataResponse?.response === 'ERROR') {
        const errorMsg = response?.error?.map(x => x?.msgError || x?.descError)?.filter(Boolean)?.join(' | ');
        throw new Error(errorMsg || response?.message || 'Error al cargar perfil');
      }

      const userProfile = response?.data;
      if (!userProfile) throw new Error('Respuesta sin datos');

      this.profile.set(userProfile);
      this.loaded.set(true);
      return userProfile;

    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  // Método para obtener solo el email
  async getUserEmail(): Promise<string> {
    const profile = await this.getProfile();
    if (profile?.email) {
      return profile.email;
    }

    // Fallback: generar email basado en username + empresa
    const claims = this.auth.claims();
    if (!claims) return '';

    const username = claims.sub || claims['usuario'] || '';
    if (username.includes('@')) {
      return username; // Ya es un email
    }

    // Generar email basado en empresa y username
    const empresa = profile?.empresa?.nombre || claims.empresa || 'dataregister';
    const empresaSlug = empresa.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    return `${username}@${empresaSlug}.com`;
  }

  // Método para forzar recarga del perfil
  async refreshProfile(): Promise<UserProfile | null> {
    this.loaded.set(false);
    this.profile.set(null);
    return await this.loadProfile();
  }

  // Getter para el estado de carga
  isLoading(): boolean {
    return this.loading();
  }

  // Getter para el perfil actual (sin cargar)
  getCurrentProfile(): UserProfile | null {
    return this.profile();
  }
}