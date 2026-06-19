import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { WsAuthService } from './ws-auth.service';

describe('WsAuthService', () => {
  // REDACTADO: las credenciales reales de login websocket fueron retiradas; el
  // test valida que la version entregable no inyecta identificadores privados.
  let service: WsAuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sso_id', 'user-1');
    localStorage.setItem('user_faked', 'false');
    localStorage.setItem('app', 'dashboard');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        WsAuthService,
      ],
    });

    service = TestBed.inject(WsAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should request websocket credentials using local storage values', () => {
    service.loginWs().subscribe();

    const request = httpMock.expectOne((req) => req.method === 'POST' && req.url === environment.login);
    expect(request.request.body.id).toBe('');
    expect(request.request.body.userFaked).toBe('');
    expect(request.request.body.app).toBe('');
    expect(request.request.body.deviceId).toBe('');
    expect(typeof request.request.body.session).toBe('number');

    request.flush({ server: 'ws://localhost', token: 'CREDENCIAL_REDACTADA' });
  });

  it('should allow overriding the generated payload', () => {
    service.loginWs({ deviceId: 'custom-device', extra: 'value' }).subscribe();

    const request = httpMock.expectOne(environment.login);
    expect(request.request.body.deviceId).toBe('custom-device');
    expect(request.request.body.extra).toBe('value');

    request.flush({ server: 'ws://localhost', token: 'CREDENCIAL_REDACTADA' });
  });
});
