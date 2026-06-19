import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AppInitService } from './app-init.service';
import { RealtimeSocketService } from './realtime-socket.service';
import { WsAuthService } from './ws-auth.service';

describe('AppInitService', () => {
  // REDACTADO: las credenciales websocket usadas por los tests son placeholders;
  // aqui iria una credencial temporal devuelta por el backend real.
  let loginWs: jasmine.Spy;
  let connect: jasmine.Spy;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    loginWs = jasmine.createSpy('loginWs');
    connect = jasmine.createSpy('connect');
    consoleErrorSpy = spyOn(console, 'error');

    TestBed.configureTestingModule({
      providers: [
        AppInitService,
        {
          provide: WsAuthService,
          useValue: { loginWs },
        },
        {
          provide: RealtimeSocketService,
          useValue: { connect },
        },
      ],
    });
  });

  it('should connect the realtime socket when credentials are valid', async () => {
    loginWs.and.returnValue(of({ server: 'ws://localhost', token: 'CREDENCIAL_REDACTADA' }));
    const service = TestBed.inject(AppInitService);

    await service.init();

    expect(connect).toHaveBeenCalledWith('ws://localhost', 'CREDENCIAL_REDACTADA');
  });

  it('should not connect when the websocket response is incomplete', async () => {
    loginWs.and.returnValue(of({ server: 'ws://localhost', token: '' }));
    const service = TestBed.inject(AppInitService);

    await service.init();

    expect(connect).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should swallow login errors and log them', async () => {
    loginWs.and.returnValue(throwError(() => new Error('login failed')));
    const service = TestBed.inject(AppInitService);

    await service.init();

    expect(connect).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
