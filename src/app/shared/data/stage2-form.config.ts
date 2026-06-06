import { STAGE1_STEPS, STAGE1_STEP_COUNT } from './form-steps.config';

export interface ScreeningQuestion {
  key: string;
  label: string;
  help?: string;
}

export interface Stage2ScreeningStep {
  id: string;
  title: string;
  icon: string;
  sectionNumber: number;
  description: string;
  screeningRequirement?: string;
  questions: ScreeningQuestion[];
  sectionCommentsKey?: string;
  sectionStatusKey?: string;
}

export const STAGE2_SCREENING_STEPS: Stage2ScreeningStep[] = [
  {
    id: 's4',
    title: 'Contribution to GCF',
    icon: '🎯',
    sectionNumber: 4,
    description: 'Information on how the institution will contribute to the mandate of the Fund.',
    screeningRequirement: 'The applicant provides information on how it will contribute to the mandate of the Fund.',
    questions: [
      {
        key: 's4_1_1',
        label: '4.1.1 The applicant has a policy or strategy outlining its approach to climate change.',
        help: 'Operationalizes Board Decision B.10/06, paragraph (j).'
      },
      {
        key: 's4_2_1',
        label: '4.2.1 The international access entity intends to strengthen capacities of subnational, national and regional entities to programme with GCF.',
        help: 'Applicable for international access entities. Operationalizes Board Decision B.10/06, paragraph (i).'
      }
    ]
  },
  {
    id: 's5',
    title: 'Corporate Governance',
    icon: '🏛️',
    sectionNumber: 5,
    description: 'Corporate governance arrangements and internal control framework.',
    screeningRequirement: 'The applicant ensures corporate governance arrangements and actors are in place with roles and responsibilities defined.',
    questions: [
      { key: 's5_1_1', label: '5.1.1 The applicant has internal governance and oversight bodies with transparent rules regarding appointment, termination and remuneration.' },
      { key: 's5_1_2', label: '5.1.2 The applicant has an organization chart showing key areas of authority, responsibility, and reporting/delegation lines.' },
      { key: 's5_1_3', label: '5.1.3 The applicant has a process to set objectives and ensure they align with the mission of the entity.' },
      { key: 's5_2_1a', label: '5.2.1(a) The applicant has an independent audit committee or comparable body with appropriate terms of reference.' },
      { key: 's5_2_2a', label: '5.2.2(a) Internal audit function has a charter approved by the governing body.' },
      { key: 's5_2_3a', label: '5.2.3(a) The applicant has appointed an external auditor in accordance with applicable regulations.' },
      { key: 's5_3_1', label: '5.3.1 The applicant ensures segregation of incompatible duties across settlement, procurement, risk management, and accounting.' }
    ]
  },
  {
    id: 's6',
    title: 'Financial Management',
    icon: '💰',
    sectionNumber: 6,
    description: 'Financial inputs and outputs are properly accounted for and reported transparently.',
    screeningRequirement: 'The applicant ensures financial inputs and outputs are properly accounted for, reported and administered transparently.',
    questions: [
      { key: 's6_1', label: '6.1 The applicant prepares financial statements in accordance with internationally recognized accounting standards (IFRS, IPSAS, or equivalent).' },
      { key: 's6_2', label: '6.2 The applicant prepares a complete set of financial statements (balance sheet, income statement, cash flows, equity changes, policies and notes).' },
      { key: 's6_3', label: '6.3 The applicant reports financial information to relevant oversight bodies and stakeholders in a timely manner.' },
      { key: 's6_4', label: '6.4 The applicant uses accounting systems capable of tracking GCF funds separately and handling international transactions.' },
      { key: 's6_5', label: '6.5 The applicant can receive, hold and disburse funds in GCF operational currencies (USD, EUR, JPY, GBP).' }
    ]
  },
  {
    id: 's7',
    title: 'Procurement',
    icon: '📦',
    sectionNumber: 7,
    description: 'Procurement policies and procedures for goods, works and services.',
    screeningRequirement: 'The applicant has written procurement policies and procedures that ensure fair, transparent and competitive processes.',
    questions: [
      { key: 's7_1', label: '7.1 The applicant has written procurement policies and procedures covering the full procurement cycle.' },
      { key: 's7_2', label: '7.2 The applicant has guidelines for procurement of goods, works and services with appropriate thresholds and approval levels.' }
    ]
  },
  {
    id: 's8',
    title: 'Integrity',
    icon: '🛡️',
    sectionNumber: 8,
    description: 'Code of ethics, anti-corruption, investigation function and AML/CFT policies.',
    screeningRequirement: 'The applicant has policies and capacity to prevent and address financial mismanagement, malpractice and prohibited practices.',
    questions: [
      { key: 's8_1_1', label: '8.1.1 The applicant has a Code of Ethics or equivalent policy applicable to all staff and governing bodies.' },
      { key: 's8_1_2', label: '8.1.2 The applicant makes all staff and governing body members aware of the Code of Ethics.' },
      { key: 's8_2_1', label: '8.2.1 The applicant\'s leadership demonstrates commitment to preventing financial mismanagement and prohibited practices.' },
      { key: 's8_2_2', label: '8.2.2 The applicant has policies or procedures to prevent, detect and respond to fraud and corruption.' },
      { key: 's8_3_1', label: '8.3.1 The investigation function can operate independently with adequate resources and authority.' },
      { key: 's8_4_1', label: '8.4.1 The applicant has in place AML/CFT policies and procedures aligned with applicable regulations.' }
    ]
  },
  {
    id: 's9',
    title: 'Project Design',
    icon: '📐',
    sectionNumber: 9,
    description: 'Capacity to identify, formulate and appraise projects or programmes.',
    screeningRequirement: 'The applicant is able to identify, formulate and appraise projects within its jurisdiction with appropriate fiduciary oversight.',
    questions: [
      { key: 's9_1_1', label: '9.1.1 The applicant has proven track record in identifying and designing projects or programmes using appropriate and transparent procedures.' },
      { key: 's9_1_2', label: '9.1.2 The applicant has capacity to clearly state project objectives and outcomes with KPIs, baselines and targets.' },
      { key: 's9_1_3', label: '9.1.3 The applicant is able to examine and incorporate technical, financial, economic, legal, environmental, social and climate change aspects.' },
      { key: 's9_1_4', label: '9.1.4 The applicant has fiduciary oversight procedures to ensure quality of the appraisal process.' },
      { key: 's9_2_1', label: '9.2.1 The applicant has appropriate registration/licensing by a financial oversight body (if on-lending/blending applies).', help: 'Only applicable if the applicant intends to use financial instruments other than grants.' }
    ]
  },
  {
    id: 's10',
    title: 'ESS Management',
    icon: '🌱',
    sectionNumber: 10,
    description: 'Environmental and Social Management System (ESMS) and due diligence.',
    screeningRequirement: 'The applicant has an ESMS with capacity to manage environmental and social risks of GCF-financed activities.',
    questions: [
      { key: 's10_1_1', label: '10.1.1 The applicant has a policy or ESMS outlining its approach to managing environmental and social risks.' },
      { key: 's10_1_2', label: '10.1.2 The applicant\'s policy/ESMS includes procedures for categorization, assessment and management of E&S risks.' },
      { key: 's10_1_3', label: '10.1.3 The applicant has relevant E&S expertise and capacity proportionate to the size and nature of the entity.' },
      { key: 's10_2_1', label: '10.2.1 The applicant has a documented E&S due diligence process for project screening and appraisal.' },
      { key: 's10_2_2', label: '10.2.2 The applicant has track record in conducting E&S assessments for projects in the past three years.' }
    ]
  },
  {
    id: 's11',
    title: 'Grievance Redress',
    icon: '⚖️',
    sectionNumber: 11,
    description: 'Accessible mechanism to receive and handle complaints and grievances.',
    screeningRequirement: 'The applicant has an accessible and legitimate institutional mechanism to receive and handle complaints related to GCF-financed activities.',
    questions: [
      { key: 's11_1', label: '11.1 The applicant has an accessible and legitimate Independent Grievance Redress Mechanism to receive, screen, assess and address grievances from third parties.' }
    ]
  },
  {
    id: 's12',
    title: 'Indigenous People',
    icon: '🤝',
    sectionNumber: 12,
    description: 'Commitment to comply with the GCF Indigenous Peoples Policy.',
    screeningRequirement: 'The applicant demonstrates awareness and commitment within the ESMS to meet the requirements of the Indigenous Peoples Policy.',
    sectionCommentsKey: 's12_comments',
    sectionStatusKey: 's12_status',
    questions: [
      { key: 's12_1', label: '12.1 — The applicant demonstrates awareness at the accreditation stage and commitment within the ESMS to meet the requirements of and comply with the Indigenous Peoples Policy at the funded activity stage.' }
    ]
  },
  {
    id: 's13',
    title: 'Gender',
    icon: '👥',
    sectionNumber: 13,
    description: 'Gender policy and capacity for gender mainstreaming.',
    screeningRequirement: 'The applicant has a gender policy/strategy and action plan aligned with the GCF Updated Gender Policy.',
    sectionCommentsKey: 's13_comments',
    sectionStatusKey: 's13_status',
    questions: [
      { key: 's13_1', label: '13.1 — The applicant has a gender policy/strategy and action plan aligned with the principles and requirements of the GCF updated Gender Policy.' }
    ]
  }
];

export interface WizardNavGroup {
  id: string;
  label: string;
  steps: WizardNavItem[];
}

export interface WizardNavItem {
  index: number;
  id: string;
  title: string;
  icon: string;
  subtitle?: string;
  group: 'stage1' | 'stage2';
}

export function buildWizardNav(): WizardNavGroup[] {
  const stage1Items: WizardNavItem[] = STAGE1_STEPS.map((step, index) => ({
    index,
    id: step.id,
    title: step.title,
    icon: step.icon,
    subtitle: step.subtitle,
    group: 'stage1'
  }));

  const stage2Items: WizardNavItem[] = STAGE2_SCREENING_STEPS.map((step, i) => ({
    index: STAGE1_STEP_COUNT + i,
    id: step.id,
    title: step.title,
    icon: step.icon,
    subtitle: `Section ${step.sectionNumber}`,
    group: 'stage2'
  }));

  return [
    { id: 'stage1', label: 'Pre-Screening (Stage 1)', steps: stage1Items },
    { id: 'stage2', label: 'Accreditation Application (Stage 2)', steps: stage2Items }
  ];
}

export const TOTAL_WIZARD_STEPS = STAGE1_STEP_COUNT + STAGE2_SCREENING_STEPS.length;
