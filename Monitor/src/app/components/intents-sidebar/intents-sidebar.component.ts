import { Component, Input } from '@angular/core';
import { CapturedIntent, IntentStatus } from '../../models/conversation.models';

/**
 * Barra lateral que muestra intenciones y entidades capturadas.
 */
@Component({
  selector: 'app-intents-sidebar',
  standalone: true,
  templateUrl: './intents-sidebar.component.html',
  styleUrl: './intents-sidebar.component.scss',
})
export class IntentsSidebarComponent {
  /**
   * Intenciones y entidades capturadas que se muestran en la barra lateral.
   */
  @Input({ required: true }) intents!: CapturedIntent[];

  /**
   * Traduce el estado interno a una etiqueta visible para la interfaz.
   */
  protected getStatusLabel(status: IntentStatus): string {
    switch (status) {
      case 'confirmed':
        return 'confirmado';
      case 'detected':
        return 'detectado';
      case 'pending':
        return 'pendiente';
    }
  }
}
