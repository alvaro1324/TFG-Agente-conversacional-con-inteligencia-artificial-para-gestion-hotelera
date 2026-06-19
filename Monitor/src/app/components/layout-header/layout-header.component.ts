import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ThemeMode } from '../../models/conversation.models';

/**
 * Cabecera del dashboard con controles de tema.
 */
@Component({
  selector: 'app-layout-header',
  standalone: true,
  templateUrl: './layout-header.component.html',
  styleUrl: './layout-header.component.scss',
})
export class LayoutHeaderComponent {
  /**
   * Tema visual actualmente activo en la aplicación.
   */
  @Input({ required: true }) theme!: ThemeMode;
  @Input() defaultPhoneNumbers: string[] = [];
  @Input() defaultServiceNumbers: string[] = [];
  @Input() runtimePhoneNumbers: string[] = [];
  @Input() runtimeServiceNumbers: string[] = [];
  @Input() isMockConversationLoaded = false;
  @Input() showMock = false;

  /**
   * Evento emitido cuando el usuario solicita alternar el tema.
   */
  @Output() toggleTheme = new EventEmitter<void>();

  /**
   * Evento emitido al solicitar el alta temporal de un numero de cliente.
   */
  @Output() addPhoneNumber = new EventEmitter<string>();

  /**
   * Evento emitido al solicitar el alta temporal de un numero de servicio.
   */
  @Output() addServiceNumber = new EventEmitter<string>();

  /**
   * Evento emitido para limpiar los filtros anadidos en tiempo de ejecucion.
   */
  @Output() resetRuntimeFilters = new EventEmitter<void>();
  @Output() removePhoneNumber = new EventEmitter<string>();
  @Output() removeServiceNumber = new EventEmitter<string>();
  @Output() loadMockConversation = new EventEmitter<void>();
  @Output() clearConversation = new EventEmitter<void>();

  /**
   * Indica si el panel de filtros temporales esta desplegado.
   */
  protected showRuntimeFilters = false;

  /**
   * Alterna la visibilidad del panel de filtros temporales.
   */
  protected toggleRuntimeFilters(): void {
    this.showRuntimeFilters = !this.showRuntimeFilters;
  }

  /**
   * Emite un numero de cliente adicional y limpia el campo de entrada.
   *
   * @param value Valor introducido por el usuario.
   * @param input Referencia al campo para poder vaciarlo.
   */
  protected submitPhoneNumber(value: string, input: HTMLInputElement): void {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return;
    }

    this.addPhoneNumber.emit(normalizedValue);
    input.value = '';
  }

  /**
   * Emite un numero de servicio adicional y limpia el campo de entrada.
   *
   * @param value Valor introducido por el usuario.
   * @param input Referencia al campo para poder vaciarlo.
   */
  protected submitServiceNumber(value: string, input: HTMLInputElement): void {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return;
    }

    this.addServiceNumber.emit(normalizedValue);
    input.value = '';
  }
}
