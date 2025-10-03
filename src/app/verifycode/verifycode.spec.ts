import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Verifycode } from './verifycode';

describe('Verifycode', () => {
  let component: Verifycode;
  let fixture: ComponentFixture<Verifycode>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Verifycode]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Verifycode);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
