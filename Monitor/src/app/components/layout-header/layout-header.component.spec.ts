import { TestBed } from '@angular/core/testing';
import { LayoutHeaderComponent } from './layout-header.component';

describe('LayoutHeaderComponent', () => {
  // REDACTADO: los numeros usados por estos tests son ejemplos sinteticos; aqui
  // irian numeros reales de cliente o servicio en pruebas privadas.
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutHeaderComponent],
    }).compileComponents();
  });

  it('should hide mock buttons when showMock is false', () => {
    const fixture = TestBed.createComponent(LayoutHeaderComponent);
    fixture.componentRef.setInput('theme', 'light');
    fixture.componentRef.setInput('showMock', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.mock-toggle')).toBeNull();
    expect(fixture.nativeElement.querySelector('.mock-clear')).toBeNull();
  });

  it('should render mock controls and emit their events when showMock is true', () => {
    const fixture = TestBed.createComponent(LayoutHeaderComponent);
    fixture.componentRef.setInput('theme', 'light');
    fixture.componentRef.setInput('showMock', true);
    fixture.componentRef.setInput('isMockConversationLoaded', true);
    fixture.detectChanges();

    spyOn(fixture.componentInstance.loadMockConversation, 'emit');
    spyOn(fixture.componentInstance.clearConversation, 'emit');

    (fixture.nativeElement.querySelector('.mock-toggle') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('.mock-clear') as HTMLButtonElement).click();

    expect(fixture.componentInstance.loadMockConversation.emit).toHaveBeenCalled();
    expect(fixture.componentInstance.clearConversation.emit).toHaveBeenCalled();
  });

  it('should toggle runtime filters and emit added numbers from the form', () => {
    const fixture = TestBed.createComponent(LayoutHeaderComponent);
    fixture.componentRef.setInput('theme', 'light');
    fixture.detectChanges();

    spyOn(fixture.componentInstance.addPhoneNumber, 'emit');
    spyOn(fixture.componentInstance.addServiceNumber, 'emit');

    (fixture.nativeElement.querySelector('.runtime-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    const inputs = fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    const buttons = fixture.nativeElement.querySelectorAll('.runtime-input-row button') as NodeListOf<HTMLButtonElement>;

    inputs[0].value = '600111222';
    inputs[1].value = '910000000';
    buttons[0].click();
    buttons[1].click();

    expect(fixture.componentInstance.addPhoneNumber.emit).toHaveBeenCalledWith('600111222');
    expect(fixture.componentInstance.addServiceNumber.emit).toHaveBeenCalledWith('910000000');
    expect(inputs[0].value).toBe('');
    expect(inputs[1].value).toBe('');
  });

  it('should emit chip removal events for runtime numbers', () => {
    const fixture = TestBed.createComponent(LayoutHeaderComponent);
    fixture.componentRef.setInput('theme', 'dark');
    fixture.componentRef.setInput('runtimePhoneNumbers', ['600111222']);
    fixture.componentRef.setInput('runtimeServiceNumbers', ['910000000']);
    fixture.detectChanges();

    spyOn(fixture.componentInstance.removePhoneNumber, 'emit');
    spyOn(fixture.componentInstance.removeServiceNumber, 'emit');

    (fixture.nativeElement.querySelector('.runtime-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    const removableChips = fixture.nativeElement.querySelectorAll('.runtime-chip.removable') as NodeListOf<HTMLButtonElement>;
    removableChips[0].click();
    removableChips[1].click();

    expect(fixture.componentInstance.removePhoneNumber.emit).toHaveBeenCalledWith('600111222');
    expect(fixture.componentInstance.removeServiceNumber.emit).toHaveBeenCalledWith('910000000');
  });
});
