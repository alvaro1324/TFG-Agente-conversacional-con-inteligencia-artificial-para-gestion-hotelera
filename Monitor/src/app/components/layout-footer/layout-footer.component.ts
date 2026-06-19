import { Component, Input } from '@angular/core';

/**
 * Pie de página del dashboard con contexto del servicio y del cliente.
 */
@Component({
  selector: 'app-layout-footer',
  standalone: true,
  templateUrl: './layout-footer.component.html',
  styleUrl: './layout-footer.component.scss',
})
export class LayoutFooterComponent {
  /**
   * Título del Trabajo Fin de Grado mostrado en el pie.
   */
  @Input({ required: true }) projectTitle!: string;

  /**
   * Autor del Trabajo Fin de Grado mostrado en el pie.
   */
  @Input({ required: true }) author!: string;

  /**
   * Fecha actual formateada para el pie de página.
   */
  protected readonly currentDate = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}
