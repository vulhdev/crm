export type CustomerStatus = 'Lead' | 'Active' | 'Churned' | 'Archived';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  status: CustomerStatus;
  lastContactDate: string; // ISO date string
  notes: string;
  createdAt: string;       // ISO timestamp
}

export interface CreateCustomerDto extends Omit<Customer, 'id' | 'createdAt'> {}
export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export interface GoogleUser {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  accessToken: string;
  refreshToken: string;
}

export type CrmRole = 'Admin' | 'Sales Manager' | 'Sales Rep';

export type UserStatus = 'Active' | 'Deactivated';

export type InvitationStatus = 'Pending' | 'Consumed' | 'Revoked';

export interface CrmUser {
  id: string;
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: CrmRole;
  status: UserStatus;
  teamId?: string;
  sheetId?: string;
  sheetOwnership?: 'user' | 'service_account';
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  token: string;
  email: string;
  role: CrmRole;
  invitedBy: string;
  firstName?: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface Team {
  id: string;
  name: string;
  managerId?: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JwtPayload {
  sub: string;
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: CrmRole;
}
