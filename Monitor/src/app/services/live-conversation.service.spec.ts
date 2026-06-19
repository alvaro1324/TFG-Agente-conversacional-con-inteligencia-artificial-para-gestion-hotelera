import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CUSTOMER_PHONE, SERVICE_NAME } from '../data/dashboard.mock';
import { CapturePayload } from '../models/conversation.models';
import { CapturedEntitiesApiService } from './captured-entities-api.service';
import { LiveConversationService } from './live-conversation.service';
import { RealtimeSocketService } from './realtime-socket.service';

class RealtimeSocketServiceStub {
  private readonly channels = new Map<string, Subject<unknown>>();

  listen<T = unknown>(event: string) {
    if (!this.channels.has(event)) {
      this.channels.set(event, new Subject<unknown>());
    }

    return this.channels.get(event)!.asObservable() as Subject<T>;
  }

  emitEvent(event: string, payload: unknown): void {
    if (!this.channels.has(event)) {
      this.channels.set(event, new Subject<unknown>());
    }

    this.channels.get(event)!.next(payload);
  }
}

class CapturedEntitiesApiServiceStub {
  readonly getCapturedEntitiesByConfid = jasmine
    .createSpy('getCapturedEntitiesByConfid')
    .and.returnValue(of(this.emptyPayload()));

  private emptyPayload(): CapturePayload {
    return {
      intent: 'unknown',
      nombre: null,
      telefono: null,
      dni: null,
      cp: null,
      fecha_entrada: null,
      fecha_salida: null,
      noches: null,
      personas: null,
      confirm: 'unknown',
      opcion: null,
      capture_ok: 'unknown',
      capture_field: 'none',
      end: 'no',
      reset: 'no',
    };
  }
}

describe('LiveConversationService', () => {
  // REDACTADO: los telefonos, numeros de servicio e identificadores de estos
  // tests son sinteticos; aqui irian valores equivalentes de un entorno real.
  let service: LiveConversationService;
  let realtimeSocketService: RealtimeSocketServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LiveConversationService,
        {
          provide: RealtimeSocketService,
          useClass: RealtimeSocketServiceStub,
        },
        {
          provide: CapturedEntitiesApiService,
          useClass: CapturedEntitiesApiServiceStub,
        },
      ],
    });

    service = TestBed.inject(LiveConversationService);
    realtimeSocketService = TestBed.inject(RealtimeSocketService) as unknown as RealtimeSocketServiceStub;
  });

  it('should expose the expected initial state', () => {
    expect(service.messages()).toEqual([]);
    expect(service.rawDetails()).toEqual([]);
    expect(service.isMockConversationLoaded()).toBeFalse();
    expect(service.currentCustomerPhone()).toBe(CUSTOMER_PHONE);
    expect(service.currentServiceName()).toBe(SERVICE_NAME);
    expect(service.conversationViewState()).toBe('idle');
    expect(service.defaultPhoneNumbers()).toContain(CUSTOMER_PHONE);
    expect(service.defaultServiceNumbers().length).toBeGreaterThan(0);
  });

  it('should manage runtime filters normalizing the input values', () => {
    service.addAllowedPhoneNumber('+34 600 111 222');
    service.addAllowedServiceNumber('910-000-000');

    expect(service.runtimePhoneNumbers()).toEqual(['34600111222']);
    expect(service.runtimeServiceNumbers()).toEqual(['910000000']);

    service.removeAllowedPhoneNumber('+34 600 111 222');
    service.removeAllowedServiceNumber('910000000');

    expect(service.runtimePhoneNumbers()).toEqual([]);
    expect(service.runtimeServiceNumbers()).toEqual([]);
  });

  it('should allow an incoming call when the same phone arrives with an international prefix', () => {
    realtimeSocketService.emitEvent('ivr', {
      data: {
        confid: 'CONF-INTL-1',
        event: 'init',
        direction: 'incoming',
        dialog_started: '1',
        service_number: '910000000',
        anumber: `34${CUSTOMER_PHONE}`,
      },
    });

    expect(service.conversationViewState()).toBe('live');
    expect(service.currentCustomerPhone()).toBe(`34${CUSTOMER_PHONE}`);
  });

  it('should load and clear the mock conversation', () => {
    service.loadMockConversation();

    expect(service.isMockConversationLoaded()).toBeTrue();
    expect(service.conversationViewState()).toBe('mock');
    expect(service.messages().length).toBeGreaterThan(0);
    expect(service.rawDetails().length).toBeGreaterThan(0);

    service.clearConversation();

    expect(service.isMockConversationLoaded()).toBeFalse();
    expect(service.conversationViewState()).toBe('idle');
    expect(service.messages()).toEqual([]);
    expect(service.rawDetails()).toEqual([]);
    expect(service.currentCustomerPhone()).toBe(CUSTOMER_PHONE);
  });

  it('should start a live session only for allowed incoming ivr calls', () => {
    realtimeSocketService.emitEvent('ivr', {
      data: {
        confid: 'CONF-1',
        event: 'init',
        direction: 'incoming',
        dialog_started: '1',
        service_number: '910000000',
        anumber: '600000000',
      },
    });

    expect(service.conversationViewState()).toBe('live');
    expect(service.currentCustomerPhone()).toBe('600000000');
    expect(service.currentServiceName()).toBe(SERVICE_NAME);
    expect(service.messages()).toEqual([
      jasmine.objectContaining({
        role: 'system',
        text: 'Iniciando la llamada',
        systemVariant: 'call',
      }),
      jasmine.objectContaining({
        role: 'assistant',
        text: jasmine.stringContaining('Bienvenido al sistema inteligente de reservas'),
      }),
    ]);
    expect(service.rawDetails().slice(-2)).toEqual([
      jasmine.objectContaining({
        messageId: service.messages()[0].id,
        source: 'ivr',
      }),
      jasmine.objectContaining({
        messageId: service.messages()[1].id,
        source: 'ivr',
      }),
    ]);
  });
  it('should map captured entities payload to visible intents hiding null and placeholder fields', fakeAsync(() => {
    realtimeSocketService.emitEvent('ivr', {
      data: {
        confid: 'CONF-INTENTS-1',
        event: 'init',
        direction: 'incoming',
        dialog_started: '1',
        service_number: '910000000',
        anumber: '600000000',
      },
    });

    tick(0);

    expect(service.capturedIntents()).toEqual([]);
  }));

  it('should ignore ivr events for disallowed calls or outgoing traffic', () => {
    realtimeSocketService.emitEvent('ivr', {
      data: {
        confid: 'CONF-1',
        event: 'init',
        direction: 'outgoing',
        dialog_started: '1',
        service_number: '910000000',
        anumber: '600000000',
      },
    });

    expect(service.conversationViewState()).toBe('idle');

    realtimeSocketService.emitEvent('ivr', {
      data: {
        confid: 'CONF-2',
        event: 'init',
        direction: 'incoming',
        dialog_started: '1',
        service_number: '000',
        anumber: '600000000',
      },
    });

    expect(service.conversationViewState()).toBe('idle');
  });

  it('should transform ai_agent events into conversation messages and create raw details with local ids', () => {
    realtimeSocketService.emitEvent('ivr', {
      data: {
        confid: 'CONF-3',
        event: 'init',
        direction: 'incoming',
        dialog_started: '1',
        service_number: '910000000',
        anumber: '600000000',
      },
    });

    realtimeSocketService.emitEvent('ai_agent', {
      data: {
        confid: 'CONF-3',
        turn: 'USER',
        transcription_text: 'Necesito una reserva',
        transcription_timestamp: '10/04/2026 09:59:16.930',
        result: 'AGENT_OK_CONTINUE',
      },
    });

    realtimeSocketService.emitEvent('ai_agent', {
      data: {
        confid: 'CONF-3',
        turn: 'COMPLETED',
        agent_result: 'OK',
        agent_response: 'Perfecto, le ayudo con la reserva.',
        agent_request_timestamp: '10/04/2026 09:59:20.930',
        result: 'AGENT_OK_CONTINUE',
      },
    });

    realtimeSocketService.emitEvent('ai_agent', {
      data: {
        confid: 'CONF-3',
        turn: 'USER',
        transcription_text: 'Necesito una reserva',
        transcription_timestamp: '10/04/2026 09:59:16.930',
        result: 'AGENT_OK_CONTINUE',
      },
    });

    expect(service.messages().map((message) => message.text)).toEqual([
      'Iniciando la llamada',
      jasmine.stringContaining('Bienvenido al sistema inteligente de reservas') as unknown as string,
      'Necesito una reserva',
      'Perfecto, le ayudo con la reserva.',
    ]);
    expect(service.rawDetails().slice(-2)).toEqual([
      jasmine.objectContaining({
        messageId: service.messages()[2].id,
        source: 'ai_agent',
      }),
      jasmine.objectContaining({
        messageId: service.messages()[3].id,
        source: 'ai_agent',
      }),
    ]);
  });

  it('should render no-input events as user placeholder and assistant help text', () => {
    realtimeSocketService.emitEvent('ivr', {
      data: {
        confid: 'CONF-4',
        event: 'init',
        direction: 'incoming',
        dialog_started: '1',
        service_number: '910000000',
        anumber: '600000000',
      },
    });

    realtimeSocketService.emitEvent('ai_agent', {
      data: {
        confid: 'CONF-4',
        turn: 'USER',
        transcription_text: '',
        help_message: 'Puede repetirlo, por favor?',
        result: 'NOINPUT_RETRY',
      },
    });

    expect(service.messages().map((message) => message.text)).toEqual([
      'Iniciando la llamada',
      jasmine.stringContaining('Bienvenido al sistema inteligente de reservas') as unknown as string,
      '...',
      'NOINPUT_RETRY',
      'Puede repetirlo, por favor?',
    ]);
  });

  it('should close the active session on a matching ivr end event', () => {
    realtimeSocketService.emitEvent('ivr', {
      data: {
        confid: 'CONF-5',
        event: 'init',
        direction: 'incoming',
        dialog_started: '1',
        service_number: '910000000',
        anumber: '600000000',
      },
    });

    realtimeSocketService.emitEvent('ivr', {
      data: {
        confid: 'CONF-5',
        event: 'end',
        direction: 'incoming',
        dialog_started: '1',
        service_number: '910000000',
        anumber: '600000000',
      },
    });

    expect(service.conversationViewState()).toBe('idle');
    expect(service.currentCustomerPhone()).toBe(CUSTOMER_PHONE);
    expect(service.currentServiceName()).toBe(SERVICE_NAME);
    expect(service.messages().at(-1)).toEqual(
      jasmine.objectContaining({
        role: 'system',
        text: 'Fin de llamada',
        systemVariant: 'call',
      }),
    );
    expect(service.rawDetails().at(-1)).toEqual(
      jasmine.objectContaining({
        messageId: service.messages().at(-1)?.id,
        source: 'ivr',
        eventName: 'end',
      }),
    );
  });

  it('should log subscription errors from realtime streams', () => {
    const consoleErrorSpy = spyOn(console, 'error');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        LiveConversationService,
        {
          provide: RealtimeSocketService,
          useValue: {
            listen: (event: string) => throwError(() => new Error(`${event} failed`)),
          },
        },
        {
          provide: CapturedEntitiesApiService,
          useClass: CapturedEntitiesApiServiceStub,
        },
      ],
    });

    TestBed.inject(LiveConversationService);

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
