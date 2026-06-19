import { TestBed } from '@angular/core/testing';
import { ConversationPanelComponent } from './conversation-panel.component';
import { ConversationMessage, RawConversationDetail } from '../../models/conversation.models';

describe('ConversationPanelComponent', () => {
  // REDACTADO: el telefono usado en estos tests es sintetico; aqui iria un
  // numero de cliente real solo en un entorno privado.
  const conversation: ConversationMessage[] = [
    { id: 1, author: 'Cliente', role: 'user', time: '10:00', text: 'Hola' },
    { id: 2, author: 'Sistema', role: 'system', time: '10:01', text: 'ACTION: colgar' },
    { id: 3, author: 'Sistema', role: 'system', time: '10:02', text: 'Iniciando la llamada', systemVariant: 'call' },
    { id: 4, author: 'Agente IA', role: 'assistant', time: '10:03', text: '¿En qué puedo ayudarle?' },
  ];

  const rawDetail: RawConversationDetail = {
    messageId: 2,
    source: 'agent',
    eventName: 'action',
    intent: 'hangup',
    confidence: 'high',
    payload: '{"result":"AGENT_OK_ACTION"}',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConversationPanelComponent],
    }).compileComponents();
  });

  it('should render the empty state when there are no messages', () => {
    const fixture = TestBed.createComponent(ConversationPanelComponent);
    fixture.componentRef.setInput('customerPhone', '600000000');
    fixture.componentRef.setInput('serviceName', 'Agente AI');
    fixture.componentRef.setInput('conversation', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Esperando iniciar una conversa');
    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
  });

  it('should render the status badge for a mock conversation', () => {
    const fixture = TestBed.createComponent(ConversationPanelComponent);
    fixture.componentRef.setInput('customerPhone', '600000000');
    fixture.componentRef.setInput('serviceName', 'Agente AI');
    fixture.componentRef.setInput('conversation', conversation);
    fixture.componentRef.setInput('conversationViewState', 'mock');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.status-badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('Mock');
    expect(badge.classList.contains('mock')).toBeTrue();
  });

  it('should emit the selected message id when clicking a rendered message', () => {
    const fixture = TestBed.createComponent(ConversationPanelComponent);
    fixture.componentRef.setInput('customerPhone', '600000000');
    fixture.componentRef.setInput('serviceName', 'Agente AI');
    fixture.componentRef.setInput('conversation', conversation);
    fixture.detectChanges();

    spyOn(fixture.componentInstance.selectMessage, 'emit');

    const message = fixture.nativeElement.querySelector('.message') as HTMLElement;
    message.click();

    expect(fixture.componentInstance.selectMessage.emit).toHaveBeenCalledWith(1);
  });

  it('should render call lifecycle system messages with the gray badge style', () => {
    const fixture = TestBed.createComponent(ConversationPanelComponent);
    fixture.componentRef.setInput('customerPhone', '600000000');
    fixture.componentRef.setInput('serviceName', 'Agente AI');
    fixture.componentRef.setInput('conversation', conversation);
    fixture.detectChanges();

    const systemMessages = fixture.nativeElement.querySelectorAll('.system-message') as NodeListOf<HTMLElement>;
    expect(systemMessages[1].classList.contains('call')).toBeTrue();
    expect(systemMessages[1].textContent).toContain('Iniciando la llamada');
  });

  it('should render the raw drawer and emit clearSelection on close', () => {
    const fixture = TestBed.createComponent(ConversationPanelComponent);
    fixture.componentRef.setInput('customerPhone', '600000000');
    fixture.componentRef.setInput('serviceName', 'Agente AI');
    fixture.componentRef.setInput('conversation', conversation);
    fixture.componentRef.setInput('selectedRawDetail', rawDetail);
    fixture.detectChanges();

    spyOn(fixture.componentInstance.clearSelection, 'emit');

    expect(fixture.nativeElement.textContent).toContain(rawDetail.payload);

    const closeButton = fixture.nativeElement.querySelector('.raw-close') as HTMLButtonElement;
    closeButton.click();

    expect(fixture.componentInstance.clearSelection.emit).toHaveBeenCalled();
  });

  it('should scroll to the latest message when the conversation grows', async () => {
    const fixture = TestBed.createComponent(ConversationPanelComponent);
    fixture.componentRef.setInput('customerPhone', '600000000');
    fixture.componentRef.setInput('serviceName', 'Agente AI');
    fixture.componentRef.setInput('conversation', conversation.slice(0, 1));
    fixture.detectChanges();

    const scrollSpy = spyOn<any>(fixture.componentInstance, 'scrollToLatestMessage').and.callThrough();

    fixture.componentRef.setInput('conversation', conversation);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scrollSpy).toHaveBeenCalled();
  });
});

