import { TestBed } from '@angular/core/testing';
import { RealtimeSocketService, SOCKET_IO_FACTORY } from './realtime-socket.service';

describe('RealtimeSocketService', () => {
  // REDACTADO: las credenciales websocket de estos tests son placeholders;
  // aqui iria el token efimero entregado por el backend real.
  let service: RealtimeSocketService;
  let socketFactory: jasmine.Spy;
  let socket: {
    connected: boolean;
    on: jasmine.Spy;
    onAny: jasmine.Spy;
    off: jasmine.Spy;
    offAny: jasmine.Spy;
    emit: jasmine.Spy;
    disconnect: jasmine.Spy;
  };
  let handlers: Record<string, (payload?: unknown) => void>;
  let anyHandler: ((eventName: string, payload: unknown) => void) | undefined;

  beforeEach(() => {
    handlers = {};
    anyHandler = undefined;
    socket = {
      connected: false,
      on: jasmine.createSpy('on').and.callFake((event: string, handler: (payload?: unknown) => void) => {
        handlers[event] = handler;
      }),
      onAny: jasmine.createSpy('onAny').and.callFake((handler: (eventName: string, payload: unknown) => void) => {
        anyHandler = handler;
      }),
      off: jasmine.createSpy('off'),
      offAny: jasmine.createSpy('offAny'),
      emit: jasmine.createSpy('emit'),
      disconnect: jasmine.createSpy('disconnect'),
    };

    socketFactory = jasmine.createSpy('socketFactory').and.returnValue(socket as never);

    TestBed.configureTestingModule({
      providers: [
        RealtimeSocketService,
        {
          provide: SOCKET_IO_FACTORY,
          useValue: socketFactory,
        },
      ],
    });

    service = TestBed.inject(RealtimeSocketService);
  });

  it('should connect using websocket transport and start the realtime session on connect', () => {
    service.connect('ws://localhost', 'CREDENCIAL_REDACTADA_1');

    expect(socketFactory).toHaveBeenCalledWith('ws://localhost', jasmine.objectContaining({
      transports: ['websocket'],
      query: { token: 'CREDENCIAL_REDACTADA_1' },
    }));

    handlers['connect']();

    expect(socket.emit).toHaveBeenCalledWith('start', jasmine.any(Function));
  });

  it('should not reconnect when an active socket is already connected', () => {
    socket.connected = true;
    service.connect('ws://localhost', 'CREDENCIAL_REDACTADA_1');
    service.connect('ws://localhost', 'CREDENCIAL_REDACTADA_2');

    expect(socketFactory).toHaveBeenCalledTimes(1);
  });

  it('should expose a stream for a specific event', () => {
    service.connect('ws://localhost', 'CREDENCIAL_REDACTADA_1');
    let received: unknown;

    const subscription = service.listen('ivr').subscribe((payload) => {
      received = payload;
    });

    handlers['ivr']({ data: { confid: 'CONF-1' } });

    expect(received).toEqual({ data: { confid: 'CONF-1' } });

    subscription.unsubscribe();
    expect(socket.off).toHaveBeenCalledWith('ivr', jasmine.any(Function));
  });

  it('should expose a global stream for any incoming event', () => {
    service.connect('ws://localhost', 'CREDENCIAL_REDACTADA_1');
    let received: unknown;

    const subscription = service.listenAll().subscribe((payload) => {
      received = payload;
    });

    anyHandler?.('ai_agent', { result: 'AGENT_OK_CONTINUE' });

    expect(received).toEqual({
      name: 'ai_agent',
      payload: { result: 'AGENT_OK_CONTINUE' },
    });

    subscription.unsubscribe();
    expect(socket.offAny).toHaveBeenCalledWith(jasmine.any(Function));
  });

  it('should forward outgoing emits and disconnect the current socket', () => {
    service.connect('ws://localhost', 'CREDENCIAL_REDACTADA_1');

    service.emit('ivr', { ping: true });
    service.disconnect();

    expect(socket.emit).toHaveBeenCalledWith('ivr', { ping: true });
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
