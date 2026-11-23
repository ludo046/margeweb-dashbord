import { TestBed } from '@angular/core/testing';
import { Prospects } from './prospects';

describe('Prospects', () => {
  let service: Prospects;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Prospects);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
