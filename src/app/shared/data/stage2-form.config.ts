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
    screeningRequirement: 'The applicant provides information on how it will contribute to the mandate of the Fund (e.g., policy or strategy on climate change/green growth/paradigm shift in place).',
    questions: [
      {
        key: 's4_1_1',
        label: '4.1.1 The applicant has a policy or strategy outlining its approach to climate change.',
        help: 'This requirement is to operationalize the Board Decision B.10/06, paragraph (j): "Reaffirms that information on how the entity will contribute to the mandate of the Fund and any information considered material, particularly information with potential reputational risks to the Fund, shall be provided in the recommendation of the Accreditation Panel to the Board".'
      },
      {
        key: 's4_2_1',
        label: '4.2.1 The international access entity intends to strengthen capacities of, or otherwise support, subnational, national and regional entities to programme with GCF in order to enhance country ownership.',
        help: 'This requirement is to operationalize the Board Decision B.10/06, paragraph (i): "Further decides that, recalling decision B.08/03, all international entities, as an important consideration of their accreditation application, shall indicate how they intend to strengthen capacities of, or otherwise support, potential subnational, national and regional entities to meet, at the earliest opportunity, the accreditation requirements of the Fund in order to enhance country ownership and that they report annually on these actions".'
      }
    ]
  },
  {
    id: 's5',
    title: 'Corporate Governance',
    icon: '🏛️',
    sectionNumber: 5,
    description: 'Corporate governance arrangements and internal control framework.',
    screeningRequirement: 'The applicant ensures that corporate governance arrangements and actors are in place with roles and responsibilities defined and is able to demonstrate a track record of effective and efficient organizational management in line with its mission and objectives.',
    questions: [
      { key: 's5_1_1', label: '5.1.1 The applicant has internal governance and oversight bodies. The applicant has transparent rules regarding the appointment, termination and remuneration of such bodies.' },
      { key: 's5_1_2', label: '5.1.2 The applicant has an organization chart showing the entity’s key areas of authority, responsibility, and reporting/delegation lines.' },
      { key: 's5_1_3', label: '5.1.3 The applicant has a process to set objectives and ensure the chosen objectives support and align with the mission of the entity.' },
      { key: 's5_2_1a', label: '5.2.1 (a) The applicant has an independent audit committee or comparable body that oversees the internal audit function and the external audit firm regarding financial statements, control systems, and reporting.' },
      { key: 's5_2_1b', label: '5.2.1 (b) Audit committee or comparable body is guided by written terms of reference covering membership, duties, authority, accountability, and meeting frequency.' },
      { key: 's5_2_2a', label: '5.2.2 (a) Internal audit function has a documented charter, formally approved by senior management and audit committee, outlining its purpose, functions, and accountability.' },
      { key: 's5_2_2b', label: '5.2.2 (b) Internal audit function operates in accordance with current internationally recognized standards (e.g., Institute of Internal Auditors).' },
      { key: 's5_2_2c', label: '5.2.2 (c) Internal auditors adhere to ethical principles of integrity, objectivity, confidentiality, and competency, supported by legal arrangements.' },
      { key: 's5_2_2d', label: '5.2.2 (d) Internal audit function is independent and led by a designated officer with functional independence, reporting at a level that enables objective performance of duties.' },
      { key: 's5_2_2e', label: '5.2.2 (e) Internal audit function has a documented annual planning process using a risk-based methodology aligned with organizational goals.' },
      { key: 's5_2_3a', label: '5.2.3 (a) The applicant has appointed an independent external audit firm or organization.' },
      { key: 's5_2_3b', label: '5.2.3 (b) External audits by public inspection bodies are conducted periodically and governed by formal terms of reference ensuring independence and impartiality.' },
      { key: 's5_2_3c', label: '5.2.3 (c) The applicant ensures that an annual audit opinion on financial statements and GCF-administered resources is issued by the external auditor and made public.' },
      { key: 's5_2_3d', label: '5.2.3 (d) External auditor provides regular reports on accounting systems, internal controls, and management; reviewed annually by the audit committee or comparable governance body.' },
      { key: 's5_3_1', label: '5.3.1 The applicant ensures effectiveness and efficiency of operations.' },
      { key: 's5_3_2', label: '5.3.2 The applicant ensures reliability of financial reporting.' },
      { key: 's5_3_3', label: '5.3.3 The applicant ensures compliance with applicable laws and regulations.' },
      { key: 's5_3_4', label: '5.3.4 The applicant has a documented control framework with clearly defined roles for management, internal auditors, governance bodies, and other personnel.' },
      { key: 's5_3_5', label: '5.3.5 Control framework covers control environment, risk assessment, control activities, monitoring, and information sharing procedures.' },
      { key: 's5_3_6', label: '5.3.6 The applicant\'s control framework defines roles and responsibilities for fiscal agents and fiduciary trustees.' },
      { key: 's5_3_7', label: '5.3.7 The applicant has institutional risk-assessment processes to identify, assess, and respond to risks across financial management areas.' },
      { key: 's5_3_8', label: '5.3.8 Control framework guides financial management. The applicant has procedures to identify and assess internal controls annually across budgeting, accounting, internal control, funds flow, financial reporting, and auditing.' },
      { key: 's5_3_9', label: '5.3.9 The applicant has oversight and monitoring of procurement, supported by a risk management process to identify and address issues affecting objectives.' },
      { key: 's5_3_10', label: '5.3.10 The applicant maintains segregation of incompatible duties and regularly reviews related duties across settlement, procurement, risk management, and accounting.' }
    ]
  },
  {
    id: 's6',
    title: 'Financial Management',
    icon: '💰',
    sectionNumber: 6,
    description: 'Financial inputs and outputs are properly accounted for and reported transparently.',
    screeningRequirement: 'The applicant ensures that financial inputs and outputs are properly accounted for, reported and administered transparently in accordance with pertinent regulations and laws, and with the capacity for international transactions.',
    questions: [
      { key: 's6_1', label: '6.1 The applicant prepares financial statements in accordance with internationally recognized accounting standards (e.g., IFRS, IPSAS, or equivalent).' },
      { key: 's6_2', label: '6.2 The applicant prepares a complete set of financial statements that includes: a) Statement of financial position/balance sheet, b) Statement of financial performance/ income statement, c) Statement of changes in financial position or reserves/changes in equity or reserves, d) Statement of cash flows, e) Description of accounting policies and framework used, f) Notes and disclosures explaining the basis of preparation and specific accounting policies.' },
      { key: 's6_3', label: '6.3 The applicant reports financial statements periodically and consistently, enabling comparison across reporting periods.' },
      { key: 's6_4', label: '6.4 The applicant uses accounting and financial systems aligned with recognized principles and adapted to its operational complexity.' },
      { key: 's6_5', label: '6.5 The applicant can receive international payments from the Fund\'s Trustee (GCF) and to make payments to the Fund\'s Trustee (GCF).' }
    ]
  },
  {
    id: 's7',
    title: 'Procurement',
    icon: '📦',
    sectionNumber: 7,
    description: 'Procurement policies and procedures for goods, works and services.',
    screeningRequirement: 'The applicant ensures that procurement practices follow formal standards, guidelines and systems based on widely recognized processes, with specific guidelines for different procurement types, while promoting economy, efficiency and accountability.',
    questions: [
      { key: 's7_1', label: '7.1 The applicant has written procurement instructions, promoting economy and efficiency.' },
      { key: 's7_2', label: '7.2 The applicant has guidelines for different types of procurement, such as consultants, contractors and service providers.' }
    ]
  },
  {
    id: 's8',
    title: 'Integrity',
    icon: '🛡️',
    sectionNumber: 8,
    description: 'Code of ethics, anti-corruption, whistleblower protection and investigation function.',
    screeningRequirement: 'The applicant defines and adheres to ethical standards that promote full transparency and accountability, to be upheld by employees and those contracted or functionally related to the organization. The applicant is committed, as an organization, to maintaining the highest levels of integrity/accountability and to preventing and combating prohibited practices in the implementation of funded projects. The applicant is committed to protecting whistle-blowers, providing publicly accessible avenues for confidential reporting of allegations, and it has, or commits to rely on, an objective investigation function that can capably and professionally investigate allegations of prohibited practices in Fund-related activity. The applicant has capacity and processes to conduct due diligence of prohibited practices (which may include screening against financial sanctions of the United Nations Security Council) on potential or existing counterparties with which it engages, including executing entities, implementing entities, or any other entity or person involved in project implementation, and to maintain/retain relevant records.',
    questions: [
      { key: 's8_1_1', label: '8.1.1 The applicant has a Code of Ethics or an alternative set of management policies or provisions, defining: - the ethical standards to be upheld, including transparency and accountability; - the parties required to adhere to the standards (incl. governance bodies, employees, consultants and independent experts).' },
      { key: 's8_1_2', label: '8.1.2 The applicant makes aware all individuals with a functional and/or contractual relationship to the organizations of such Codes of Ethics or equivalent policies/provisions.' },
      { key: 's8_1_3', label: '8.1.3 The applicant has in place an ethics committee or has allocated such functions to another relevant governance body within the organization.' },
      { key: 's8_2_1', label: '8.2.1 The applicant’s leadership or governing bodies have clearly communicated a zero-tolerance policy towards fraud, financial misconduct and other Prohibited Practices. The policy applies to staff, consultants, contractors, and any other parties involved in the applicant’s operations.' },
      { key: 's8_2_2', label: '8.2.2 The applicant has policies or mechanisms for protecting whistlebreakers and has clear and publicly-accessible ways for people to confidentially report suspected ethics violations, misconduct, or other prohibited practices.' },
      { key: 's8_2_3', label: '8.2.3 The applicant has an independent and objective investigation function that can capably and professionally investigate allegations of Prohibited Practices and staff misconduct.' },
      { key: 's8_2_4', label: '8.2.4 The applicant has policies that promote organisational culture conducive to fairness, accountability and full transparency across the organization’s activities and operations.' },
      { key: 's8_3_1', label: '8.3.1 The investigation function can capably and professionally investigate allegations and is headed by an officer who reports to a level of the organization that allows the investigation function to fulfil its responsibilities objectively and independently.' },
      { key: 's8_3_2', label: '8.3.2 The investigation function has terms of reference that describe the purpose, authority, independence and accountability of the function.' },
      { key: 's8_3_3', label: '8.3.3 The investigation function has published formal guidelines.' }
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
    screeningRequirement: 'The applicant has a functional, inclusive, accountable, participatory and transparent environmental and social management system (ESMS) with commitment through a policy and effective framework to identify, assess, manage, and monitor environmental and social risks and impacts associated with an entity’s operations, projects or investments commensurate with the risk category. The applicant demonstrates commitment, a track record and consistency of the systems and approaches for environmental and social due diligence commensurate with the relevant risk category.',
    questions: [
      { key: 's10_1_1', label: '10.1.1 The applicant has a policy mandated by its highest decision-making body addressing E&S risks, impacts and safeguarding.' },
      { key: 's10_1_2', label: '10.1.2 The applicant\'s policy/ESMS clearly states the ESS standards the applicant adheres to and how they compare with the GCF Interim Environmental and Social Standards.' },
      { key: 's10_1_3', label: '10.1.3 The applicant has relevant principles and procedures for preventing and responding to Sexual Exploitation, Abuse and Harassment (SEAH) in accordance with the GCF revised Environmental and Social Policy.' },
      { key: 's10_2_1', label: '10.2.1 The applicant has a documented system to identify, assess, manage and monitor E&S risks and impacts against PS 1-8.' },
      { key: 's10_2_2', label: '10.2.2 The applicant has track record of identifying and assessing E&S risks and impacts.' },
      { key: 's10_2_3', label: '10.2.3 The applicant has track record of implementing monitoring and management procedures.' },
      { key: 's10_2_4', label: '10.2.4 The applicant has a system to assess and monitor its downstream partners\' E&S management.' },
      { key: 's10_2_5', label: '10.2.5 The applicant has a system to externally communicate on E&S matters and receive inquiries and feedback from third parties.' },
      { key: 's10_2_6', label: '10.2.6 The applicant has an information disclosure process.' },
      { key: 's10_2_7', label: '10.2.7 The applicant has a public consultation process.' },
      { key: 's10_3_1', label: '10.3.1 The applicant has a structure to implement E&S safeguarding, proportionate to its size and nature of activities.' },
      { key: 's10_3_2', label: '10.3.2 The applicant has documented procedures and responsibilities for E&S experts.' },
      { key: 's10_3_3', label: '10.3.3 The applicant has experts with qualifications and experience to manage E&S issues.' }
    ]
  },
  {
    id: 's11',
    title: 'Grievance Redress',
    icon: '⚖️',
    sectionNumber: 11,
    description: 'Accessible mechanism to receive and handle complaints and grievances.',
    screeningRequirement: 'The applicant has an accessible and legitimate institutional mechanism, policy and/or process to receive and handle complaints and grievances in relation to GCF-financed activities.',
    questions: [
      { key: 's11_1', label: '11.1 The applicant has an accessible and legitimate Independent Grievance Redress Mechanism to receive, screen, assess and address grievances/complaints/communications from third parties.' }
    ]
  },
  {
    id: 's12',
    title: 'Indigenous People',
    icon: '🤝',
    sectionNumber: 12,
    description: 'Commitment to comply with the GCF Indigenous Peoples Policy.',
    screeningRequirement: 'The applicant demonstrates awareness at the accreditation stage and commitment within the ESMS to meet the requirements of and comply with the Indigenous Peoples Policy at the funded activity stage.',
    sectionCommentsKey: 's12_comments',
    sectionStatusKey: 's12_status',
    questions: [
      { key: 's12_1', label: '12.1 The applicant demonstrates awareness at the accreditation stage and commitment within the ESMS to meet the requirements of and comply with the Indigenous Peoples Policy at the funded activity stage.' }
    ]
  },
  {
    id: 's13',
    title: 'Gender',
    icon: '👥',
    sectionNumber: 13,
    description: 'Gender policy and capacity for gender mainstreaming.',
    screeningRequirement: 'The applicant demonstrates gender policy, strategy or any other commitment to meet the principles and requirements of the GCF updated Gender Policy and track record of such commitment.',
    sectionCommentsKey: 's13_comments',
    sectionStatusKey: 's13_status',
    questions: [
      { key: 's13_1', label: '13.1 The applicant has a gender policy/strategy and action plan aligned with the principles and requirements of the GCF updated Gender Policy.' },
      { key: 's13_2', label: '13.2 The applicant has a process or procedure to implement its gender policy in projects/programmes in accordance with the principles and requirements of the GCF updated Gender Policy.' },
      { key: 's13_3', label: '13.3 The applicant has (a) designated expert(s) with capacity to implement its gender policy.' },
      { key: 's13_4', label: '13.4 The applicant has track record of implementing its gender policy in projects/programmes, including gender-sensitive-and-responsive indicators.' }
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
