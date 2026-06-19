import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideWsAppInit } from './services/app-init.provider';

/**
 * Configuración raíz de Angular para la aplicación.
 *
 * Registra el cliente HTTP, optimizaciones de zonas y la inicialización
 * temprana del canal websocket.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideWsAppInit(),
  ]
};
