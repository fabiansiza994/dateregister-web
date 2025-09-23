import { ApplicationConfig, APP_INITIALIZER, importProvidersFrom, provideZonelessChangeDetection, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { ConfigService } from './core/config.service';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth.interceptor';

// Carga el JSON de configuración antes de bootstrap
export function loadAppConfig(http: HttpClient, cfg: ConfigService) {
  return () =>
    firstValueFrom(http.get('/assets/app-config.json'))
      .then(json => cfg.setConfig(json))
      .catch(() => cfg.setConfig({})); // fallback si no existe el archivo
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),

    // Necesario para poder hacer el GET del JSON
    importProvidersFrom(HttpClientModule),

    // Ejecuta la carga de config ANTES de iniciar la app
    {
      provide: APP_INITIALIZER,
      useFactory: loadAppConfig,
      deps: [HttpClient, ConfigService],
      multi: true
    }
  ]
};