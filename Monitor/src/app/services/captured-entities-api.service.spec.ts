import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CapturedEntitiesApiService } from './captured-entities-api.service';
import { API_ENDPOINTS } from './api-endpoints';

describe('CapturedEntitiesApiService', () => {
  let service: CapturedEntitiesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CapturedEntitiesApiService,
      ],
    });

    service = TestBed.inject(CapturedEntitiesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should request the captured entities endpoint by post sending confid in the body', () => {
    service.getCapturedEntities('CONF-1').subscribe();

    const request = httpMock.expectOne((req) =>
      req.method === 'POST'
      && req.url === API_ENDPOINTS.capturedEntities
      && req.body?.confid === 'CONF-1',
    );

    expect(request.request.method).toBe('POST');
    request.flush({
      intent: 'new_booking',
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
    });
  });

  it('should request captured entities by confid', () => {
    service.getCapturedEntitiesByConfid('CONF-2').subscribe();

    const request = httpMock.expectOne((req) =>
      req.method === 'POST'
      && req.url === API_ENDPOINTS.capturedEntities
      && req.body?.confid === 'CONF-2',
    );

    expect(request.request.method).toBe('POST');
    request.flush({
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
    });
  });
});

