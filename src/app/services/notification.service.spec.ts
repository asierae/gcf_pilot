import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add and dismiss notifications', () => {
    service.error('Test error');
    expect(service.notifications().length).toBe(1);
    expect(service.notifications()[0].message).toBe('Test error');

    service.dismiss(service.notifications()[0].id);
    expect(service.notifications().length).toBe(0);
  });
});
