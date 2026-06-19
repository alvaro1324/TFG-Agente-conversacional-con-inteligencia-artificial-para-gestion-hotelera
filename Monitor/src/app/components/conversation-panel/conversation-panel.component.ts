import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import {
  ConversationMessage,
  RawConversationDetail,
  SystemMessageVariant,
} from '../../models/conversation.models';

/**
 * Panel principal que renderiza la conversación y el payload del mensaje
 * seleccionado.
 */
@Component({
  selector: 'app-conversation-panel',
  standalone: true,
  templateUrl: './conversation-panel.component.html',
  styleUrl: './conversation-panel.component.scss',
})
export class ConversationPanelComponent implements AfterViewInit, OnChanges {
  /**
   * Número del cliente asociado a la conversación actual.
   */
  @Input({ required: true }) customerPhone!: string;

  /**
   * Nombre del servicio o agente que atiende la conversación.
   */
  @Input({ required: true }) serviceName!: string;

  /**
   * Estado visual de la conversación actual.
   */
  @Input() conversationViewState: 'idle' | 'live' | 'mock' = 'idle';

  /**
   * Lista de mensajes visibles en el panel de conversación.
   */
  @Input({ required: true }) conversation!: ConversationMessage[];

  /**
   * Identificador del mensaje actualmente seleccionado.
   */
  @Input() selectedMessageId: number | null = null;

  /**
   * Payload bruto asociado al mensaje seleccionado.
   */
  @Input() selectedRawDetail: RawConversationDetail | null = null;

  @ViewChild('chatThread') private chatThreadRef?: ElementRef<HTMLDivElement>;
  private previousConversationLength = 0;

  /**
   * Emite el identificador del mensaje seleccionado por el usuario.
   */
  @Output() selectMessage = new EventEmitter<number>();

  /**
   * Solicita el cierre del panel de payload.
   */
  @Output() clearSelection = new EventEmitter<void>();

  ngAfterViewInit(): void {
    this.scrollToLatestMessage();
  }

  /**
   * Indica si un mensaje de sistema representa una acción explícita.
   *
   * @param text Texto del mensaje de sistema.
   * @returns `true` cuando el mensaje comienza por `ACTION:`.
   */
  protected isSystemAction(text: string): boolean {
    return text.startsWith('ACTION:');
  }

  /**
   * Devuelve la variante visual del mensaje de sistema.
   *
   * @param message Mensaje de sistema a representar.
   * @returns Variante visual a aplicar en el chip.
   */
  protected getSystemVariant(message: ConversationMessage): SystemMessageVariant {
    if (message.systemVariant) {
      return message.systemVariant;
    }

    return this.isSystemAction(message.text) ? 'action' : 'default';
  }

  /**
   * Etiqueta visible del estado de conversación actual.
   *
   * @returns Texto a mostrar en el badge de estado.
   */
  protected get statusLabel(): string {
    switch (this.conversationViewState) {
      case 'live':
        return 'Activa';
      case 'mock':
        return 'Mock';
      default:
        return 'En espera';
    }
  }

  /**
   * Mantiene visible el último mensaje cuando aumenta la conversación.
   */
  ngOnChanges(): void {
    if (this.conversation.length <= this.previousConversationLength) {
      this.previousConversationLength = this.conversation.length;
      return;
    }

    this.previousConversationLength = this.conversation.length;
    queueMicrotask(() => this.scrollToLatestMessage());
  }

  /**
   * Desplaza el contenedor del chat hasta el final.
   */
  private scrollToLatestMessage(): void {
    const chatThread = this.chatThreadRef?.nativeElement;

    if (!chatThread) {
      return;
    }

    chatThread.scrollTop = chatThread.scrollHeight;
  }
}
