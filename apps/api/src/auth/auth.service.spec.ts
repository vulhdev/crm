/**
 * Test file: apps/api/src/auth/auth.service.spec.ts
 *
 * Covers:
 *  - login(googleUser, crmUser) produces a JWT with sub=crmUser.id, role=crmUser.role,
 *    and does NOT embed accessToken or refreshToken in the payload
 *  - findOrCreateBootstrapAdmin(): Users tab empty + email matches BOOTSTRAP_ADMIN_EMAIL
 *    → creates Admin CrmUser row and returns the CrmUser
 *  - findOrCreateBootstrapAdmin(): Users tab empty + email does NOT match BOOTSTRAP_ADMIN_EMAIL
 *    → throws ForbiddenException
 *  - findUserByGoogleId(): returns CrmUser when a matching row exists
 *  - findUserByGoogleId(): returns null when no row matches
 *  - processInviteToken(): valid token → creates user row, marks Consumed, returns CrmUser
 *  - processInviteToken(): expired token → throws appropriate error
 *  - processInviteToken(): revoked token → throws appropriate error
 *  - processInviteToken(): already-consumed token → throws appropriate error
 *
 * Developer must implement:
 *  - apps/api/src/auth/auth.service.ts — updated AuthService with the methods above
 *  - Updated login() signature: login(googleUser: GoogleUser, crmUser: CrmUser): string
 *  - BOOTSTRAP_ADMIN_EMAIL env var checked in findOrCreateBootstrapAdmin()
 *  - AdminSheetsService injected for all platform-sheet reads/writes
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import type { CrmUser, GoogleUser, Invitation } from '@crm/types';
import { AuthService } from './auth.service';
import { AdminSheetsService } from './admin-sheets.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BOOTSTRAP_ADMIN_EMAIL = 'admin@company.com';
const PLATFORM_SHEET_ID = 'platform-sheet-id-abc';

const mockGoogleUser: GoogleUser = {
  googleId: 'gid-admin-1',
  email: BOOTSTRAP_ADMIN_EMAIL,
  firstName: 'Alice',
  lastName: 'Admin',
  accessToken: 'access-token-xyz',
  refreshToken: 'refresh-token-xyz',
};

const mockCrmUser: CrmUser = {
  id: 'crm-user-uuid-1',
  googleId: 'gid-admin-1',
  email: BOOTSTRAP_ADMIN_EMAIL,
  firstName: 'Alice',
  lastName: 'Admin',
  role: 'Admin',
  status: 'Active',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 1).toISOString();

const validPendingInvitation: Invitation = {
  token: 'a'.repeat(64),
  email: 'newrep@company.com',
  role: 'Sales Rep',
  invitedBy: 'crm-user-uuid-1',
  firstName: 'Bob',
  status: 'Pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: futureDate,
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
  } as unknown as jest.Mocked<AdminSheetsService>;
}

async function buildModule(
  adminSheetsMock: jest.Mocked<AdminSheetsService>,
  configOverrides: Record<string, string> = {},
): Promise<TestingModule> {
  const defaults: Record<string, string> = {
    BOOTSTRAP_ADMIN_EMAIL,
    PLATFORM_SHEET_ID,
    JWT_SECRET: 'test-secret',
  };
  return Test.createTestingModule({
    providers: [
      AuthService,
      { provide: AdminSheetsService, useValue: adminSheetsMock },
      {
        provide: JwtService,
        useValue: {
          sign: jest.fn().mockReturnValue('signed-jwt-token'),
        },
      },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => ({ ...defaults, ...configOverrides }[key]),
          ),
        },
      },
    ],
  }).compile();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let adminSheetsService: jest.Mocked<AdminSheetsService>;

  beforeEach(async () => {
    adminSheetsService = buildAdminSheetsServiceMock();
    const module = await buildModule(adminSheetsService);
    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login(googleUser, crmUser)', () => {
    it('signs a JWT with sub equal to crmUser.id', () => {
      service.login(mockGoogleUser, mockCrmUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: mockCrmUser.id }),
      );
    });

    it('includes the user role in the JWT payload', () => {
      service.login(mockGoogleUser, mockCrmUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'Admin' }),
      );
    });

    it('includes googleId, email, firstName, lastName in the JWT payload', () => {
      service.login(mockGoogleUser, mockCrmUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          googleId: mockCrmUser.googleId,
          email: mockCrmUser.email,
          firstName: mockCrmUser.firstName,
          lastName: mockCrmUser.lastName,
        }),
      );
    });

    it('does NOT embed accessToken in the JWT payload', () => {
      service.login(mockGoogleUser, mockCrmUser);

      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      expect(payload).not.toHaveProperty('accessToken');
    });

    it('does NOT embed refreshToken in the JWT payload', () => {
      service.login(mockGoogleUser, mockCrmUser);

      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      expect(payload).not.toHaveProperty('refreshToken');
    });

    it('returns the signed JWT string', () => {
      const result = service.login(mockGoogleUser, mockCrmUser);
      expect(result).toBe('signed-jwt-token');
    });
  });

  // ── findOrCreateBootstrapAdmin ─────────────────────────────────────────────

  describe('findOrCreateBootstrapAdmin(googleUser)', () => {
    it('creates an Admin row and returns a CrmUser when Users tab is empty and email matches BOOTSTRAP_ADMIN_EMAIL', async () => {
      // Empty Users tab — only the header row (or fully empty)
      adminSheetsService.getRange.mockResolvedValue([
        ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
          'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
      ]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      const result = await service.findOrCreateBootstrapAdmin(mockGoogleUser);

      expect(result).toBeDefined();
      expect(result.email).toBe(BOOTSTRAP_ADMIN_EMAIL);
      expect(result.role).toBe('Admin');
      expect(result.status).toBe('Active');
      expect(adminSheetsService.appendRow).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when Users tab is empty but email does NOT match BOOTSTRAP_ADMIN_EMAIL', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        ['id', 'google_id', 'email'],
      ]);

      const nonAdminGoogleUser: GoogleUser = {
        ...mockGoogleUser,
        email: 'stranger@example.com',
        googleId: 'gid-stranger',
      };

      await expect(service.findOrCreateBootstrapAdmin(nonAdminGoogleUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(adminSheetsService.appendRow).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when Users tab already has existing users (bootstrap is not applicable)', async () => {
      // Users tab already has data rows — bootstrap should not run
      adminSheetsService.getRange.mockResolvedValue([
        ['id', 'google_id', 'email'],
        ['existing-id', 'existing-gid', 'existing@example.com'],
      ]);

      await expect(service.findOrCreateBootstrapAdmin(mockGoogleUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── findUserByGoogleId ─────────────────────────────────────────────────────

  describe('findUserByGoogleId(googleId)', () => {
    it('returns a CrmUser when a matching google_id row is found', async () => {
      const now = '2026-01-01T00:00:00.000Z';
      adminSheetsService.getRange.mockResolvedValue([
        ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
          'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
        [mockCrmUser.id, mockCrmUser.googleId, mockCrmUser.email,
          mockCrmUser.firstName, mockCrmUser.lastName, mockCrmUser.role,
          mockCrmUser.status, '', '', 'service_account', now, now],
      ]);

      const result = await service.findUserByGoogleId('gid-admin-1');

      expect(result).not.toBeNull();
      expect(result!.googleId).toBe('gid-admin-1');
      expect(result!.role).toBe('Admin');
    });

    it('returns null when no row has the given google_id', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
          'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
      ]);

      const result = await service.findUserByGoogleId('nonexistent-gid');
      expect(result).toBeNull();
    });
  });

  // ── processInviteToken ─────────────────────────────────────────────────────

  describe('processInviteToken(token, googleUser)', () => {
    it('creates a user row, marks the invitation Consumed, and returns a new CrmUser for a valid Pending token', async () => {
      const invitationRow = [
        validPendingInvitation.token,
        validPendingInvitation.email,
        validPendingInvitation.role,
        validPendingInvitation.invitedBy,
        validPendingInvitation.firstName ?? '',
        validPendingInvitation.status,
        validPendingInvitation.createdAt,
        validPendingInvitation.expiresAt,
        '',
      ];

      // First call → Invitations tab; second call → Users tab
      adminSheetsService.getRange
        .mockResolvedValueOnce([
          ['token', 'email', 'role', 'invited_by', 'first_name',
            'status', 'created_at', 'expires_at', 'consumed_at'],
          invitationRow,
        ])
        .mockResolvedValueOnce([
          ['id', 'google_id', 'email', 'first_name', 'last_name', 'role', 'status',
            'team_id', 'sheet_id', 'sheet_ownership', 'created_at', 'updated_at'],
        ]);

      adminSheetsService.appendRow.mockResolvedValue(undefined);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const invitedGoogleUser: GoogleUser = {
        googleId: 'gid-bob-1',
        email: validPendingInvitation.email,
        firstName: 'Bob',
        lastName: 'Rep',
        accessToken: 'tok',
        refreshToken: 'rtok',
      };

      const result = await service.processInviteToken(validPendingInvitation.token, invitedGoogleUser);

      expect(result).toBeDefined();
      expect(result.email).toBe(validPendingInvitation.email);
      expect(result.role).toBe('Sales Rep');
      expect(result.status).toBe('Active');
      // The invitation row should have been updated to Consumed
      expect(adminSheetsService.updateRow).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.arrayContaining(['Consumed']),
        expect.anything(),
      );
      // A new Users row should have been appended
      expect(adminSheetsService.appendRow).toHaveBeenCalledTimes(1);
    });

    it('throws an error when the invite token has expired', async () => {
      const expiredInvitation: Invitation = {
        ...validPendingInvitation,
        expiresAt: pastDate,
      };
      const expiredRow = [
        expiredInvitation.token,
        expiredInvitation.email,
        expiredInvitation.role,
        expiredInvitation.invitedBy,
        expiredInvitation.firstName ?? '',
        expiredInvitation.status,
        expiredInvitation.createdAt,
        expiredInvitation.expiresAt,
        '',
      ];

      adminSheetsService.getRange.mockResolvedValue([
        ['token', 'email', 'role', 'invited_by', 'first_name',
          'status', 'created_at', 'expires_at', 'consumed_at'],
        expiredRow,
      ]);

      const invitedGoogleUser: GoogleUser = { ...mockGoogleUser, email: expiredInvitation.email };

      await expect(
        service.processInviteToken(expiredInvitation.token, invitedGoogleUser),
      ).rejects.toThrow();
    });

    it('throws an error when the invite token has been revoked', async () => {
      const revokedInvitation: Invitation = {
        ...validPendingInvitation,
        status: 'Revoked',
      };
      const revokedRow = [
        revokedInvitation.token,
        revokedInvitation.email,
        revokedInvitation.role,
        revokedInvitation.invitedBy,
        revokedInvitation.firstName ?? '',
        revokedInvitation.status,
        revokedInvitation.createdAt,
        revokedInvitation.expiresAt,
        '',
      ];

      adminSheetsService.getRange.mockResolvedValue([
        ['token', 'email', 'role', 'invited_by', 'first_name',
          'status', 'created_at', 'expires_at', 'consumed_at'],
        revokedRow,
      ]);

      const invitedGoogleUser: GoogleUser = { ...mockGoogleUser, email: revokedInvitation.email };

      await expect(
        service.processInviteToken(revokedInvitation.token, invitedGoogleUser),
      ).rejects.toThrow();
    });

    it('throws an error when the invite token has already been consumed', async () => {
      const consumedInvitation: Invitation = {
        ...validPendingInvitation,
        status: 'Consumed',
        consumedAt: '2026-01-10T00:00:00.000Z',
      };
      const consumedRow = [
        consumedInvitation.token,
        consumedInvitation.email,
        consumedInvitation.role,
        consumedInvitation.invitedBy,
        consumedInvitation.firstName ?? '',
        consumedInvitation.status,
        consumedInvitation.createdAt,
        consumedInvitation.expiresAt,
        consumedInvitation.consumedAt,
      ];

      adminSheetsService.getRange.mockResolvedValue([
        ['token', 'email', 'role', 'invited_by', 'first_name',
          'status', 'created_at', 'expires_at', 'consumed_at'],
        consumedRow,
      ]);

      const invitedGoogleUser: GoogleUser = { ...mockGoogleUser, email: consumedInvitation.email };

      await expect(
        service.processInviteToken(consumedInvitation.token, invitedGoogleUser),
      ).rejects.toThrow();
    });

    it('throws an error when the invite token does not exist in the Invitations tab', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        ['token', 'email', 'role', 'invited_by', 'first_name',
          'status', 'created_at', 'expires_at', 'consumed_at'],
      ]);

      await expect(
        service.processInviteToken('nonexistent-token', mockGoogleUser),
      ).rejects.toThrow();
    });
  });
});
