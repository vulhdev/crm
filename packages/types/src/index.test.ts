/**
 * Structural type tests for @crm/types — GitHub issue #23
 *
 * Strategy: TypeScript's static checker is the primary assertion mechanism.
 * Assigning a well-formed object literal to a typed `const` variable causes a
 * compile-time error when the interface shape is wrong, meaning the test file
 * itself will fail to compile (and therefore fail in ts-jest) when the
 * implementation is missing or incorrect.
 *
 * Runtime `expect` assertions confirm that the named exports exist and that
 * string-union members are exactly the values the contracts advertise.
 */

import type {
  // Pre-existing — must remain exported
  CustomerStatus,
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  GoogleUser,
  // Updated
  JwtPayload,
  // New
  CrmRole,
  UserStatus,
  InvitationStatus,
  CrmUser,
  Invitation,
  Team,
} from './index';

// ---------------------------------------------------------------------------
// 1. CrmRole type alias
// ---------------------------------------------------------------------------

describe('CrmRole type alias', () => {
  it('accepts "Admin" as a valid CrmRole value', () => {
    const role: CrmRole = 'Admin';
    expect(role).toBe('Admin');
  });

  it('accepts "Sales Manager" as a valid CrmRole value', () => {
    const role: CrmRole = 'Sales Manager';
    expect(role).toBe('Sales Manager');
  });

  it('accepts "Sales Rep" as a valid CrmRole value', () => {
    const role: CrmRole = 'Sales Rep';
    expect(role).toBe('Sales Rep');
  });

  it('is exported from the package entry point', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exports = require('./index') as Record<string, unknown>;
    // CrmRole is a type alias — it has no runtime value, but the module must
    // at least compile with it referenced. We verify no import error occurred
    // by checking that the module loaded without throwing.
    expect(exports).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. UserStatus type alias
// ---------------------------------------------------------------------------

describe('UserStatus type alias', () => {
  it('accepts "Active" as a valid UserStatus value', () => {
    const status: UserStatus = 'Active';
    expect(status).toBe('Active');
  });

  it('accepts "Deactivated" as a valid UserStatus value', () => {
    const status: UserStatus = 'Deactivated';
    expect(status).toBe('Deactivated');
  });
});

// ---------------------------------------------------------------------------
// 3. InvitationStatus type alias
// ---------------------------------------------------------------------------

describe('InvitationStatus type alias', () => {
  it('accepts "Pending" as a valid InvitationStatus value', () => {
    const status: InvitationStatus = 'Pending';
    expect(status).toBe('Pending');
  });

  it('accepts "Consumed" as a valid InvitationStatus value', () => {
    const status: InvitationStatus = 'Consumed';
    expect(status).toBe('Consumed');
  });

  it('accepts "Revoked" as a valid InvitationStatus value', () => {
    const status: InvitationStatus = 'Revoked';
    expect(status).toBe('Revoked');
  });
});

// ---------------------------------------------------------------------------
// 4. CrmUser interface
// ---------------------------------------------------------------------------

describe('CrmUser interface', () => {
  it('accepts a fully-populated CrmUser object with all required fields', () => {
    const user: CrmUser = {
      id: 'usr-001',
      googleId: 'google-sub-abc123',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'Admin',
      status: 'Active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(user.id).toBe('usr-001');
    expect(user.googleId).toBe('google-sub-abc123');
    expect(user.email).toBe('alice@example.com');
    expect(user.firstName).toBe('Alice');
    expect(user.lastName).toBe('Smith');
    expect(user.role).toBe('Admin');
    expect(user.status).toBe('Active');
    expect(user.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(user.updatedAt).toBe('2026-03-15T12:00:00.000Z');
  });

  it('accepts a CrmUser with optional teamId present', () => {
    const user: CrmUser = {
      id: 'usr-002',
      googleId: 'google-sub-def456',
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Jones',
      role: 'Sales Rep',
      status: 'Active',
      teamId: 'team-007',
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(user.teamId).toBe('team-007');
  });

  it('accepts a CrmUser without optional teamId (field is optional)', () => {
    const user: CrmUser = {
      id: 'usr-003',
      googleId: 'google-sub-ghi789',
      email: 'carol@example.com',
      firstName: 'Carol',
      lastName: 'White',
      role: 'Sales Manager',
      status: 'Deactivated',
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(user.teamId).toBeUndefined();
  });

  it('accepts a CrmUser with optional sheetId present', () => {
    const user: CrmUser = {
      id: 'usr-004',
      googleId: 'google-sub-jkl012',
      email: 'dave@example.com',
      firstName: 'Dave',
      lastName: 'Brown',
      role: 'Sales Rep',
      status: 'Active',
      sheetId: 'sheet-abc',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(user.sheetId).toBe('sheet-abc');
  });

  it('accepts a CrmUser without optional sheetId (field is optional)', () => {
    const user: CrmUser = {
      id: 'usr-005',
      googleId: 'google-sub-mno345',
      email: 'eve@example.com',
      firstName: 'Eve',
      lastName: 'Taylor',
      role: 'Sales Rep',
      status: 'Active',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(user.sheetId).toBeUndefined();
  });

  it('accepts "user" as a valid sheetOwnership value', () => {
    const user: CrmUser = {
      id: 'usr-006',
      googleId: 'google-sub-pqr678',
      email: 'frank@example.com',
      firstName: 'Frank',
      lastName: 'Davis',
      role: 'Admin',
      status: 'Active',
      sheetOwnership: 'user',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(user.sheetOwnership).toBe('user');
  });

  it('accepts "service_account" as a valid sheetOwnership value', () => {
    const user: CrmUser = {
      id: 'usr-007',
      googleId: 'google-sub-stu901',
      email: 'grace@example.com',
      firstName: 'Grace',
      lastName: 'Wilson',
      role: 'Sales Manager',
      status: 'Active',
      sheetOwnership: 'service_account',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(user.sheetOwnership).toBe('service_account');
  });

  it('accepts a CrmUser without optional sheetOwnership (field is optional)', () => {
    const user: CrmUser = {
      id: 'usr-008',
      googleId: 'google-sub-vwx234',
      email: 'hank@example.com',
      firstName: 'Hank',
      lastName: 'Moore',
      role: 'Sales Rep',
      status: 'Active',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(user.sheetOwnership).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Invitation interface
// ---------------------------------------------------------------------------

describe('Invitation interface', () => {
  it('accepts a fully-populated Invitation with all required fields', () => {
    const invitation: Invitation = {
      token: 'tok-abc123',
      email: 'newuser@example.com',
      role: 'Sales Rep',
      invitedBy: 'usr-001',
      status: 'Pending',
      createdAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-08T00:00:00.000Z',
    };
    expect(invitation.token).toBe('tok-abc123');
    expect(invitation.email).toBe('newuser@example.com');
    expect(invitation.role).toBe('Sales Rep');
    expect(invitation.invitedBy).toBe('usr-001');
    expect(invitation.status).toBe('Pending');
    expect(invitation.createdAt).toBe('2026-03-01T00:00:00.000Z');
    expect(invitation.expiresAt).toBe('2026-03-08T00:00:00.000Z');
  });

  it('accepts an Invitation with optional firstName present', () => {
    const invitation: Invitation = {
      token: 'tok-def456',
      email: 'named@example.com',
      role: 'Admin',
      invitedBy: 'usr-001',
      firstName: 'Ivan',
      status: 'Pending',
      createdAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-08T00:00:00.000Z',
    };
    expect(invitation.firstName).toBe('Ivan');
  });

  it('accepts an Invitation without optional firstName (field is optional)', () => {
    const invitation: Invitation = {
      token: 'tok-ghi789',
      email: 'anon@example.com',
      role: 'Sales Manager',
      invitedBy: 'usr-001',
      status: 'Pending',
      createdAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-08T00:00:00.000Z',
    };
    expect(invitation.firstName).toBeUndefined();
  });

  it('accepts an Invitation with optional consumedAt present', () => {
    const invitation: Invitation = {
      token: 'tok-jkl012',
      email: 'consumed@example.com',
      role: 'Sales Rep',
      invitedBy: 'usr-001',
      status: 'Consumed',
      createdAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-08T00:00:00.000Z',
      consumedAt: '2026-03-03T10:00:00.000Z',
    };
    expect(invitation.consumedAt).toBe('2026-03-03T10:00:00.000Z');
  });

  it('accepts an Invitation without optional consumedAt (field is optional)', () => {
    const invitation: Invitation = {
      token: 'tok-mno345',
      email: 'pending@example.com',
      role: 'Sales Rep',
      invitedBy: 'usr-001',
      status: 'Pending',
      createdAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-08T00:00:00.000Z',
    };
    expect(invitation.consumedAt).toBeUndefined();
  });

  it('accepts "Revoked" as a valid Invitation status', () => {
    const invitation: Invitation = {
      token: 'tok-pqr678',
      email: 'revoked@example.com',
      role: 'Sales Rep',
      invitedBy: 'usr-001',
      status: 'Revoked',
      createdAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-08T00:00:00.000Z',
    };
    expect(invitation.status).toBe('Revoked');
  });
});

// ---------------------------------------------------------------------------
// 6. Team interface
// ---------------------------------------------------------------------------

describe('Team interface', () => {
  it('accepts a fully-populated Team object with all required fields', () => {
    const team: Team = {
      id: 'team-001',
      name: 'West Coast Sales',
      memberIds: ['usr-002', 'usr-003'],
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(team.id).toBe('team-001');
    expect(team.name).toBe('West Coast Sales');
    expect(team.memberIds).toEqual(['usr-002', 'usr-003']);
    expect(team.createdAt).toBe('2026-01-15T00:00:00.000Z');
    expect(team.updatedAt).toBe('2026-03-15T12:00:00.000Z');
  });

  it('accepts a Team with optional managerId present', () => {
    const team: Team = {
      id: 'team-002',
      name: 'East Coast Sales',
      managerId: 'usr-010',
      memberIds: ['usr-011', 'usr-012'],
      createdAt: '2026-01-20T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(team.managerId).toBe('usr-010');
  });

  it('accepts a Team without optional managerId (field is optional)', () => {
    const team: Team = {
      id: 'team-003',
      name: 'Unassigned Team',
      memberIds: [],
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(team.managerId).toBeUndefined();
  });

  it('accepts a Team with an empty memberIds array', () => {
    const team: Team = {
      id: 'team-004',
      name: 'Empty Team',
      memberIds: [],
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(team.memberIds).toHaveLength(0);
  });

  it('stores memberIds as an array of strings', () => {
    const team: Team = {
      id: 'team-005',
      name: 'Multi-Member Team',
      memberIds: ['usr-101', 'usr-102', 'usr-103'],
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-15T12:00:00.000Z',
    };
    expect(Array.isArray(team.memberIds)).toBe(true);
    expect(team.memberIds).toHaveLength(3);
    team.memberIds.forEach((id) => expect(typeof id).toBe('string'));
  });
});

// ---------------------------------------------------------------------------
// 7. Updated JwtPayload interface
// ---------------------------------------------------------------------------

describe('JwtPayload interface (updated for issue #23)', () => {
  it('accepts a valid JwtPayload with all required fields', () => {
    const payload: JwtPayload = {
      sub: 'usr-001',
      googleId: 'google-sub-abc123',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'Admin',
    };
    expect(payload.sub).toBe('usr-001');
    expect(payload.googleId).toBe('google-sub-abc123');
    expect(payload.email).toBe('alice@example.com');
    expect(payload.firstName).toBe('Alice');
    expect(payload.lastName).toBe('Smith');
    expect(payload.role).toBe('Admin');
  });

  it('has sub field as a CRM user UUID string (not a Google ID)', () => {
    const payload: JwtPayload = {
      sub: 'usr-uuid-12345',
      googleId: 'google-sub-xyz',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'Sales Rep',
    };
    expect(typeof payload.sub).toBe('string');
    // sub should be the CRM UUID, distinct from googleId
    expect(payload.sub).not.toBe(payload.googleId);
  });

  it('includes googleId as a separate field from sub', () => {
    const payload: JwtPayload = {
      sub: 'crm-internal-id',
      googleId: 'google-oauth-id',
      email: 'user@example.com',
      firstName: 'User',
      lastName: 'Name',
      role: 'Sales Manager',
    };
    expect(payload.googleId).toBe('google-oauth-id');
  });

  it('includes role field typed as CrmRole', () => {
    const adminPayload: JwtPayload = {
      sub: 'usr-a',
      googleId: 'g-a',
      email: 'a@example.com',
      firstName: 'A',
      lastName: 'B',
      role: 'Admin',
    };
    const managerPayload: JwtPayload = {
      sub: 'usr-b',
      googleId: 'g-b',
      email: 'b@example.com',
      firstName: 'B',
      lastName: 'C',
      role: 'Sales Manager',
    };
    const repPayload: JwtPayload = {
      sub: 'usr-c',
      googleId: 'g-c',
      email: 'c@example.com',
      firstName: 'C',
      lastName: 'D',
      role: 'Sales Rep',
    };
    expect(adminPayload.role).toBe('Admin');
    expect(managerPayload.role).toBe('Sales Manager');
    expect(repPayload.role).toBe('Sales Rep');
  });

  it('does not have an accessToken field on JwtPayload', () => {
    const payload: JwtPayload = {
      sub: 'usr-001',
      googleId: 'g-001',
      email: 'x@example.com',
      firstName: 'X',
      lastName: 'Y',
      role: 'Sales Rep',
    };
    // Casting through unknown to access a potentially-absent runtime key
    const payloadRecord = payload as unknown as Record<string, unknown>;
    expect(payloadRecord['accessToken']).toBeUndefined();
  });

  it('does not have a refreshToken field on JwtPayload', () => {
    const payload: JwtPayload = {
      sub: 'usr-002',
      googleId: 'g-002',
      email: 'y@example.com',
      firstName: 'Y',
      lastName: 'Z',
      role: 'Admin',
    };
    const payloadRecord = payload as unknown as Record<string, unknown>;
    expect(payloadRecord['refreshToken']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 8. Backward-compatibility — Customer, CreateCustomerDto, UpdateCustomerDto
// ---------------------------------------------------------------------------

describe('Customer interface (must remain unchanged)', () => {
  it('accepts a fully-populated Customer object', () => {
    const customer: Customer = {
      id: 'cust-001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1-555-0100',
      company: 'Acme Corp',
      status: 'Lead',
      lastContactDate: '2026-03-01',
      notes: 'Met at conference.',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(customer.id).toBe('cust-001');
    expect(customer.status).toBe('Lead');
  });

  it('CustomerStatus still includes all four original values', () => {
    const lead: CustomerStatus = 'Lead';
    const active: CustomerStatus = 'Active';
    const churned: CustomerStatus = 'Churned';
    const archived: CustomerStatus = 'Archived';
    expect(lead).toBe('Lead');
    expect(active).toBe('Active');
    expect(churned).toBe('Churned');
    expect(archived).toBe('Archived');
  });
});

describe('CreateCustomerDto interface (must remain unchanged)', () => {
  it('accepts a valid CreateCustomerDto without id or createdAt', () => {
    const dto: CreateCustomerDto = {
      firstName: 'Jane',
      lastName: 'Roe',
      email: 'jane@example.com',
      phone: '+1-555-0200',
      company: 'Beta LLC',
      status: 'Active',
      lastContactDate: '2026-03-10',
      notes: '',
    };
    expect(dto.firstName).toBe('Jane');
  });
});

describe('UpdateCustomerDto interface (must remain unchanged)', () => {
  it('accepts a partial update with only a status change', () => {
    const dto: UpdateCustomerDto = { status: 'Churned' };
    expect(dto.status).toBe('Churned');
  });

  it('accepts an empty update object (all fields are optional)', () => {
    const dto: UpdateCustomerDto = {};
    expect(dto).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 9. Backward-compatibility — GoogleUser (must remain unchanged)
// ---------------------------------------------------------------------------

describe('GoogleUser interface (must remain unchanged)', () => {
  it('accepts a fully-populated GoogleUser with all original fields', () => {
    const gUser: GoogleUser = {
      googleId: 'google-sub-abc',
      email: 'oauth@example.com',
      firstName: 'OAuth',
      lastName: 'User',
      accessToken: 'access-tok-xyz',
      refreshToken: 'refresh-tok-xyz',
    };
    expect(gUser.googleId).toBe('google-sub-abc');
    expect(gUser.accessToken).toBe('access-tok-xyz');
    expect(gUser.refreshToken).toBe('refresh-tok-xyz');
  });

  it('GoogleUser still carries accessToken (unchanged from original spec)', () => {
    const gUser: GoogleUser = {
      googleId: 'g-1',
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      accessToken: 'tok',
      refreshToken: 'rtok',
    };
    expect(typeof gUser.accessToken).toBe('string');
  });

  it('GoogleUser still carries refreshToken (unchanged from original spec)', () => {
    const gUser: GoogleUser = {
      googleId: 'g-2',
      email: 'c@d.com',
      firstName: 'C',
      lastName: 'D',
      accessToken: 'tok2',
      refreshToken: 'rtok2',
    };
    expect(typeof gUser.refreshToken).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// 10. Export surface — all names must be exported from the entry point
// ---------------------------------------------------------------------------

describe('package entry-point exports', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./index') as Record<string, unknown>;

  it('does not export CrmRole as a runtime value (it is a type alias)', () => {
    // Type aliases disappear at runtime; this test documents that expectation
    // and ensures no accidental runtime object is shipped under that name.
    // If it is present as an object/enum it would be a different contract.
    expect(typeof mod['CrmRole']).not.toBe('object');
  });

  it('does not export UserStatus as a runtime object', () => {
    expect(typeof mod['UserStatus']).not.toBe('object');
  });

  it('does not export InvitationStatus as a runtime object', () => {
    expect(typeof mod['InvitationStatus']).not.toBe('object');
  });

  it('does not export CrmRole as a function (it must be a type, not a class or factory)', () => {
    expect(typeof mod['CrmRole']).not.toBe('function');
  });
});
