import { Injectable } from '@angular/core';
import { NotificationService } from './notification.service';

export type UserRole = 'admin' | 'applicant';
export type UserStatus = 'active' | 'pending' | 'suspended';

export interface AppUser {
  id: string;
  username: string;
  password: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  organizationName?: string;
  linkedSubmissionIds: string[];
  createdAt: string;
}

// Hardcoded seed data — swap this array with a backend call later
const SEED_USERS: AppUser[] = [
  {
    id: 'usr-001',
    username: 'hatyja',
    password: 'asier',
    email: 'hatyja@gcf-support.org',
    role: 'admin',
    status: 'active',
    linkedSubmissionIds: [],
    createdAt: '2024-01-15T09:00:00.000Z',
  },
  {
    id: 'usr-002',
    username: 'sarah.admin',
    password: 'gcf2024',
    email: 'sarah.chen@gcf-support.org',
    role: 'admin',
    status: 'active',
    linkedSubmissionIds: [],
    createdAt: '2024-02-01T10:30:00.000Z',
  },
  {
    id: 'usr-003',
    username: 'hatyja2',
    password: 'asier',
    email: 'marcos@greenenergy.org',
    role: 'applicant',
    status: 'active',
    organizationName: 'Green Energy Corp',
    linkedSubmissionIds: ['sub-2024-001'],
    createdAt: '2024-03-10T14:00:00.000Z',
  },
  {
    id: 'usr-004',
    username: 'marcos.oliveira',
    password: 'amazon2024',
    email: 'marcos.oliveira@amazonbasin.org',
    role: 'applicant',
    status: 'active',
    organizationName: 'Amazon Basin Climate Fund',
    linkedSubmissionIds: ['sub-2024-002'],
    createdAt: '2024-03-22T11:15:00.000Z',
  },
  {
    id: 'usr-005',
    username: 'priya.sharma',
    password: '',
    email: 'priya.sharma@saclimate.in',
    role: 'applicant',
    status: 'pending',
    organizationName: 'South Asia Resilience Initiative',
    linkedSubmissionIds: ['sub-2024-003'],
    createdAt: '2024-04-05T16:45:00.000Z',
  },
  {
    id: 'usr-006',
    username: 'james.okoye',
    password: 'waga2024',
    email: 'j.okoye@waga.ng',
    role: 'applicant',
    status: 'active',
    organizationName: 'West Africa Green Alliance',
    linkedSubmissionIds: ['sub-2024-004', 'sub-2024-006'],
    createdAt: '2024-04-18T09:30:00.000Z',
  },
  {
    id: 'usr-007',
    username: 'fatima.rashid',
    password: '',
    email: 'fatima@gulfclimate.ae',
    role: 'applicant',
    status: 'pending',
    organizationName: 'Gulf Region Climate Center',
    linkedSubmissionIds: ['sub-2024-005'],
    createdAt: '2024-05-02T12:00:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class UserService {
  // In-memory store (replace with HTTP calls to backend later)
  private users: AppUser[] = SEED_USERS.map((u) => ({ ...u }));

  constructor(private notificationService: NotificationService) {}

  // ── Read ────────────────────────────────────────────────────────────────

  getUsers(): AppUser[] {
    return [...this.users];
  }

  getUserById(id: string): AppUser | undefined {
    return this.users.find((u) => u.id === id);
  }

  findByCredentials(username: string, password: string): AppUser | undefined {
    return this.users.find(
      (u) =>
        u.username === username &&
        u.password === password &&
        u.status === 'active',
    );
  }

  // ── Write ───────────────────────────────────────────────────────────────

  createUser(
    data: Omit<AppUser, 'id' | 'createdAt'>,
  ): AppUser {
    const newUser: AppUser = {
      ...data,
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.users = [...this.users, newUser];
    return newUser;
  }

  updateUser(
    id: string,
    data: Partial<Omit<AppUser, 'id' | 'createdAt'>>,
  ): AppUser | null {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    const updated = { ...this.users[index], ...data };
    this.users = [
      ...this.users.slice(0, index),
      updated,
      ...this.users.slice(index + 1),
    ];
    return updated;
  }

  deleteUser(id: string): boolean {
    const before = this.users.length;
    this.users = this.users.filter((u) => u.id !== id);
    return this.users.length < before;
  }

  // ── Activation email stub ───────────────────────────────────────────────
  // Replace with a real POST to /api/send-activation-email when backend is ready.
  sendActivationEmail(user: AppUser): void {
    console.info('[UserService] Would send activation email to', user.email);
    this.notificationService.info(
      `Activation email sent to ${user.email}. The user must follow the link to set their password.`,
    );
  }
}
