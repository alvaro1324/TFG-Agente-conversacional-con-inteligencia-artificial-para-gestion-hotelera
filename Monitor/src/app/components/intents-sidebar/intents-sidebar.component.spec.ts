import { TestBed } from '@angular/core/testing';
import { IntentsSidebarComponent } from './intents-sidebar.component';
import { CapturedIntent } from '../../models/conversation.models';

describe('IntentsSidebarComponent', () => {
  // REDACTADO: los datos de entidad usados por los tests son sinteticos; aqui
  // irian valores capturados desde el backend real.
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntentsSidebarComponent],
    }).compileComponents();
  });

  it('should render an empty state when there are no intents', () => {
    const fixture = TestBed.createComponent(IntentsSidebarComponent);
    fixture.componentRef.setInput('intents', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sin intenciones capturadas');
  });

  it('should render the provided intents with their visual status', () => {
    const fixture = TestBed.createComponent(IntentsSidebarComponent);
    const intents: CapturedIntent[] = [
      { title: 'Intent', detail: 'new_booking', status: 'detected' },
      { title: 'Teléfono', detail: '600000000', status: 'confirmed' },
    ];

    fixture.componentRef.setInput('intents', intents);
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.intent-badge');
    expect(fixture.nativeElement.textContent).toContain('new_booking');
    expect(badges.length).toBe(2);
    expect((badges[0] as HTMLElement).classList.contains('detected')).toBeTrue();
    expect((badges[1] as HTMLElement).classList.contains('confirmed')).toBeTrue();
  });
});
