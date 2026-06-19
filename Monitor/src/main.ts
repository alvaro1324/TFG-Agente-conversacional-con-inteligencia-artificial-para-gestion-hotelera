import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/**
 * Punto de entrada principal de la aplicación Angular.
 *
 * Arranca el componente raiz con la configuración global registrada en
 * {@link appConfig}.
 */
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
