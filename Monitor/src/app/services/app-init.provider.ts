import { provideAppInitializer, inject } from '@angular/core';

import { AppInitService } from './app-init.service';

/**
 * Registra la inicialización del websocket en el arranque de Angular.
 *
 * @returns Provider que ejecuta {@link AppInitService.init} antes de que la
 * aplicación quede lista.
 */
export const provideWsAppInit = () =>
  provideAppInitializer(() => inject(AppInitService).init());
