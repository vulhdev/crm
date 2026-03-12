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

export interface JwtPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  accessToken: string;
  refreshToken: string;
}
