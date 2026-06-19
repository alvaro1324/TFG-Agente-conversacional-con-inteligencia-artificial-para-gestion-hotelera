import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { CAPTURED_INTENTS_FROM_PAYLOAD, CONVERSATION_MESSAGES, CUSTOMER_PHONE, RAW_DETAILS, SERVICE_NAME } from './data/dashboard.mock';
import { LiveConversationService } from './services/live-conversation.service';

class LiveConversationServiceMock {
  // REDACTADO: estos fixtures usan numeros sinteticos; aqui irian los numeros
  // permitidos por defecto en un entorno real.
  readonly messages = signal([]);
  readonly isMockConversationLoaded = signal(false);
  readonly currentCustomerPhone = signal(CUSTOMER_PHONE);
  readonly currentServiceName = signal(SERVICE_NAME);
  readonly conversationViewState = signal<'idle' | 'live' | 'mock'>('idle');
  readonly defaultPhoneNumbers = signal([CUSTOMER_PHONE]);
  readonly defaultServiceNumbers = signal(['910000000']);
  readonly runtimePhoneNumbers = signal<string[]>([]);
  readonly runtimeServiceNumbers = signal<string[]>([]);
  readonly rawDetails = signal(RAW_DETAILS);
  readonly capturedIntents = signal(CAPTURED_INTENTS_FROM_PAYLOAD);

  readonly addAllowedPhoneNumber = jasmine.createSpy('addAllowedPhoneNumber');
  readonly addAllowedServiceNumber = jasmine.createSpy('addAllowedServiceNumber');
  readonly removeAllowedPhoneNumber = jasmine.createSpy('removeAllowedPhoneNumber');
  readonly removeAllowedServiceNumber = jasmine.createSpy('removeAllowedServiceNumber');
  readonly resetRuntimeFilters = jasmine.createSpy('resetRuntimeFilters');
  readonly loadMockConversation = jasmine.createSpy('loadMockConversation');
  readonly clearConversation = jasmine.createSpy('clearConversation');
}

describe('AppComponent', () => {
  let service: LiveConversationServiceMock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: LiveConversationService,
          useClass: LiveConversationServiceMock,
        },
      ],
    }).compileComponents();

    service = TestBed.inject(LiveConversationService) as unknown as LiveConversationServiceMock;
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the realtime empty state before receiving socket events', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.message').length).toBe(0);
    expect(compiled.textContent).toContain('Esperando iniciar una conversa');
  });

  it('should render the hotel assistant headline', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Agente conversacional con inteligencia artificial',
    );
  });

  it('should expose captured intents only when the mock conversation is loaded', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & { intents: () => unknown[] };
    fixture.detectChanges();

    expect(component['intents']().length).toBeGreaterThan(0);

    service.capturedIntents.set([]);
    fixture.detectChanges();

    expect(component['intents']()).toEqual([]);
  });

  it('should resolve the selected raw detail from the service store', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      selectedMessageId: number | null;
      selectedRawDetail: unknown;
    };

    component['selectedMessageId'] = 1;
    fixture.detectChanges();

    expect(component['selectedRawDetail']).toEqual(jasmine.objectContaining({ messageId: 1 }));

    service.rawDetails.set([]);
    fixture.detectChanges();

    expect(component['selectedRawDetail']).toBeNull();
  });

  it('should forward runtime filter actions to the live conversation service', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      addPhoneNumber(phone: string): void;
      addServiceNumber(serviceNumber: string): void;
      removePhoneNumber(phone: string): void;
      removeServiceNumber(serviceNumber: string): void;
      resetRuntimeFilters(): void;
    };

    component['addPhoneNumber']('600111222');
    component['addServiceNumber']('910000000');
    component['removePhoneNumber']('600111222');
    component['removeServiceNumber']('910000000');
    component['resetRuntimeFilters']();

    expect(service.addAllowedPhoneNumber).toHaveBeenCalledWith('600111222');
    expect(service.addAllowedServiceNumber).toHaveBeenCalledWith('910000000');
    expect(service.removeAllowedPhoneNumber).toHaveBeenCalledWith('600111222');
    expect(service.removeAllowedServiceNumber).toHaveBeenCalledWith('910000000');
    expect(service.resetRuntimeFilters).toHaveBeenCalled();
  });

  it('should delegate mock actions to the live conversation service', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      selectedMessageId: number | null;
      loadMockConversation(): void;
      clearConversation(): void;
    };

    component['selectedMessageId'] = CONVERSATION_MESSAGES[0].id;
    component['loadMockConversation']();
    component['clearConversation']();

    expect(component['selectedMessageId']).toBeNull();
    expect(service.loadMockConversation).toHaveBeenCalled();
    expect(service.clearConversation).toHaveBeenCalled();
  });
});

