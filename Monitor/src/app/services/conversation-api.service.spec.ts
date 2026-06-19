import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ConversationApiService } from './conversation-api.service';
import { API_ENDPOINTS } from './api-endpoints';

describe('ConversationApiService', () => {
  let service: ConversationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConversationApiService,
      ],
    });

    service = TestBed.inject(ConversationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should request the conversation endpoint with non-empty filters only', () => {
    service.getConversation({
      confid: 'CONF-1',
      ani: '',
      serviceId: 12,
      dateFrom: undefined,
    }).subscribe();

    const request = httpMock.expectOne((req) =>
      req.method === 'GET'
      && req.url === API_ENDPOINTS.conversation
      && req.params.get('confid') === 'CONF-1'
      && req.params.get('serviceId') === '12'
      && !req.params.has('ani'),
    );

    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('should request the conversation by confid', () => {
    service.getConversationByConfid('CONF-2').subscribe();

    const request = httpMock.expectOne((req) =>
      req.method === 'GET'
      && req.url === API_ENDPOINTS.conversation
      && req.params.get('confid') === 'CONF-2',
    );

    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});

