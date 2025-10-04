import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsageMap } from './usage-map';

describe('UsageMap', () => {
  let component: UsageMap;
  let fixture: ComponentFixture<UsageMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsageMap]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsageMap);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
