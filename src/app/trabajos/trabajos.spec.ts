import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Trabajos } from './trabajos';

describe('Trabajos', () => {
  let component: Trabajos;
  let fixture: ComponentFixture<Trabajos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Trabajos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Trabajos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
