import { Component, computed } from '@angular/core';
import { ConversationPanelComponent } from './components/conversation-panel/conversation-panel.component';
import { IntentsSidebarComponent } from './components/intents-sidebar/intents-sidebar.component';
import { LayoutFooterComponent } from './components/layout-footer/layout-footer.component';
import { LayoutHeaderComponent } from './components/layout-header/layout-header.component';
import { RawConversationDetail, ThemeMode } from './models/conversation.models';
import { LiveConversationService } from './services/live-conversation.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    LayoutHeaderComponent,
    ConversationPanelComponent,
    IntentsSidebarComponent,
    LayoutFooterComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
/**
 * Componente principal del dashboard de monitorización conversacional.
 */
export class AppComponent {
  constructor(private readonly liveConversationService: LiveConversationService) { }

  /**
   * Tema activo del dashboard.
   */
  protected theme: ThemeMode = 'light';
  protected readonly showMock = environment.showMock;
  protected readonly projectTitle = 'Agente conversacional con inteligencia artificial para la gestión hotelera';
  protected readonly author = 'Álvaro';

  /**
   * Identificador del mensaje seleccionado en la conversación.
   */
  protected selectedMessageId: number | null = null;

  protected readonly defaultPhoneNumbers = computed(() => this.liveConversationService.defaultPhoneNumbers());
  protected readonly defaultServiceNumbers = computed(() => this.liveConversationService.defaultServiceNumbers());
  protected readonly runtimePhoneNumbers = computed(() => this.liveConversationService.runtimePhoneNumbers());
  protected readonly runtimeServiceNumbers = computed(() => this.liveConversationService.runtimeServiceNumbers());
  protected readonly isMockConversationLoaded = computed(() => this.liveConversationService.isMockConversationLoaded());
  protected readonly customerPhone = computed(() => this.liveConversationService.currentCustomerPhone());
  protected readonly serviceName = computed(() => this.liveConversationService.currentServiceName());
  protected readonly conversationViewState = computed(() => this.liveConversationService.conversationViewState());
  protected readonly rawDetails = computed(() => this.liveConversationService.rawDetails());
  protected readonly intents = computed(() => this.liveConversationService.capturedIntents());

  /**
   * Conversación reactiva procedente del servicio en tiempo real.
   */
  protected readonly conversation = computed(() => this.liveConversationService.messages());

  /**
   * Devuelve el payload raw asociado al mensaje seleccionado.
   */
  protected get selectedRawDetail(): RawConversationDetail | null {
    if (this.selectedMessageId === null) {
      return null;
    }

    return this.rawDetails().find((detail) => detail.messageId === this.selectedMessageId) ?? null;
  }

  /**
   * Limpia la selección actual del panel de payload.
   */
  protected clearSelection(): void {
    this.selectedMessageId = null;
  }

  /**
   * Alterna la selección de un mensaje concreto.
   *
   * @param messageId Identificador del mensaje pulsado.
   */
  protected selectMessage(messageId: number): void {
    this.selectedMessageId = this.selectedMessageId === messageId ? null : messageId;
  }

  /**
   * Alterna entre tema claro y oscuro.
   */
  protected toggleTheme(): void {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
  }

  /**
   * Añade un numero de cliente temporal a la whitelist de pruebas.
   *
   * @param phoneNumber Numero de cliente introducido por el usuario.
   */
  protected addPhoneNumber(phoneNumber: string): void {
    this.liveConversationService.addAllowedPhoneNumber(phoneNumber);
  }

  /**
   * Añade un numero de servicio temporal a la whitelist de pruebas.
   *
   * @param serviceNumber Numero de servicio introducido por el usuario.
   */
  protected addServiceNumber(serviceNumber: string): void {
    this.liveConversationService.addAllowedServiceNumber(serviceNumber);
  }

  /**
   * Elimina un numero de cliente temporal de la whitelist de pruebas.
   *
   * @param phoneNumber Numero de cliente a eliminar.
   */
  protected removePhoneNumber(phoneNumber: string): void {
    this.liveConversationService.removeAllowedPhoneNumber(phoneNumber);
  }

  /**
   * Elimina un numero de servicio temporal de la whitelist de pruebas.
   *
   * @param serviceNumber Numero de servicio a eliminar.
   */
  protected removeServiceNumber(serviceNumber: string): void {
    this.liveConversationService.removeAllowedServiceNumber(serviceNumber);
  }

  /**
   * Limpia todos los filtros temporales anadidos en tiempo de ejecucion.
   */
  protected resetRuntimeFilters(): void {
    this.liveConversationService.resetRuntimeFilters();
  }

  /**
   * Carga manualmente la conversación mock para pruebas.
   */
  protected loadMockConversation(): void {
    if (!this.showMock) {
      return;
    }

    this.selectedMessageId = null;
    this.liveConversationService.loadMockConversation();
  }

  /**
   * Limpia la conversación actual y sale del modo mock manual.
   */
  protected clearConversation(): void {
    if (!this.showMock) {
      return;
    }

    this.selectedMessageId = null;
    this.liveConversationService.clearConversation();
  }
}
