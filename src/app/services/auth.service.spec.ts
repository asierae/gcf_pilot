import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        UserService,
        {
          provide: Router,
          useValue: { navigate: jasmine.createSpy('navigate') }
        },
        {
          provide: ApiService,
          useValue: {
            login: jasmine.createSpy('login').and.resolveTo('test-token'),
            setToken: jasmine.createSpy('setToken'),
            clearToken: jasmine.createSpy('clearToken')
          }
        }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
