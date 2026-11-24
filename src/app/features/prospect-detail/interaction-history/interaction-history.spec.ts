import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InteractionHistory } from './interaction-history';

describe('InteractionHistory', () => {
  let component: InteractionHistory;
  let fixture: ComponentFixture<InteractionHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InteractionHistory],
    }).compileComponents();

    fixture = TestBed.createComponent(InteractionHistory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
