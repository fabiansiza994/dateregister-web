import 'zone.js'; // Necesario para Angular (polyfill de Zone) si no se configuró en angular.json
// Zone.js is required for certain Angular runtime injection/change-detection features
// If you prefer not to use zone.js, the app must be adapted accordingly. Importing here
// ensures the global patching happens before Angular bootstraps.
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/root.component';
import { APP_ROUTES } from './app/routes';
import { authInterceptor } from './app/core/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
}).catch(err => console.error(err));
