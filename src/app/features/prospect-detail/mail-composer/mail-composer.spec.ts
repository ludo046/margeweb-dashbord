import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MailComposer } from './mail-composer';

describe('MailComposer', () => {
  let component: MailComposer;
  let fixture: ComponentFixture<MailComposer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MailComposer],
    }).compileComponents();

    fixture = TestBed.createComponent(MailComposer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
