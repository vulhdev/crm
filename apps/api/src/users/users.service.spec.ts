/**
 * Test file: apps/api/src/users/users.service.spec.ts
 *
 * Covers:
 *  - findAll() returns all CrmUser objects mapped from the Users tab (header row skipped)
 *  - findAll() returns empty array when only the header row is present
 *  - findById(id) returns the matching CrmUser when a row with that id exists
 *  - findById(id) returns null when no row matches the given id
 *  - findMe(sub) returns the CrmUser whose id matches the JWT sub claim
 *  - findMe(sub) returns null when no row matches the given sub
 *  - update(id, dto) writes updated first_name, last_name, role values and returns the updated user
 *  - update(id, dto) throws NotFoundException (404) when no user row has the given id
 *  - update(id, dto) with a role change throws UnprocessableEntityException (422) when the
 *    target user is the last Admin and the new role is not Admin
 *  - deactivate(id) sets status=Deactivated on the matching row and returns the updated user
 *  - deactivate(id) throws NotFoundException (404) when no user row has the given id
 *  - deactivate(id) throws UnprocessableEntityException (422) when the target user is the
 *    last Active Admin in the system
 *  - reactivate(id) sets status=Active on the matching row and returns the updated user
 *  - reactivate(id) throws NotFoundException (404) when no user row has the given id
 *
 * Developer must implement:
 *  - apps/api/src/users/users.service.ts — UsersService with the methods above
 *  - apps/api/src/users/users.module.ts  — UsersModule wiring AdminSheetsService
 *  - apps/api/src/users/dto/update-user.dto.ts — UpdateUserDto { firstName?, lastName?, role? }
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { CrmUser, CrmRole } from '@crm/types';
import { UsersService } from './users.service';
import { AdminSheetsService } from '../auth/admin-sheets.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLATFORM_SHEET_ID = 'platform-sheet-id';

const USERS_HEADER = [
  'id', 'google_id', 'email', 'first_name', 'last_name',
  'role', 'status', 'team_id', 'sheet_id', 'sheet_ownership',
  'created_at', 'updated_at',
];

function makeUserRow(user: CrmUser): string[] {
  return [
    user.id,
    user.googleId,
    user.email,
    user.firstName,
    user.lastName,
    user.role,
    user.status,
    user.teamId ?? '',
    user.sheetId ?? '',
    user.sheetOwnership ?? 'service_account',
    user.createdAt,
    user.updatedAt,
  ];
}

const adminUser: CrmUser = {
  id: 'user-admin-1',
  googleId: 'gid-admin-1',
  email: 'admin@company.com',
  firstName: 'Alice',
  lastName: 'Admin',
  role: 'Admin',
  status: 'Active',
  sheetId: 'sheet-admin-1',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const salesRepUser: CrmUser = {
  id: 'user-rep-1',
  googleId: 'gid-rep-1',
  email: 'rep@company.com',
  firstName: 'Bob',
  lastName: 'Rep',
  role: 'Sales Rep',
  status: 'Active',
  sheetId: 'sheet-rep-1',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const managerUser: CrmUser = {
  id: 'user-mgr-1',
  googleId: 'gid-mgr-1',
  email: 'mgr@company.com',
  firstName: 'Carol',
  lastName: 'Manager',
  role: 'Sales Manager',
  status: 'Active',
  sheetId: 'sheet-mgr-1',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-03T00:00:00.000Z',
  updatedAt: '2026-01-03T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAdminSheetsServiceMock(): jest.Mocked<AdminSheetsService> {
  return {
    getRange: jest.fn(),
    appendRow: jest.fn(),
    updateRow: jest.fn(),
    initPlatformTabs: jest.fn(),
    platformSheetId: PLATFORM_SHEET_ID,
  } as unknown as jest.Mocked<AdminSheetsService>;
}

async function buildModule(
  adminSheetsMock: jest.Mocked<AdminSheetsService>,
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      UsersService,
      { provide: AdminSheetsService, useValue: adminSheetsMock },
    ],
  }).compile();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsersService', () => {
  let service: UsersService;
  let adminSheetsService: jest.Mocked<AdminSheetsService>;

  beforeEach(async () => {
    adminSheetsService = buildAdminSheetsServiceMock();
    const module = await buildModule(adminSheetsService);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns all users mapped from the Users tab skipping the header row', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(salesRepUser),
        makeUserRow(managerUser),
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(adminUser.id);
      expect(result[1].id).toBe(salesRepUser.id);
      expect(result[2].id).toBe(managerUser.id);
    });

    it('returns an empty array when only the header row exists in the Users tab', async () => {
      adminSheetsService.getRange.mockResolvedValue([USERS_HEADER]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });

    it('returns an empty array when the Users tab is completely empty', async () => {
      adminSheetsService.getRange.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });

    it('maps sheet columns to CrmUser fields correctly', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
      ]);

      const [result] = await service.findAll();

      expect(result.id).toBe(adminUser.id);
      expect(result.googleId).toBe(adminUser.googleId);
      expect(result.email).toBe(adminUser.email);
      expect(result.firstName).toBe(adminUser.firstName);
      expect(result.lastName).toBe(adminUser.lastName);
      expect(result.role).toBe(adminUser.role);
      expect(result.status).toBe(adminUser.status);
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById(id)', () => {
    it('returns the matching CrmUser when a row with the given id exists', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(salesRepUser),
      ]);

      const result = await service.findById(salesRepUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(salesRepUser.id);
      expect(result!.email).toBe(salesRepUser.email);
    });

    it('returns null when no row matches the given id', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
      ]);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ── findMe ─────────────────────────────────────────────────────────────────

  describe('findMe(sub)', () => {
    it('returns the CrmUser whose id matches the JWT sub claim', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(salesRepUser),
      ]);

      const result = await service.findMe(salesRepUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(salesRepUser.id);
      expect(result!.role).toBe('Sales Rep');
    });

    it('returns null when no row matches the given sub', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
      ]);

      const result = await service.findMe('unknown-sub');

      expect(result).toBeNull();
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update(id, dto)', () => {
    it('writes updated firstName, lastName, and role to the sheet row and returns the updated user', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(salesRepUser),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const dto = { firstName: 'Robert', lastName: 'Updated', role: 'Sales Manager' as CrmRole };
      const result = await service.update(salesRepUser.id, dto);

      expect(adminSheetsService.updateRow).toHaveBeenCalledTimes(1);
      expect(result.firstName).toBe('Robert');
      expect(result.lastName).toBe('Updated');
      expect(result.role).toBe('Sales Manager');
    });

    it('updates only provided fields and preserves untouched fields', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(salesRepUser),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const dto = { firstName: 'Robert' };
      const result = await service.update(salesRepUser.id, dto);

      expect(result.firstName).toBe('Robert');
      expect(result.lastName).toBe(salesRepUser.lastName);
      expect(result.role).toBe(salesRepUser.role);
    });

    it('throws NotFoundException when no user row has the given id', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
      ]);

      await expect(service.update('nonexistent-id', { firstName: 'Ghost' })).rejects.toThrow(
        NotFoundException,
      );
      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when changing the role of the last Admin to a non-Admin role', async () => {
      // Only one Admin in the system
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(salesRepUser),
      ]);

      await expect(
        service.update(adminUser.id, { role: 'Sales Rep' }),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });

    it('allows a role change when more than one Admin exists after the change', async () => {
      const secondAdmin: CrmUser = {
        ...salesRepUser,
        id: 'user-admin-2',
        role: 'Admin',
        email: 'admin2@company.com',
      };

      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(secondAdmin),
        makeUserRow(salesRepUser),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      // Downgrading adminUser is allowed because secondAdmin remains
      await expect(
        service.update(adminUser.id, { role: 'Sales Manager' }),
      ).resolves.not.toThrow();
    });
  });

  // ── deactivate ─────────────────────────────────────────────────────────────

  describe('deactivate(id)', () => {
    it('sets status=Deactivated on the matching row and returns the updated user', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(salesRepUser),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const result = await service.deactivate(salesRepUser.id);

      expect(adminSheetsService.updateRow).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('Deactivated');
      expect(result.id).toBe(salesRepUser.id);
    });

    it('throws NotFoundException when no user row has the given id', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
      ]);

      await expect(service.deactivate('ghost-id')).rejects.toThrow(NotFoundException);
      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when attempting to deactivate the last Active Admin', async () => {
      // Only one active Admin — cannot deactivate
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(salesRepUser),
      ]);

      await expect(service.deactivate(adminUser.id)).rejects.toThrow(
        UnprocessableEntityException,
      );

      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });

    it('allows deactivating an Admin when another Active Admin exists', async () => {
      const secondAdmin: CrmUser = {
        ...salesRepUser,
        id: 'user-admin-2',
        role: 'Admin',
        status: 'Active',
        email: 'admin2@company.com',
      };

      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(secondAdmin),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      await expect(service.deactivate(adminUser.id)).resolves.not.toThrow();
    });

    it('allows deactivating the last Admin if they are already Deactivated (no Active Admin count change)', async () => {
      const deactivatedAdmin: CrmUser = {
        ...adminUser,
        status: 'Deactivated',
      };
      const anotherRep: CrmUser = {
        ...salesRepUser,
        id: 'rep-2',
      };

      // Only Active admin is actually anotherRep (not an Admin) — edge: target is already Deactivated
      // The rule is about Active Admins; if the user is already Deactivated, no Active Admin count changes
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(deactivatedAdmin),
        makeUserRow(anotherRep),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      // Deactivating an already-Deactivated user is idempotent — should not throw last-admin guard
      await expect(service.deactivate(deactivatedAdmin.id)).resolves.not.toThrow();
    });
  });

  // ── reactivate ─────────────────────────────────────────────────────────────

  describe('reactivate(id)', () => {
    it('sets status=Active on the matching row and returns the updated user', async () => {
      const deactivatedRep: CrmUser = { ...salesRepUser, status: 'Deactivated' };

      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(deactivatedRep),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const result = await service.reactivate(deactivatedRep.id);

      expect(adminSheetsService.updateRow).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('Active');
      expect(result.id).toBe(deactivatedRep.id);
    });

    it('throws NotFoundException when no user row has the given id', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
      ]);

      await expect(service.reactivate('ghost-id')).rejects.toThrow(NotFoundException);
      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });

    it('is idempotent when reactivating an already-Active user', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        USERS_HEADER,
        makeUserRow(adminUser),
        makeUserRow(salesRepUser),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const result = await service.reactivate(salesRepUser.id);

      expect(result.status).toBe('Active');
    });
  });
});
