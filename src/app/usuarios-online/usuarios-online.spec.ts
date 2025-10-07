import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsuariosOnline } from './usuarios-online';

describe('UsuariosOnline', () => {
  let component: UsuariosOnline;
  let fixture: ComponentFixture<UsuariosOnline>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuariosOnline]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsuariosOnline);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
