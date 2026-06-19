import { Injectable, OnDestroy, signal } from '@angular/core';
import { EMPTY, Subscription, catchError, switchMap, timer } from 'rxjs';

import { CAPTURED_INTENTS_FROM_PAYLOAD, CONVERSATION_MESSAGES, CUSTOMER_PHONE, RAW_DETAILS, SERVICE_NAME } from '../data/dashboard.mock';
import { CapturePayload, CapturedIntent, ConversationMessage, MessageRole, RawConversationDetail } from '../models/conversation.models';
import { environment } from '../../environments/environment';
import { CapturedEntitiesApiService } from './captured-entities-api.service';
import { RealtimeSocketService } from './realtime-socket.service';

type SessionStatus = 'idle' | 'init' | 'end';
type ConversationViewState = 'idle' | 'live' | 'mock';
type MessageStatus = 'info' | 'warning' | 'error' | undefined;

interface IvrCallEventData {
  confid: string;
  event: string;
  direction: string;
  dialog_started: string | number;
  service_id?: string | number | null;
  service_number?: string | null;
  anumber?: string | null;
}

interface IvrCallEvent {
  data: IvrCallEventData;
}

interface ProcessEventParsed {
  ani: string;
  confid: string;
  serviceId: number | null;
  serviceNumber: string;
  serviceName: string;
  interactionCount: number | null;
  interactionEpoch: number | null;
  transcriptionEpoch: number | null;
  transcriptionResult: string;
  transcriptionText: string;
  transcriptionTimestamp: Date | null;
  agentRequestEpoch: number | null;
  agentRequestTimestamp: Date | null;
  agentResult: string;
  agentError: string;
  agentAction: string;
  agentResponse: string;
  destinationName: string;
  turn: string;
  result: string;
  helpMessage: string;
  agentErrorMessage: string;
}

interface ProcessEventRaw {
  [key: string]: unknown;
}

/**
 * Servicio que coordina la sesión activa de conversación y transforma los
 * eventos `ivr` y `ai_agent` en mensajes listos para la UI.
 */
@Injectable({ providedIn: 'root' })
export class LiveConversationService implements OnDestroy {
  /**
   * Saludo fijo que se inserta al comenzar una llamada `ivr init`.
   *
   * Se muestra como primer mensaje del agente tras el aviso de sistema
   * `Iniciando la llamada`.
   */
  private readonly initialAgentGreeting =
    // REDACTADO: aqui iria el saludo real del agente, incluido el nombre comercial del servicio si aplica.
    'Bienvenido al sistema inteligente de reservas. ¿Desea realizar una nueva reserva o consultar una existente?';
  private readonly systemResults = new Set<string>([
    'HANGUP',
    'NOMATCH_RETRY',
    'NOMATCH_RUNOUT',
    'NOINPUT_RETRY',
    'NOINPUT_RUNOUT',
    'AGENT_TIMEOUT_RETRY',
    'AGENT_TIMEOUT_RUNOUT',
    'AGENT_TIMEOUT_EXIT',
    'AGENT_KO_RETRY',
    'AGENT_KO_RUNOUT',
    'AGENT_KO_EXIT',
    'AGENT_OK_ACTION',
    'FIRST_INTERACTION',
  ]);

  private readonly ignoreResults = new Set<string>(['HANGUP']);
  private readonly noInputResults = new Set<string>(['NOMATCH_RETRY', 'NOINPUT_RETRY']);
  private readonly noInputErrorResults = new Set<string>(['NOMATCH_RUNOUT', 'NOINPUT_RUNOUT']);

  private readonly systemStatus: Record<string, Exclude<MessageStatus, undefined>> = {
    NOMATCH_RETRY: 'warning',
    NOMATCH_RUNOUT: 'error',
    NOINPUT_RETRY: 'warning',
    NOINPUT_RUNOUT: 'error',
    AGENT_TIMEOUT_RETRY: 'warning',
    AGENT_TIMEOUT_RUNOUT: 'error',
    AGENT_TIMEOUT_EXIT: 'error',
    AGENT_KO_RETRY: 'warning',
    AGENT_KO_RUNOUT: 'error',
    AGENT_KO_EXIT: 'error',
    AGENT_OK_ACTION: 'info',
  };

  private readonly fieldTypes: Record<string, 'number' | 'date'> = {
    service_id: 'number',
    interaction_count: 'number',
    interaction_epoch: 'number',
    transcription_epoch: 'number',
    agent_request_epoch: 'number',
    transcription_timestamp: 'date',
    agent_request_timestamp: 'date',
  };

  private readonly keyMap: Record<string, keyof ProcessEventParsed> = {
    ani: 'ani',
    confid: 'confid',
    service_id: 'serviceId',
    service_number: 'serviceNumber',
    service_name: 'serviceName',
    interaction_count: 'interactionCount',
    interaction_epoch: 'interactionEpoch',
    transcription_epoch: 'transcriptionEpoch',
    transcription_result: 'transcriptionResult',
    transcription_text: 'transcriptionText',
    transcription_timestamp: 'transcriptionTimestamp',
    agent_request_epoch: 'agentRequestEpoch',
    agent_request_timestamp: 'agentRequestTimestamp',
    agent_result: 'agentResult',
    agent_error: 'agentError',
    agent_action: 'agentAction',
    agent_response: 'agentResponse',
    destination_name: 'destinationName',
    turn: 'turn',
    result: 'result',
    help_message: 'helpMessage',
    agent_error_message: 'agentErrorMessage',
  };

  private readonly defaultAllowedPhoneNumbers = new Set<string>([this.normalizePhone(CUSTOMER_PHONE)]);
  private readonly defaultAllowedServiceNumbers = new Set<string>(this.extractDefaultServiceNumbers());
  private readonly extraAllowedPhoneNumbers = new Set<string>();
  private readonly extraAllowedServiceNumbers = new Set<string>();

  /**
   * Intervalo del polling live de entidades capturadas.
   *
   * Se toma desde `environment.capturedEntitiesPollingIntervalMs` para poder
   * ajustarlo por entorno sin tocar la lógica del servicio.
   */
  private readonly capturedEntitiesPollingIntervalMs = environment.capturedEntitiesPollingIntervalMs;

  private readonly seenIds = new Set<string>();
  private nextId = 1;
  private activeConfid: string | null = null;
  private sessionStatus: SessionStatus = 'idle';
  private capturedEntitiesPollingSubscription: Subscription | null = null;

  readonly messages = signal<ConversationMessage[]>([]);
  readonly isMockConversationLoaded = signal(false);
  readonly currentCustomerPhone = signal(CUSTOMER_PHONE);
  readonly currentServiceName = signal(SERVICE_NAME);
  readonly conversationViewState = signal<ConversationViewState>('idle');
  readonly defaultPhoneNumbers = signal<string[]>([...this.defaultAllowedPhoneNumbers]);
  readonly defaultServiceNumbers = signal<string[]>([...this.defaultAllowedServiceNumbers]);
  readonly runtimePhoneNumbers = signal<string[]>([]);
  readonly runtimeServiceNumbers = signal<string[]>([]);

  /**
   * Payloads raw asociados a cada mensaje visible, tanto en modo mock como en
   * conversación live.
   */
  readonly rawDetails = signal<RawConversationDetail[]>([]);

  /**
   * Intenciones y entidades capturadas visibles en la barra lateral.
   *
   * En live se alimentan desde el polling del endpoint agregado y se filtran
   * automáticamente los campos nulos o vacíos.
   */
  readonly capturedIntents = signal<CapturedIntent[]>([]);

  constructor(
    private readonly realtimeSocketService: RealtimeSocketService,
    private readonly capturedEntitiesApiService: CapturedEntitiesApiService,
  ) {
    this.realtimeSocketService.listen<IvrCallEvent>('ivr').subscribe({
      next: (event) => this.handleIvrEvent(event),
      error: (error) => console.error('No se pudo escuchar el stream IVR', error),
    });

    this.realtimeSocketService.listen<unknown>('ai_agent').subscribe({
      next: (event) => this.handleAiAgentEvent(event),
      error: (error) => console.error('No se pudo escuchar el stream ai_agent', error),
    });
  }

  ngOnDestroy(): void {
    this.stopCapturedEntitiesPolling();
  }

  /**
   * Añade en memoria un número de teléfono permitido para iniciar pruebas.
   *
   * El valor solo vive durante la sesión actual y se combina con los teléfonos
   * por defecto extraídos del mock.
   *
   * @param phoneNumber Número a permitir temporalmente.
   */
  addAllowedPhoneNumber(phoneNumber: string): void {
    const normalizedPhone = this.normalizePhone(phoneNumber);

    if (normalizedPhone) {
      this.extraAllowedPhoneNumbers.add(normalizedPhone);
      this.runtimePhoneNumbers.set([...this.extraAllowedPhoneNumbers]);
    }
  }

  /**
   * Añade en memoria un número de servicio permitido para pruebas.
   *
   * @param serviceNumber Número de servicio a aceptar durante la sesión actual.
   */
  addAllowedServiceNumber(serviceNumber: string): void {
    const normalizedServiceNumber = this.normalizeDigits(serviceNumber);

    if (normalizedServiceNumber) {
      this.extraAllowedServiceNumbers.add(normalizedServiceNumber);
      this.runtimeServiceNumbers.set([...this.extraAllowedServiceNumbers]);
    }
  }

  /**
   * Elimina un numero de cliente anadido en tiempo de ejecucion.
   *
   * @param phoneNumber Numero de cliente a retirar.
   */
  removeAllowedPhoneNumber(phoneNumber: string): void {
    const normalizedPhone = this.normalizePhone(phoneNumber);

    if (!normalizedPhone) {
      return;
    }

    this.extraAllowedPhoneNumbers.delete(normalizedPhone);
    this.runtimePhoneNumbers.set([...this.extraAllowedPhoneNumbers]);
  }

  /**
   * Elimina un numero de servicio anadido en tiempo de ejecucion.
   *
   * @param serviceNumber Numero de servicio a retirar.
   */
  removeAllowedServiceNumber(serviceNumber: string): void {
    const normalizedServiceNumber = this.normalizeDigits(serviceNumber);

    if (!normalizedServiceNumber) {
      return;
    }

    this.extraAllowedServiceNumbers.delete(normalizedServiceNumber);
    this.runtimeServiceNumbers.set([...this.extraAllowedServiceNumbers]);
  }

  /**
   * Elimina todos los filtros añadidos dinámicamente en tiempo de ejecución.
   */
  resetRuntimeFilters(): void {
    this.extraAllowedPhoneNumbers.clear();
    this.extraAllowedServiceNumbers.clear();
    this.runtimePhoneNumbers.set([]);
    this.runtimeServiceNumbers.set([]);
  }

  /**
   * Carga manualmente la conversación mock para pruebas visuales.
   *
   * Reinicia cualquier sesión en curso y clona los mensajes del mock para no
   * compartir referencias con el dataset base.
   */
  loadMockConversation(): void {
    this.stopCapturedEntitiesPolling();
    this.activeConfid = null;
    this.sessionStatus = 'idle';
    this.seenIds.clear();
    this.currentCustomerPhone.set(CUSTOMER_PHONE);
    this.currentServiceName.set(SERVICE_NAME);
    this.conversationViewState.set('mock');

    const messages = CONVERSATION_MESSAGES.map((message) => ({ ...message }));
    this.messages.set(messages);
    this.rawDetails.set(RAW_DETAILS.map((detail) => ({ ...detail })));
    this.capturedIntents.set(CAPTURED_INTENTS_FROM_PAYLOAD.map((intent) => ({ ...intent })));
    this.nextId = (messages.at(-1)?.id ?? 0) + 1;
    this.isMockConversationLoaded.set(true);
  }

  /**
   * Limpia completamente la conversación visible.
   *
   * También cierra cualquier sesión activa y desactiva el modo mock manual.
   */
  clearConversation(): void {
    this.stopCapturedEntitiesPolling();
    this.activeConfid = null;
    this.sessionStatus = 'idle';
    this.isMockConversationLoaded.set(false);
    this.currentCustomerPhone.set(CUSTOMER_PHONE);
    this.currentServiceName.set(SERVICE_NAME);
    this.conversationViewState.set('idle');
    this.capturedIntents.set([]);
    this.resetConversation();
  }

  /**
   * Gestiona los eventos IVR que abren y cierran la conversación activa.
   *
   * Solo atiende llamadas entrantes permitidas. En `init` fija el `confid`
   * activo y limpia la conversación; en `end` cierra la sesión si el evento
   * pertenece a la llamada actual y la conversación llegó a iniciarse.
   *
   * @param event Evento bruto del canal `ivr`.
   */
  private handleIvrEvent(event: IvrCallEvent): void {
    const data = event?.data;

    if (!data || !this.isAllowedCall(data)) {
      return;
    }

    if (this.normalize(data.direction) !== 'incoming') {
      return;
    }

    const eventName = this.normalize(data.event);

    if (eventName === 'init') {
      if (this.activeConfid && this.sessionStatus === 'init') {
        return;
      }

      this.activeConfid = this.normalize(data.confid);
      this.sessionStatus = 'init';
      this.isMockConversationLoaded.set(false);
      this.currentCustomerPhone.set(this.normalizePhone(data.anumber) || CUSTOMER_PHONE);
      this.currentServiceName.set(this.resolveServiceName(data.service_number));
      this.conversationViewState.set('live');
      this.capturedIntents.set([]);
      this.resetConversation();
      this.startCapturedEntitiesPolling(this.activeConfid);
      const initMessages = [
        this.createSystemMessage('Iniciando la llamada', null, 'call'),
        this.createMessage('assistant', 'Agente IA', this.initialAgentGreeting, null),
      ];
      this.messages.set(initMessages);
      this.rawDetails.set([
        this.createRawDetail(initMessages[0].id, 'ivr', 'init', 'call_started', event),
        this.createRawDetail(initMessages[1].id, 'ivr', 'init', 'agent_greeting', event),
      ]);
      return;
    }

    if (eventName === 'end') {
      if (String(data.dialog_started) === '0') {
        return;
      }

      if (this.activeConfid !== this.normalize(data.confid)) {
        return;
      }

      this.stopCapturedEntitiesPolling();
      const endMessage = this.createSystemMessage('Fin de llamada', null, 'call');
      this.messages.update((messages) => [
        ...messages,
        endMessage,
      ]);
      this.rawDetails.update((details) => [
        ...details,
        this.createRawDetail(endMessage.id, 'ivr', 'end', 'call_finished', event),
      ]);
      this.sessionStatus = 'end';
      this.activeConfid = null;
      this.currentCustomerPhone.set(CUSTOMER_PHONE);
      this.currentServiceName.set(SERVICE_NAME);
      this.conversationViewState.set('idle');
    }
  }

  /**
   * Procesa los eventos del canal `ai_agent` asociados a la llamada activa.
   *
   * Ignora cualquier payload que no pueda parsearse o cuyo `confid` no
   * coincida con la sesión en curso.
   *
   * @param rawEvent Payload bruto recibido por socket.
   */
  private handleAiAgentEvent(rawEvent: unknown): void {
    const event = this.parseProcessEvent(rawEvent);

    if (!event || !this.activeConfid || this.activeConfid !== event.confid) {
      return;
    }

    const newMessages = this.eventToMessages(event);

    if (newMessages.length > 0) {
      this.messages.update((messages) => [...messages, ...newMessages]);
      this.rawDetails.update((details) => [
        ...details,
        ...newMessages.map((message) =>
          this.createRawDetail(
            message.id,
            'ai_agent',
            event.turn || event.result || 'ai_agent',
            event.agentAction || event.result || 'ai_agent',
            rawEvent,
          ),
        ),
      ]);
    }
  }

  /**
   * Comprueba si una llamada IVR pertenece al conjunto permitido para pruebas.
   *
   * @param data Datos del evento IVR.
   * @returns `true` cuando teléfono y servicio están autorizados.
   */
  private isAllowedCall(data: IvrCallEventData): boolean {
    const normalizedPhone = this.normalizePhone(data.anumber);
    const normalizedServiceNumber = this.normalizeDigits(data.service_number);

    return this.isAllowedPhoneNumber(normalizedPhone)
      && this.getAllowedServiceNumbers().has(normalizedServiceNumber);
  }

  /**
   * Devuelve la lista efectiva de teléfonos permitidos combinando valores por
   * defecto y añadidos en runtime.
   *
   * @returns Conjunto de teléfonos normalizados.
   */
  private getAllowedPhoneNumbers(): Set<string> {
    return new Set([
      ...this.defaultAllowedPhoneNumbers,
      ...this.extraAllowedPhoneNumbers,
    ]);
  }

  /**
   * Comprueba si un teléfono pertenece a la whitelist considerando formatos
   * locales e internacionales.
   *
   * @param phoneNumber Número de cliente ya normalizado a solo dígitos.
   * @returns `true` si coincide con algún teléfono permitido.
   */
  private isAllowedPhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber) {
      return false;
    }

    const phoneVariants = this.getPhoneVariants(phoneNumber);

    return [...this.getAllowedPhoneNumbers()].some((allowedPhoneNumber) =>
      this.getPhoneVariants(allowedPhoneNumber).some((variant) => phoneVariants.includes(variant)),
    );
  }

  /**
   * Devuelve la lista efectiva de servicios permitidos combinando valores por
   * defecto y añadidos en runtime.
   *
   * @returns Conjunto de números de servicio normalizados.
   */
  private getAllowedServiceNumbers(): Set<string> {
    return new Set([
      ...this.defaultAllowedServiceNumbers,
      ...this.extraAllowedServiceNumbers,
    ]);
  }

  /**
   * Convierte un evento parseado del agente en los mensajes de UI que
   * correspondan.
   *
   * Un único evento puede producir varios mensajes, por ejemplo uno de sistema
   * y otro del agente.
   *
   * @param event Evento del agente ya normalizado.
   * @returns Lista de mensajes listos para renderizar.
   */
  private eventToMessages(event: ProcessEventParsed): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    if (this.ignoreResults.has(this.upper(event.result))) {
      return messages;
    }

    const userMessage = this.buildUserMessage(event);
    const systemMessage = this.buildSystemMessage(event);
    const agentMessage = this.buildAgentMessage(event);

    if (userMessage) {
      messages.push(userMessage);
    }

    if (systemMessage) {
      messages.push(systemMessage);
    }

    if (agentMessage) {
      messages.push(agentMessage);
    }

    return messages;
  }

  /**
   * Construye el mensaje del usuario para un evento dado, aplicando dedupe.
   *
   * @param event Evento parseado del agente.
   * @returns Mensaje de usuario o `null` si no aplica.
   */
  private buildUserMessage(event: ProcessEventParsed): ConversationMessage | null {
    if (!this.isUser(event)) {
      return null;
    }

    const text = this.noInputResults.has(this.upper(event.result)) || this.noInputErrorResults.has(this.upper(event.result))
      ? '...'
      : this.normalize(event.transcriptionText);

    if (!text) {
      return null;
    }

    const key = `u:${event.confid}:${event.transcriptionEpoch ?? event.interactionEpoch ?? ''}:${text}`;

    if (this.seenIds.has(key)) {
      return null;
    }

    this.seenIds.add(key);
    return this.createMessage('user', 'Cliente', text, event.transcriptionTimestamp ?? this.safeDate(event.interactionEpoch));
  }

  /**
   * Construye el mensaje de sistema para un evento dado, aplicando dedupe.
   *
   * @param event Evento parseado del agente.
   * @returns Mensaje de sistema o `null` si no aplica.
   */
  private buildSystemMessage(event: ProcessEventParsed): ConversationMessage | null {
    if (!this.isSystem(event)) {
      return null;
    }

    const code = this.upper(event.result) || this.upper(event.transcriptionResult) || 'SYSTEM';
    const key = `s:${event.confid}:${event.interactionEpoch ?? ''}:${code}`;

    if (this.seenIds.has(key)) {
      return null;
    }

    this.seenIds.add(key);

    const text = this.getSystemText(event, code);

    return this.createMessage(
      'system',
      'Sistema',
      text,
      event.transcriptionTimestamp ?? this.safeDate(event.interactionEpoch),
    );
  }

  /**
   * Construye el mensaje del agente para un evento dado, aplicando dedupe.
   *
   * @param event Evento parseado del agente.
   * @returns Mensaje del asistente o `null` si no aplica.
   */
  private buildAgentMessage(event: ProcessEventParsed): ConversationMessage | null {
    if (!this.isAgent(event)) {
      return null;
    }

    const code = this.upper(event.result) || this.upper(event.transcriptionResult) || 'SYSTEM';
    const response = this.noInputResults.has(this.upper(event.result)) || ['AGENT_TIMEOUT_RETRY', 'AGENT_TIMEOUT_RUNOUT'].includes(this.upper(event.result))
      ? this.getAgentText(event, code)
      : this.normalize(event.agentResponse);
    const action = this.normalize(event.agentAction);
    const text = response || action;

    if (!text) {
      return null;
    }

    const key = `a:${event.confid}:${event.agentRequestEpoch ?? event.interactionEpoch ?? ''}:${text}`;

    if (this.seenIds.has(key)) {
      return null;
    }

    this.seenIds.add(key);
    return this.createMessage('assistant', 'Agente IA', text, event.agentRequestTimestamp ?? event.transcriptionTimestamp ?? this.safeDate(event.agentRequestEpoch));
  }

  /**
   * Crea un mensaje en el formato requerido por la UI.
   *
   * @param role Rol visual del mensaje.
   * @param author Etiqueta del autor que se mostrará en pantalla.
   * @param text Contenido del mensaje.
   * @param timestamp Fecha asociada al evento original.
   * @returns Mensaje listo para renderizar.
   */
  private createMessage(role: MessageRole, author: string, text: string, timestamp: Date | null): ConversationMessage {
    return {
      id: this.nextId++,
      author,
      role,
      time: this.formatTime(timestamp),
      text,
    };
  }

  /**
   * Crea un mensaje de sistema con variante visual opcional.
   *
   * @param text Contenido del mensaje.
   * @param timestamp Fecha asociada al evento original.
   * @param systemVariant Variante visual del chip de sistema.
   * @returns Mensaje listo para renderizar.
   */
  private createSystemMessage(
    text: string,
    timestamp: Date | null,
    systemVariant: ConversationMessage['systemVariant'] = 'default',
  ): ConversationMessage {
    return {
      ...this.createMessage('system', 'Sistema', text, timestamp),
      systemVariant,
    };
  }

  /**
   * Limpia la conversación activa y reinicia el dedupe interno.
   */
  private resetConversation(): void {
    this.messages.set([]);
    this.rawDetails.set([]);
    this.capturedIntents.set([]);
    this.seenIds.clear();
    this.nextId = 1;
  }

  /**
   * Crea el detalle raw enlazado a un mensaje visible de la conversación.
   *
   * @param messageId Identificador local del mensaje renderizado.
   * @param source Origen del evento.
   * @param eventName Nombre funcional del evento.
   * @param intent Etiqueta breve para el drawer.
   * @param payload Payload bruto recibido.
   * @returns Detalle serializado asociado al mensaje.
   */
  private createRawDetail(
    messageId: number,
    source: string,
    eventName: string,
    intent: string,
    payload: unknown,
  ): RawConversationDetail {
    return {
      messageId,
      source,
      eventName,
      intent,
      confidence: '',
      payload: this.stringifyPayload(payload),
    };
  }

  /**
   * Serializa un payload para mostrarlo en el drawer raw sin depender de IDs
   * del backend.
   *
   * @param payload Payload crudo del evento.
   * @returns JSON formateado o texto simple si no puede serializarse.
   */
  private stringifyPayload(payload: unknown): string {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return this.asString(payload);
    }
  }

  /**
   * Inicia el polling periódico del endpoint de entidades capturadas.
   *
   * La primera llamada se lanza inmediatamente y las siguientes respetan el
   * intervalo configurado en entorno.
   *
   * @param confid Identificador de la conversación activa.
   */
  private startCapturedEntitiesPolling(confid: string | null): void {
    if (!confid) {
      return;
    }

    this.stopCapturedEntitiesPolling();
    this.capturedEntitiesPollingSubscription = timer(0, this.capturedEntitiesPollingIntervalMs)
      .pipe(
        switchMap(() =>
          this.capturedEntitiesApiService.getCapturedEntitiesByConfid(confid).pipe(
            catchError((error) => {
              console.error('No se pudieron recuperar las entidades capturadas', error);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe((payload) => {
        this.capturedIntents.set(this.mapCapturedPayloadToIntents(payload));
      });
  }

  /**
   * Convierte el payload agregado de captura en tarjetas visibles de la barra
   * lateral, ocultando campos vacíos o nulos.
   *
   * @param payload Respuesta agregada del endpoint de entidades capturadas.
   * @returns Lista de intenciones y entidades visibles.
   */
  private mapCapturedPayloadToIntents(payload: CapturePayload): CapturedIntent[] {
    const items: Array<{ title: string; detail: string; status: CapturedIntent['status'] }> = [];

    const pushIfPresent = (
      title: string,
      value: string | number | null | undefined,
      status: CapturedIntent['status'],
    ): void => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      if (
        typeof value === 'string' &&
        ['null', 'unknown', 'no', 'none', ''].includes(value.trim().toLowerCase())
      ) {
        return;
      }

      items.push({
        title,
        detail: String(value),
        status,
      });
    };

    pushIfPresent('Intent', payload.intent, 'detected');
    pushIfPresent('Nombre', payload.nombre, 'confirmed');
    pushIfPresent('Teléfono', payload.telefono, 'confirmed');
    pushIfPresent('DNI', payload.dni, 'confirmed');
    pushIfPresent('Código postal', payload.cp, 'confirmed');
    pushIfPresent('Fecha de entrada', payload.fecha_entrada, 'confirmed');
    pushIfPresent('Fecha de salida', payload.fecha_salida, 'confirmed');
    pushIfPresent('Noches', payload.noches, 'confirmed');
    pushIfPresent('Personas', payload.personas, 'confirmed');
    pushIfPresent('Opcion', payload.opcion, 'confirmed');

    return items;
  }

  /**
   * Detiene el polling activo del endpoint de entidades capturadas.
   */
  private stopCapturedEntitiesPolling(): void {
    this.capturedEntitiesPollingSubscription?.unsubscribe();
    this.capturedEntitiesPollingSubscription = null;
  }

  /**
   * Determina si un evento debe renderizarse como intervención del usuario.
   *
   * @param event Evento parseado del agente.
   * @returns `true` si el evento representa entrada del usuario.
   */
  private isUser(event: ProcessEventParsed): boolean {
    return this.noInputResults.has(this.upper(event.result))
      || this.noInputErrorResults.has(this.upper(event.result))
      || (this.upper(event.turn) === 'USER' && this.normalize(event.transcriptionText) !== '');
  }

  /**
   * Determina si un evento debe renderizarse como respuesta del agente.
   *
   * @param event Evento parseado del agente.
   * @returns `true` si el evento representa salida del agente.
   */
  private isAgent(event: ProcessEventParsed): boolean {
    return this.noInputResults.has(this.upper(event.result))
      || ['AGENT_TIMEOUT_RETRY', 'AGENT_TIMEOUT_RUNOUT', 'AGENT_KO_RETRY', 'AGENT_KO_RUNOUT', 'AGENT_KO_EXIT'].includes(this.upper(event.result))
      || (
        this.upper(event.turn) === 'COMPLETED'
        && this.upper(event.agentResult) === 'OK'
        && this.normalize(event.agentResponse) !== ''
        && ['AGENT_OK_CONTINUE', 'AGENT_OK_ACTION'].includes(this.upper(event.result))
      );
  }

  /**
   * Determina si un evento debe renderizarse como mensaje de sistema.
   *
   * @param event Evento parseado del agente.
   * @returns `true` si el evento representa estado o control del flujo.
   */
  private isSystem(event: ProcessEventParsed): boolean {
    const completedWithoutAgentResult = this.upper(event.turn) === 'COMPLETED' && this.normalize(event.agentResult) === '';
    const systemByResult = this.systemResults.has(this.upper(event.result)) || this.systemResults.has(this.upper(event.transcriptionResult));
    return completedWithoutAgentResult || systemByResult;
  }

  /**
   * Genera el texto visible para un mensaje de sistema.
   *
   * @param event Evento parseado del agente.
   * @param code Código funcional del evento.
   * @returns Texto descriptivo para la UI.
   */
  private getSystemText(event: ProcessEventParsed, code: string): string {
    switch (code) {
      case 'NOMATCH_RUNOUT':
      case 'NOINPUT_RUNOUT':
      case 'AGENT_TIMEOUT_RUNOUT':
      case 'AGENT_TIMEOUT_EXIT':
      case 'AGENT_KO_RUNOUT':
      case 'AGENT_KO_EXIT':
        return event.destinationName ? `${code}: ${event.destinationName}` : code;
      case 'AGENT_OK_ACTION':
        return event.agentAction ? `ACTION: ${this.normalize(event.agentAction)}` : code;
      default:
        return code;
    }
  }

  /**
   * Genera el texto visible para un mensaje del agente en escenarios de ayuda,
   * timeout o error.
   *
   * @param event Evento parseado del agente.
   * @param code Código funcional del evento.
   * @returns Texto que debe mostrarse en la conversación.
   */
  private getAgentText(event: ProcessEventParsed, code: string): string {
    switch (code) {
      case 'NOMATCH_RETRY':
      case 'NOINPUT_RETRY':
        return this.normalize(event.helpMessage) || code;
      case 'AGENT_TIMEOUT_RETRY':
      case 'AGENT_KO_RETRY':
        return this.normalize(event.agentErrorMessage) || code;
      default:
        return this.normalize(event.agentResponse) || code;
    }
  }

  /**
   * Normaliza un payload bruto del socket al formato tipado usado por el
   * servicio.
   *
   * @param rawEvent Evento recibido desde `ai_agent`.
   * @returns Evento parseado o `null` si no contiene un `confid` válido.
   */
  private parseProcessEvent(rawEvent: unknown): ProcessEventParsed | null {
    const source = this.unwrapEvent(rawEvent);

    if (!source) {
      return null;
    }

    const parsed: ProcessEventParsed = {
      ani: '',
      confid: '',
      serviceId: null,
      serviceNumber: '',
      serviceName: '',
      interactionCount: null,
      interactionEpoch: null,
      transcriptionEpoch: null,
      transcriptionResult: '',
      transcriptionText: '',
      transcriptionTimestamp: null,
      agentRequestEpoch: null,
      agentRequestTimestamp: null,
      agentResult: '',
      agentError: '',
      agentAction: '',
      agentResponse: '',
      destinationName: '',
      turn: '',
      result: '',
      helpMessage: '',
      agentErrorMessage: '',
    };

    for (const [rawKey, rawValue] of Object.entries(source)) {
      const targetKey = this.keyMap[rawKey];

      if (!targetKey) {
        continue;
      }

      const fieldType = this.fieldTypes[rawKey];

      if (fieldType === 'number') {
        parsed[targetKey] = this.toNumber(rawValue) as never;
        continue;
      }

      if (fieldType === 'date') {
        parsed[targetKey] = this.toDate(rawValue) as never;
        continue;
      }

      parsed[targetKey] = this.asString(rawValue) as never;
    }

    return parsed.confid ? parsed : null;
  }

  /**
   * Extrae el objeto de datos real desde un payload socket.
   *
   * Algunos eventos llegan encapsulados en `data`; otros ya vienen como objeto
   * plano.
   *
   * @param rawEvent Evento recibido por websocket.
   * @returns Objeto con claves crudas o `null` si no se puede interpretar.
   */
  private unwrapEvent(rawEvent: unknown): ProcessEventRaw | null {
    if (!rawEvent || typeof rawEvent !== 'object') {
      return null;
    }

    const eventRecord = rawEvent as Record<string, unknown>;

    if (eventRecord['data'] && typeof eventRecord['data'] === 'object') {
      return eventRecord['data'] as ProcessEventRaw;
    }

    return eventRecord as ProcessEventRaw;
  }

  /**
   * Obtiene los números de servicio permitidos a partir de los payloads del
   * mock de conversación.
   *
   * @returns Lista única de números de servicio normalizados.
   */
  private extractDefaultServiceNumbers(): string[] {
    const serviceNumbers = new Set<string>();

    for (const detail of RAW_DETAILS) {
      try {
        const payload = JSON.parse(detail.payload) as Record<string, unknown>;
        const serviceNumber = this.normalizeDigits(payload['service_number']);

        if (serviceNumber) {
          serviceNumbers.add(serviceNumber);
        }
      } catch {
        continue;
      }
    }

    return [...serviceNumbers];
  }

  /**
   * Obtiene la etiqueta de servicio visible para la sesión actual.
   *
   * Usa el nombre conocido del mock cuando el número coincide con el servicio
   * por defecto; en caso contrario muestra el número recibido.
   *
   * @param serviceNumber Número de servicio bruto recibido.
   * @returns Nombre o etiqueta a mostrar en la interfaz.
   */
  private resolveServiceName(serviceNumber: unknown): string {
    const normalizedServiceNumber = this.normalizeDigits(serviceNumber);

    if (!normalizedServiceNumber) {
      return SERVICE_NAME;
    }

    return this.defaultAllowedServiceNumbers.has(normalizedServiceNumber)
      ? SERVICE_NAME
      : normalizedServiceNumber;
  }

  /**
   * Convierte un valor arbitrario a texto recortando espacios.
   *
   * @param value Valor a normalizar.
   * @returns Cadena limpia o vacía si el valor no existe.
   */
  private normalize(value: unknown): string {
    return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  }

  /**
   * Extrae únicamente los dígitos de un valor.
   *
   * @param value Valor de entrada.
   * @returns Cadena compuesta solo por dígitos.
   */
  private normalizeDigits(value: unknown): string {
    return this.normalize(value).replace(/\D/g, '');
  }

  /**
   * Normaliza un número de teléfono conservando el posible prefijo
   * internacional y eliminando cualquier separador.
   *
   * @param value Número a normalizar.
   * @returns Número limpio para comparaciones internas.
   */
  private normalizePhone(value: unknown): string {
    return this.normalizeDigits(value);
  }

  /**
   * Genera variantes equivalentes de un teléfono para comparar formatos
   * locales frente a internacionales.
   *
   * @param phoneNumber Número ya normalizado a solo dígitos.
   * @returns Lista única de variantes equivalentes.
   */
  private getPhoneVariants(phoneNumber: string): string[] {
    if (!phoneNumber) {
      return [];
    }

    const variants = new Set<string>([phoneNumber]);

    if (phoneNumber.length > 9) {
      variants.add(phoneNumber.slice(-9));
    }

    return [...variants];
  }

  /**
   * Convierte un valor arbitrario a mayúsculas usando la normalización base.
   *
   * @param value Valor de entrada.
   * @returns Cadena normalizada en mayúsculas.
   */
  private upper(value: unknown): string {
    return this.normalize(value).toUpperCase();
  }

  /**
   * Intenta convertir un valor a número.
   *
   * @param value Valor crudo.
   * @returns Número parseado o `null` si no es válido.
   */
  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /**
   * Convierte una fecha textual al tipo `Date`.
   *
   * Soporta tanto el formato español `dd/MM/yyyy HH:mm:ss.SSS` como cadenas
   * parseables por el constructor nativo de `Date`.
   *
   * @param value Valor crudo con la fecha.
   * @returns Fecha parseada o `null` si no puede interpretarse.
   */
  private toDate(value: unknown): Date | null {
    const normalized = this.asString(value);

    if (!normalized) {
      return null;
    }

    const esDate = this.parseEsDateTime(normalized);

    if (esDate) {
      return esDate;
    }

    const isoDate = new Date(normalized.replace(' ', 'T'));
    return Number.isNaN(isoDate.getTime()) ? null : isoDate;
  }

  /**
   * Parsea fechas en formato español con milisegundos opcionales.
   *
   * @param value Cadena de fecha en formato `dd/MM/yyyy HH:mm:ss.SSS`.
   * @returns Instancia de `Date` o `null` si el formato no coincide.
   */
  private parseEsDateTime(value: string): Date | null {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value);

    if (!match) {
      return null;
    }

    const [, day, month, year, hours, minutes, seconds, milliseconds = '0'] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
      Number(milliseconds.padEnd(3, '0')),
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * Convierte un epoch numérico a `Date`.
   *
   * @param value Epoch en milisegundos.
   * @returns Fecha válida o `null` si el valor no existe o no es correcto.
   */
  private safeDate(value: number | null): Date | null {
    if (value === null) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * Convierte un valor arbitrario a cadena sin lanzar errores.
   *
   * @param value Valor a convertir.
   * @returns Representación textual del valor.
   */
  private asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
  }

  /**
   * Formatea una fecha al formato horario que consume la UI de la conversación.
   *
   * @param timestamp Fecha del evento.
   * @returns Hora en formato `HH:mm`.
   */
  private formatTime(timestamp: Date | null): string {
    const value = timestamp ?? new Date();
    return value.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
