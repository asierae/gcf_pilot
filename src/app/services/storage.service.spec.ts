import { TestBed } from '@angular/core/testing';
import { FirebaseService } from './firebase.service';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StorageService,
        {
          provide: FirebaseService,
          useValue: {
            getAllApplicants: jasmine.createSpy('getAllApplicants').and.resolveTo([]),
            getApplicantById: jasmine.createSpy('getApplicantById').and.resolveTo(null),
            createApplicantStage1: jasmine.createSpy('createApplicantStage1').and.resolveTo({}),
            createApplicantStage2: jasmine.createSpy('createApplicantStage2').and.resolveTo({}),
            deleteApplicants: jasmine.createSpy('deleteApplicants').and.resolveTo(undefined),
            updateApplicantStatus: jasmine.createSpy('updateApplicantStatus').and.resolveTo(undefined),
            updateApplicantReviewNote: jasmine.createSpy('updateApplicantReviewNote').and.resolveTo(undefined),
            markApplicantReviewSent: jasmine.createSpy('markApplicantReviewSent').and.resolveTo(undefined),
            getLatestApplicantWithStage1: jasmine.createSpy('getLatestApplicantWithStage1').and.resolveTo(null),
            getLatestApplicantWithStage2: jasmine.createSpy('getLatestApplicantWithStage2').and.resolveTo(null)
          }
        }
      ]
    });
    service = TestBed.inject(StorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
