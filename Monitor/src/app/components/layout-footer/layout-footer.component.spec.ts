import { TestBed } from '@angular/core/testing';
import { LayoutFooterComponent } from './layout-footer.component';

describe('LayoutFooterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutFooterComponent],
    }).compileComponents();
  });

  it('should render the project title and author', () => {
    const fixture = TestBed.createComponent(LayoutFooterComponent);
    fixture.componentRef.setInput('projectTitle', 'Proyecto Demo');
    fixture.componentRef.setInput('author', 'Alvaro');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Proyecto Demo');
    expect(fixture.nativeElement.textContent).toContain('Alvaro');
    expect(fixture.nativeElement.querySelector('.footer-logo')).not.toBeNull();
  });
});
