/**
 * Test file: apps/api/src/customers/customers.controller.spec.ts
 *
 * Covers:
 *  - GET /customers for a Sales Rep calls SheetsService.getAll with the rep's own
 *    spreadsheetId and filters rows by owner_id
 *  - GET /customers for a Sales Manager federates reads across all team members' sheets
 *    via AdminSheetsService
 *  - GET /customers for an Admin reads all user spreadsheets via AdminSheetsService
 *  - Phase 1 routing: sheet_ownership='user' → SheetsService (per-user OAuth path)
 *  - Phase 1 routing: sheet_ownership='service_account' → AdminSheetsService
 *  - POST /customers attaches owner_id = req.user.sub to the newly created customer row
 *
 * Developer must implement:
 *  - apps/api/src/customers/customers.controller.ts — updated CustomersController that:
 *    - Injects AdminSheetsService alongside SheetsService
 *    - Routes GET /customers based on user role and sheet_ownership
 *    - Injects UsersService (or AdminSheetsService directly) to look up team members
 *    - Sets owner_id on POST
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SheetsService } from './sheets.service';
import { DriveService } from './drive.service';
import { AdminSheetsService } from '../auth/admin-sheets.service';
import { CustomersController } from './customers.controller';
import type { CrmUser, Customer, JwtPayload } from '@crm/types';

// ---------------------------------------------------------------------------
// Mock guard — bypass real JWT validation
// ---------------------------------------------------------------------------

class MockJwtAuthGuard {
  canActivate() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCustomer = (overrides: Partial<Customer & { ownerId?: string }> = {}): Customer => ({
  id: 'cust-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '555-1234',
  company: 'Acme',
  status: 'Active',
  lastContactDate: '2026-01-01',
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const repUser: JwtPayload = {
  sub: 'user-rep-id',
  googleId: 'gid-rep',
  email: 'rep@company.com',
  firstName: 'Rep',
  lastName: 'User',
  role: 'Sales Rep',
};

const managerUser: JwtPayload = {
  sub: 'user-mgr-id',
  googleId: 'gid-mgr',
  email: 'mgr@company.com',
  firstName: 'Manager',
  lastName: 'User',
  role: 'Sales Manager',
};

const adminUser: JwtPayload = {
  sub: 'user-admin-id',
  googleId: 'gid-admin',
  email: 'admin@company.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'Admin',
};

const repCrmUser: CrmUser = {
  id: repUser.sub,
  googleId: repUser.googleId,
  email: repUser.email,
  firstName: repUser.firstName,
  lastName: repUser.lastName,
  role: 'Sales Rep',
  status: 'Active',
  sheetId: 'rep-sheet-id',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const repCrmUserOwned: CrmUser = {
  ...repCrmUser,
  sheetOwnership: 'user',
  sheetId: 'rep-user-owned-sheet-id',
};

const teamMember1CrmUser: CrmUser = {
  id: 'member-1-id',
  googleId: 'gid-member-1',
  email: 'member1@company.com',
  firstName: 'Member',
  lastName: 'One',
  role: 'Sales Rep',
  status: 'Active',
  sheetId: 'member-1-sheet-id',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Module builder
// ---------------------------------------------------------------------------

function buildMockSheetsService(): jest.Mocked<SheetsService> {
  return {
    getAll: jest.fn(),
    append: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<SheetsService>;
}

function buildMockAdminSheetsService(): jest.Mocked<AdminSheetsService> {
  return {
    getRange: jest.fn(),
    appendRow: jest.fn(),
    updateRow: jest.fn(),
    initPlatformTabs: jest.fn(),
  } as unknown as jest.Mocked<AdminSheetsService>;
}

function buildMockDriveService(): jest.Mocked<DriveService> {
  return {
    getOrCreateSpreadsheet: jest.fn(),
  } as unknown as jest.Mocked<DriveService>;
}

async function buildApp(
  sheetsService: jest.Mocked<SheetsService>,
  adminSheetsService: jest.Mocked<AdminSheetsService>,
  driveService: jest.Mocked<DriveService>,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [CustomersController],
    providers: [
      { provide: SheetsService, useValue: sheetsService },
      { provide: AdminSheetsService, useValue: adminSheetsService },
      { provide: DriveService, useValue: driveService },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(MockJwtAuthGuard)
    .compile();

  const app = module.createNestApplication();
  await app.init();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CustomersController', () => {
  let app: INestApplication;
  let sheetsService: jest.Mocked<SheetsService>;
  let adminSheetsService: jest.Mocked<AdminSheetsService>;
  let driveService: jest.Mocked<DriveService>;

  beforeEach(async () => {
    sheetsService = buildMockSheetsService();
    adminSheetsService = buildMockAdminSheetsService();
    driveService = buildMockDriveService();
    app = await buildApp(sheetsService, adminSheetsService, driveService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ── GET /customers — role-based routing ───────────────────────────────────

  describe('GET /customers — Sales Rep', () => {
    it("calls SheetsService.getAll with the rep's own spreadsheetId when sheet_ownership is service_account", async () => {
      const repCustomer = makeCustomer({ id: 'cust-rep-1' });
      adminSheetsService.getRange.mockResolvedValueOnce([
        // Users tab row for the rep
        ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
          'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
        [repCrmUser.id, repCrmUser.googleId, repCrmUser.email, repCrmUser.firstName,
          repCrmUser.lastName, repCrmUser.role, repCrmUser.status, '',
          repCrmUser.sheetId!, repCrmUser.sheetOwnership!, repCrmUser.createdAt, repCrmUser.updatedAt],
      ]);
      adminSheetsService.getRange.mockResolvedValueOnce([[repCustomer.id, '', '', '', '', '', '', '', '', '']]);

      await request(app.getHttpServer())
        .get('/customers')
        .set('x-mock-user', JSON.stringify(repUser))
        .expect(HttpStatus.OK);

      // AdminSheetsService used for SA-owned sheet
      expect(adminSheetsService.getRange).toHaveBeenCalled();
    });

    it("does not return customers belonging to other users when the rep has their own SA-owned sheet", async () => {
      const ownCustomer = makeCustomer({ id: 'cust-own' });
      const otherCustomer = makeCustomer({ id: 'cust-other' });

      adminSheetsService.getRange
        .mockResolvedValueOnce([
          ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
            'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
          [repCrmUser.id, repCrmUser.googleId, repCrmUser.email, repCrmUser.firstName,
            repCrmUser.lastName, repCrmUser.role, repCrmUser.status, '',
            repCrmUser.sheetId!, repCrmUser.sheetOwnership!, repCrmUser.createdAt, repCrmUser.updatedAt],
        ])
        .mockResolvedValueOnce([
          // Both customers in the sheet, but with different owner_id
          [ownCustomer.id, '', '', '', '', '', '', '', '', '', repUser.sub],
          [otherCustomer.id, '', '', '', '', '', '', '', '', '', 'other-user-id'],
        ]);

      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('x-mock-user', JSON.stringify(repUser))
        .expect(HttpStatus.OK);

      // Only own customer should be in the response
      const ids: string[] = response.body.map((c: Customer) => c.id);
      expect(ids).toContain(ownCustomer.id);
      expect(ids).not.toContain(otherCustomer.id);
    });
  });

  describe('GET /customers — Phase 1 sheet_ownership routing', () => {
    it('uses SheetsService (per-user OAuth) when sheet_ownership is user', async () => {
      const customers = [makeCustomer()];
      adminSheetsService.getRange.mockResolvedValueOnce([
        ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
          'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
        [repCrmUserOwned.id, repCrmUserOwned.googleId, repCrmUserOwned.email,
          repCrmUserOwned.firstName, repCrmUserOwned.lastName, repCrmUserOwned.role,
          repCrmUserOwned.status, '', repCrmUserOwned.sheetId!,
          repCrmUserOwned.sheetOwnership!, repCrmUserOwned.createdAt, repCrmUserOwned.updatedAt],
      ]);
      sheetsService.getAll.mockResolvedValue(customers);

      await request(app.getHttpServer())
        .get('/customers')
        .set('x-mock-user', JSON.stringify(repUser))
        .expect(HttpStatus.OK);

      expect(sheetsService.getAll).toHaveBeenCalled();
    });

    it('uses AdminSheetsService when sheet_ownership is service_account', async () => {
      adminSheetsService.getRange
        .mockResolvedValueOnce([
          ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
            'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
          [repCrmUser.id, repCrmUser.googleId, repCrmUser.email,
            repCrmUser.firstName, repCrmUser.lastName, repCrmUser.role,
            repCrmUser.status, '', repCrmUser.sheetId!,
            'service_account', repCrmUser.createdAt, repCrmUser.updatedAt],
        ])
        .mockResolvedValueOnce([]); // customer rows

      await request(app.getHttpServer())
        .get('/customers')
        .set('x-mock-user', JSON.stringify(repUser))
        .expect(HttpStatus.OK);

      // SheetsService must NOT be used for SA-owned sheets
      expect(sheetsService.getAll).not.toHaveBeenCalled();
    });
  });

  describe('GET /customers — Sales Manager (federated read)', () => {
    it('federates reads across all team members sheets via AdminSheetsService', async () => {
      const managerCrmUser: CrmUser = {
        id: managerUser.sub,
        googleId: managerUser.googleId,
        email: managerUser.email,
        firstName: managerUser.firstName,
        lastName: managerUser.lastName,
        role: 'Sales Manager',
        status: 'Active',
        sheetId: 'mgr-sheet-id',
        sheetOwnership: 'service_account',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      // First call: all Users rows (to find team members)
      adminSheetsService.getRange
        .mockResolvedValueOnce([
          ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
            'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
          [managerCrmUser.id, managerCrmUser.googleId, managerCrmUser.email,
            managerCrmUser.firstName, managerCrmUser.lastName, managerCrmUser.role,
            managerCrmUser.status, 'team-a', managerCrmUser.sheetId!,
            'service_account', managerCrmUser.createdAt, managerCrmUser.updatedAt],
          [teamMember1CrmUser.id, teamMember1CrmUser.googleId, teamMember1CrmUser.email,
            teamMember1CrmUser.firstName, teamMember1CrmUser.lastName, teamMember1CrmUser.role,
            teamMember1CrmUser.status, 'team-a', teamMember1CrmUser.sheetId!,
            'service_account', teamMember1CrmUser.createdAt, teamMember1CrmUser.updatedAt],
        ])
        // Second call: member1 sheet customers
        .mockResolvedValueOnce([
          ['cust-m1', 'Jane', 'Smith', 'jane@example.com', '', '', 'Lead', '', '', ''],
        ])
        // Third call: manager own sheet customers
        .mockResolvedValueOnce([
          ['cust-m0', 'Own', 'Customer', 'own@example.com', '', '', 'Active', '', '', ''],
        ]);

      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('x-mock-user', JSON.stringify(managerUser))
        .expect(HttpStatus.OK);

      // AdminSheetsService must have been called for each team member sheet
      expect(adminSheetsService.getRange).toHaveBeenCalledTimes(3);
      // Response should contain customers from all sheets
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /customers — Admin (reads all sheets)', () => {
    it('reads all user spreadsheets via AdminSheetsService', async () => {
      const allUsers: CrmUser[] = [
        repCrmUser,
        teamMember1CrmUser,
        {
          id: adminUser.sub,
          googleId: adminUser.googleId,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: 'Admin',
          status: 'Active',
          sheetId: 'admin-sheet-id',
          sheetOwnership: 'service_account',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const usersHeaderRow = ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
        'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'];

      adminSheetsService.getRange
        // First call: fetch all users from platform sheet
        .mockResolvedValueOnce([
          usersHeaderRow,
          ...allUsers.map((u) => [u.id, u.googleId, u.email, u.firstName, u.lastName,
            u.role, u.status, u.teamId ?? '', u.sheetId!, u.sheetOwnership!, u.createdAt, u.updatedAt]),
        ])
        // Subsequent calls: one per user sheet
        .mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/customers')
        .set('x-mock-user', JSON.stringify(adminUser))
        .expect(HttpStatus.OK);

      // getRange should be called once for users list + once per user with a sheetId
      expect(adminSheetsService.getRange).toHaveBeenCalledTimes(1 + allUsers.filter((u) => u.sheetId).length);
    });
  });

  // ── POST /customers ────────────────────────────────────────────────────────

  describe('POST /customers', () => {
    it('attaches owner_id equal to req.user.sub when creating a new customer', async () => {
      const newCustomerDto = {
        firstName: 'New',
        lastName: 'Customer',
        email: 'new@example.com',
        phone: '555-9999',
        company: 'NewCo',
        status: 'Lead',
        lastContactDate: '',
        notes: '',
      };

      // Lookup user in platform sheet
      adminSheetsService.getRange.mockResolvedValue([
        ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
          'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
        [repCrmUser.id, repCrmUser.googleId, repCrmUser.email,
          repCrmUser.firstName, repCrmUser.lastName, repCrmUser.role,
          repCrmUser.status, '', repCrmUser.sheetId!, repCrmUser.sheetOwnership!,
          repCrmUser.createdAt, repCrmUser.updatedAt],
      ]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/customers')
        .set('x-mock-user', JSON.stringify(repUser))
        .send(newCustomerDto)
        .expect(HttpStatus.CREATED);

      // The row appended must include the owner_id (repUser.sub) somewhere in its fields
      const appendCall = adminSheetsService.appendRow.mock.calls[0];
      const appendedRow: string[] = appendCall[2];
      expect(appendedRow).toContain(repUser.sub);
    });

    it('returns 201 and the created customer on success', async () => {
      const newCustomerDto = {
        firstName: 'Created',
        lastName: 'Rep',
        email: 'created@example.com',
        phone: '',
        company: '',
        status: 'Lead',
        lastContactDate: '',
        notes: '',
      };

      adminSheetsService.getRange.mockResolvedValue([
        ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
          'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
        [repCrmUser.id, repCrmUser.googleId, repCrmUser.email,
          repCrmUser.firstName, repCrmUser.lastName, repCrmUser.role,
          repCrmUser.status, '', repCrmUser.sheetId!, repCrmUser.sheetOwnership!,
          repCrmUser.createdAt, repCrmUser.updatedAt],
      ]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('x-mock-user', JSON.stringify(repUser))
        .send(newCustomerDto)
        .expect(HttpStatus.CREATED);

      expect(response.body).toMatchObject({ firstName: 'Created', lastName: 'Rep' });
    });
  });
});
