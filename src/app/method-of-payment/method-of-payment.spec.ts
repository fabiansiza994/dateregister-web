import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MethodOfPayment } from './method-of-payment';

describe('MethodOfPayment', () => {
  let component: MethodOfPayment;
  let fixture: ComponentFixture<MethodOfPayment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MethodOfPayment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MethodOfPayment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
