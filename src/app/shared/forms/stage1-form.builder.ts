import { AbstractControl, FormBuilder, Validators } from '@angular/forms';

/**
 * The full set of pre-screening controls. This is the single source of truth
 * for both the standalone /stage1 wizard and the pre-screening part of the
 * Stage 2 full accreditation form.
 */
export function addStage1FormControls(fb: FormBuilder): Record<string, unknown> {
  return {
    // Step 0: Access Modality
    organizationType: ['', Validators.required],
    nominationLetterAttached: [''],
    nominationLetterFiles: [[]],
    ndaEngagementDescription: [''],
    consultationMethod: ['online'],
    consultationCountry: [''],
    consultationContactPerson: [''],
    consultationMode: [''],
    consultationDates: [''],
    ndaInstitution: [''],
    ndaContactPerson: [''],
    ndaContactInfo: [''],
    consultationSummary: [''],
    consultationSummaryFiles: [[]],
    noConsultation: [false],

    // Step 1: General Information
    applicantName: ['', Validators.required],
    applicantAcronym: ['', Validators.required],
    legalAddress: ['', Validators.required],
    registeredAddress: ['', Validators.required],
    operationalAddress: [''],
    website: ['', Validators.required],
    primarySalutation: [''],
    primaryContactName: ['', Validators.required],
    primaryContactTitle: [''],
    primaryContactEmail: ['', [Validators.required, Validators.email]],
    primaryContactPhone: ['', Validators.required],
    secondarySalutation: [''],
    secondaryContactName: [''],
    secondaryContactTitle: [''],
    secondaryContactEmail: ['', Validators.email],
    secondaryContactPhone: [''],
    scopeOfOperations: ['', Validators.required],
    scopeOfOperationsOther: [''],
    typeOfEntity: ['', Validators.required],
    typeOfEntityOther: [''],
    areaOfOperation: fb.group({
      developingCountries: [false],
      leastDevelopedCountries: [false],
      smallIslandDevelopingStates: [false],
      developedCountries: [false],
    }),
    countryOfOperation: ['', Validators.required],
    hqLocation: ['', Validators.required],
    incorporationCountry: [''],
    // Legacy key kept so old payloads and organization profiles still prefill.
    headquartersCountry: [''],
    contactEvidenceFiles: [[]],
    groupedOrganization: ['', Validators.required],
    groupDetails: [''],

    // Step 2: Legal Status & Eligibility
    hasLegalPersonality: ['', Validators.required],
    hasLegalCapacity: ['', Validators.required],
    legalSupportingDocumentsFiles: [[]],
    legalOpinionFiles: [[]],
    ownershipFiles: [[]],
    canReceiveFundsDirectly: ['', Validators.required],
    canHandleGCFCurrencies: ['', Validators.required],
    canMaintainInterestBearingAccount: ['', Validators.required],
    canUndertakeFullCycle: ['', Validators.required],
    fullCycleDescription: [''],
    hasFiduciaryCapacity: ['', Validators.required],
    hasESSCapacity: ['', Validators.required],
    hasGenderCapacity: ['', Validators.required],
    hasMonitoringCapacity: ['', Validators.required],
    hasInvestmentCriteria: ['', Validators.required],
    investmentCriteria: fb.group({
      impactPotential: [false],
      paradigmShift: [false],
      sustainableDevelopment: [false],
      needsOfRecipient: [false],
      countryOwnership: [false],
      efficiencyEffectiveness: [false],
    }),

    // Step 3: Additional Information
    businessMandate: ['', Validators.required],
    hasClimateFinanceExperience: ['', Validators.required],
    climateFinanceOverview: [''],
    trackRecordEvidenceFiles: [[]],
    hasTrackRecordInRegion: ['', Validators.required],
    trackRecordOverview: [''],
    financingInstruments: ['', Validators.required],
    instrumentExperience: [''],
    climatePriorities: ['', Validators.required],
    strategicAreas: fb.group({
      energyAccess: [false],
      lowEmissionTransport: [false],
      buildingsCitiesIndustries: [false],
      forestsLandUse: [false],
      healthFoodWater: [false],
      livelihoods: [false],
      ecosystems: [false],
      infrastructure: [false],
    }),
    crossCutting: fb.group({
      privateSector: [false],
      naturePositive: [false],
      justTransition: [false],
      climateResilient: [false],
      genderResponsive: [false],
      supportLdcsSids: [false],
      capacityBuilding: [false],
      other: [false],
    }),
    otherCrossCutting: [''],
    fiduciaryLevel: ['', Validators.required],
    projectManagementLevel: ['', Validators.required],
    essLevel: ['', Validators.required],
    hasGrievanceMechanism: ['', Validators.required],
    grievanceMechanismLevel: [''],
    genderLevel: ['', Validators.required],
    monitoringLevel: ['', Validators.required],
    canEnsureDownstreamCompliance: ['', Validators.required],
    canMonitorCompliance: ['', Validators.required],
    riskCategory: ['', Validators.required],
    highRiskExperience: [''],
    hasESMS: ['', Validators.required],
    esmsDescription: [''],
    // The 16-column track-record table is only rendered by the full form.
    climateTrackRecord: fb.array([]),

    // Step 4: Fast-Track & Engagement
    fastTrack: ['', Validators.required],
    fastTrackInstitutions: fb.group({
      gef: [false],
      af: [false],
      euDgIntpa: [false],
      afdb: [false],
    }),
    fastTrackCredentials: [''],
    fastTrackDocumentsFiles: [[]],
    afdbCurrent: [''],
    afdbOperations: fb.array([]),
    hasReceivedReadinessSupport: ['', Validators.required],
    hasServedAsExecutingEntity: ['', Validators.required],
    executingEntityDetails: [''],
    hasServedAsDeliveryPartner: ['', Validators.required],
    hasEngagedInPSAA: ['', Validators.required],
    preparedForPartnerships: ['', Validators.required],

    // Legacy fast-track keys still present in saved payloads.
    accreditedByGEF: [false],
    accreditedByAF: [false],
    accreditedByEUDGINTPA: [false],
    fastTrackComplianceDetails: [''],
    hasSubmittedFMCA: [''],
    fastTrackAccreditationFiles: [[]],
  };
}

/**
 * "Required when visible" rules shared by the pre-screening wizard and the
 * pre-screening part of the full form. Returns functions that re-apply the
 * validators after a payload was patched without emitting events.
 */
export function watchStage1ConditionalRequirements(
  form: import('@angular/forms').FormGroup,
): Array<() => void> {
  const syncs: Array<() => void> = [];

  const bind = (
    sourceNames: string | string[],
    targetNames: string[],
    isActive: (values: Record<string, unknown>) => boolean,
  ): void => {
    const names = Array.isArray(sourceNames) ? sourceNames : [sourceNames];
    const sources = names
      .map((name) => form.get(name))
      .filter((control): control is AbstractControl => control !== null);
    if (sources.length === 0) return;

    const sync = (): void => {
      const values = Object.fromEntries(
        names.map((name) => [name, form.get(name)?.value]),
      );
      const active = isActive(values);
      for (const targetName of targetNames) {
        const target = form.get(targetName);
        if (!target) continue;
        const required = target.hasValidator(Validators.required);
        if (active && !required) target.addValidators(Validators.required);
        else if (!active && required) target.removeValidators(Validators.required);
        target.updateValueAndValidity({ emitEvent: false });
      }
    };

    for (const source of sources) source.valueChanges.subscribe(sync);
    syncs.push(sync);
    sync();
  };

  const consultationTargets = [
    'consultationCountry',
    'consultationContactPerson',
    'consultationMode',
    'consultationDates',
    'ndaInstitution',
    'ndaContactPerson',
    'ndaContactInfo',
    'consultationSummary',
  ];

  bind('groupedOrganization', ['groupDetails'], (v) => v['groupedOrganization'] === 'yes');
  bind('canUndertakeFullCycle', ['fullCycleDescription'], (v) => v['canUndertakeFullCycle'] === 'yes');
  bind('hasClimateFinanceExperience', ['climateFinanceOverview'], (v) => v['hasClimateFinanceExperience'] === 'yes');
  bind('hasTrackRecordInRegion', ['trackRecordOverview'], (v) => v['hasTrackRecordInRegion'] === 'yes');
  bind('hasServedAsExecutingEntity', ['executingEntityDetails'], (v) => v['hasServedAsExecutingEntity'] === 'yes');
  bind(
    ['organizationType', 'consultationMethod'],
    consultationTargets,
    (v) =>
      (v['organizationType'] === 'self-nominating-direct' ||
        v['organizationType'] === 'self-nominating-international') &&
      v['consultationMethod'] === 'online',
  );
  bind('fastTrackInstitutions', ['fastTrackCredentials'], (v) => {
    const institutions = (v['fastTrackInstitutions'] || {}) as Record<string, boolean>;
    return Boolean(institutions['gef'] || institutions['af'] || institutions['euDgIntpa']);
  });

  return syncs;
}
