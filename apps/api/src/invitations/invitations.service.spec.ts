/**
 * Test file: apps/api/src/invitations/invitations.service.spec.ts
 *
 * Covers:
 *  - create(dto, adminId) generates a 64-char hex token and writes an Invitation row
 *  - create(dto, adminId) calls MailService to send the invitation email
 *  - create(dto, adminId) throws ConflictException (409) when the email belongs to an
 *    Active user in the Users tab
 *  - create(dto, adminId) returns { duplicate: true, invitation } without creating a new row
 *    when a Pending invitation already exists for that email
 *  - findAll() returns all invitations mapped from the Invitations tab
 *  - findAll() returns an empty array when only the header row exists
 *  - revoke(token) sets status=Revoked on the matching Invitation row
 *  - revoke(token) throws NotFoundException (404) when no invitation row has the given token
 *  - resend(token) resets expiresAt to now+72h and calls MailService again
 *  - resend(token) throws NotFoundException (404) when no invitation row has the given token
 *  - validate(token) returns { valid: true, email, role } for a non-expired Pending invitation
 *  - validate(token) returns { valid: false, reason: 'expired' } for an expired invitation
 *  - validate(token) returns { valid: false, reason: 'revoked' } for a Revoked invitation
 *  - validate(token) returns { valid: false, reason: 'consumed' } for a Consumed invitation
 *  - validate(token) returns { valid: false, reason: 'not_found' } for an unknown token
 *
 * Developer must implement:
 *  - apps/api/src/invitations/invitations.service.ts — InvitationsService with the methods above
 *  - apps/api/src/invitations/invitations.module.ts  — InvitationsModule
 *  - apps/api/src/invitations/dto/create-invitation.dto.ts — { email, role, firstName? }
 *  - apps/api/src/mail/mail.service.ts — MailService with sendInvitation(to, token, role) method
 *  - Token must be crypto.randomBytes(32).toString('hex') — 64 hex chars
 *  - expiresAt = now + 72 hours
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { CrmUser, Invitation, CrmRole } from '@crm/types';
import { InvitationsService } from './invitations.service';
import { AdminSheetsService } from '../auth/admin-sheets.service';
import { MailService } from '../mail/mail.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLATFORM_SHEET_ID = 'platform-sheet-id';

const INVITATIONS_HEADER = [
  'token', 'email', 'role', 'invited_by', 'first_name',
  'status', 'created_at', 'expires_at', 'consumed_at',
];

const USERS_HEADER = [
  'id', 'google_id', 'email', 'first_name', 'last_name',
  'role', 'status', 'team_id', 'sheet_id', 'sheet_ownership',
  'created_at', 'updated_at',
];

const FUTURE_DATE = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 1).toISOString();

const ADMIN_ID = 'user-admin-1';

function makeInvitationRow(invitation: Invitation): string[] {
  return [
    invitation.token,
    invitation.email,
    invitation.role,
    invitation.invitedBy,
    invitation.firstName ?? '',
    invitation.status,
    invitation.createdAt,
    invitation.expiresAt,
    invitation.consumedAt ?? '',
  ];
}

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

const pendingInvitation: Invitation = {
  token: 'a'.repeat(64),
  email: 'newrep@company.com',
  role: 'Sales Rep',
  invitedBy: ADMIN_ID,
  firstName: 'Bob',
  status: 'Pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: FUTURE_DATE,
};

const revokedInvitation: Invitation = {
  ...pendingInvitation,
  token: 'b'.repeat(64),
  status: 'Revoked',
};

const consumedInvitation: Invitation = {
  ...pendingInvitation,
  token: 'c'.repeat(64),
  status: 'Consumed',
  consumedAt: '2026-01-10T00:00:00.000Z',
};

const expiredInvitation: Invitation = {
  ...pendingInvitation,
  token: 'd'.repeat(64),
  expiresAt: PAST_DATE,
};

const activeUser: CrmUser = {
  id: 'user-active-1',
  googleId: 'gid-active-1',
  email: 'existing@company.com',
  firstName: 'Existing',
  lastName: 'User',
  role: 'Sales Rep',
  status: 'Active',
  sheetId: 'sheet-1',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

function buildMailServiceMock(): jest.Mocked<MailService> {
  return {
    sendInvitation: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MailService>;
}

async function buildModule(
  adminSheetsMock: jest.Mocked<AdminSheetsService>,
  mailServiceMock: jest.Mocked<MailService>,
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      InvitationsService,
      { provide: AdminSheetsService, useValue: adminSheetsMock },
      { provide: MailService, useValue: mailServiceMock },
    ],
  }).compile();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvitationsService', () => {
  let service: InvitationsService;
  let adminSheetsService: jest.Mocked<AdminSheetsService>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    adminSheetsService = buildAdminSheetsServiceMock();
    mailService = buildMailServiceMock();
    const module = await buildModule(adminSheetsService, mailService);
    service = module.get<InvitationsService>(InvitationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create(dto, adminId)', () => {
    it('generates a 64-character hex token and writes a new Invitation row', async () => {
      // No existing users with this email
      adminSheetsService.getRange
        .mockResolvedValueOnce([USERS_HEADER]) // Users tab
        .mockResolvedValueOnce([INVITATIONS_HEADER]); // Invitations tab
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      const dto = { email: 'newrep@company.com', role: 'Sales Rep' as CrmRole };
      const result = await service.create(dto, ADMIN_ID);

      expect(adminSheetsService.appendRow).toHaveBeenCalledTimes(1);

      // The result should carry the token
      if ('invitation' in result) {
        expect((result as any).invitation.token).toHaveLength(64);
        expect((result as any).invitation.token).toMatch(/^[0-9a-f]{64}$/);
      } else {
        expect((result as any).token).toHaveLength(64);
        expect((result as any).token).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('calls MailService.sendInvitation with the new invite token and email', async () => {
      adminSheetsService.getRange
        .mockResolvedValueOnce([USERS_HEADER])
        .mockResolvedValueOnce([INVITATIONS_HEADER]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      const dto = { email: 'newrep@company.com', role: 'Sales Rep' as CrmRole };
      await service.create(dto, ADMIN_ID);

      expect(mailService.sendInvitation).toHaveBeenCalledTimes(1);
      const [toEmail] = mailService.sendInvitation.mock.calls[0];
      expect(toEmail).toBe('newrep@company.com');
    });

    it('sets expiresAt approximately 72 hours from now', async () => {
      adminSheetsService.getRange
        .mockResolvedValueOnce([USERS_HEADER])
        .mockResolvedValueOnce([INVITATIONS_HEADER]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      const beforeCall = Date.now();
      const dto = { email: 'newrep@company.com', role: 'Sales Rep' as CrmRole };
      const result = await service.create(dto, ADMIN_ID);
      const afterCall = Date.now();

      const invitation: Invitation = 'invitation' in result
        ? (result as any).invitation
        : result as any;

      const expiresAt = new Date(invitation.expiresAt).getTime();
      const expectedMin = beforeCall + 72 * 60 * 60 * 1000;
      const expectedMax = afterCall + 72 * 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('throws ConflictException when the email belongs to an Active user', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([
        USERS_HEADER,
        makeUserRow(activeUser),
      ]);

      const dto = { email: activeUser.email, role: 'Sales Rep' as CrmRole };

      await expect(service.create(dto, ADMIN_ID)).rejects.toThrow(ConflictException);
      expect(adminSheetsService.appendRow).not.toHaveBeenCalled();
      expect(mailService.sendInvitation).not.toHaveBeenCalled();
    });

    it('does NOT throw ConflictException when an existing user with that email is Deactivated', async () => {
      const deactivatedUser: CrmUser = { ...activeUser, status: 'Deactivated' };
      adminSheetsService.getRange
        .mockResolvedValueOnce([USERS_HEADER, makeUserRow(deactivatedUser)])
        .mockResolvedValueOnce([INVITATIONS_HEADER]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      const dto = { email: deactivatedUser.email, role: 'Sales Rep' as CrmRole };

      await expect(service.create(dto, ADMIN_ID)).resolves.not.toThrow();
    });

    it('returns { duplicate: true, invitation } without creating a new row when a Pending invite exists for that email', async () => {
      adminSheetsService.getRange
        .mockResolvedValueOnce([USERS_HEADER]) // no Active user
        .mockResolvedValueOnce([
          INVITATIONS_HEADER,
          makeInvitationRow(pendingInvitation),
        ]);

      const dto = { email: pendingInvitation.email, role: 'Sales Rep' as CrmRole };
      const result = await service.create(dto, ADMIN_ID);

      expect(adminSheetsService.appendRow).not.toHaveBeenCalled();
      expect(mailService.sendInvitation).not.toHaveBeenCalled();

      expect((result as any).duplicate).toBe(true);
      expect((result as any).invitation).toBeDefined();
      expect((result as any).invitation.email).toBe(pendingInvitation.email);
    });

    it('creates a new invitation even when a Revoked invite exists for that email', async () => {
      adminSheetsService.getRange
        .mockResolvedValueOnce([USERS_HEADER])
        .mockResolvedValueOnce([
          INVITATIONS_HEADER,
          makeInvitationRow(revokedInvitation),
        ]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      const dto = { email: revokedInvitation.email, role: 'Sales Rep' as CrmRole };
      const result = await service.create(dto, ADMIN_ID);

      expect(adminSheetsService.appendRow).toHaveBeenCalledTimes(1);
      expect((result as any).duplicate).not.toBe(true);
    });

    it('stores the correct invitedBy (adminId) and role on the written row', async () => {
      adminSheetsService.getRange
        .mockResolvedValueOnce([USERS_HEADER])
        .mockResolvedValueOnce([INVITATIONS_HEADER]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      const dto = { email: 'newrep@company.com', role: 'Sales Manager' as CrmRole };
      await service.create(dto, ADMIN_ID);

      const appendedRow: string[] = adminSheetsService.appendRow.mock.calls[0][2];
      expect(appendedRow).toContain(ADMIN_ID);
      expect(appendedRow).toContain('Sales Manager');
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns all invitations mapped from the Invitations tab', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(pendingInvitation),
        makeInvitationRow(revokedInvitation),
        makeInvitationRow(consumedInvitation),
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(3);
    });

    it('returns an empty array when only the header row exists', async () => {
      adminSheetsService.getRange.mockResolvedValue([INVITATIONS_HEADER]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });

    it('maps token, email, role, and status fields correctly', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(pendingInvitation),
      ]);

      const [result] = await service.findAll();

      expect(result.token).toBe(pendingInvitation.token);
      expect(result.email).toBe(pendingInvitation.email);
      expect(result.role).toBe(pendingInvitation.role);
      expect(result.status).toBe('Pending');
    });
  });

  // ── revoke ─────────────────────────────────────────────────────────────────

  describe('revoke(token)', () => {
    it('sets status=Revoked on the matching Invitation row', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(pendingInvitation),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      await service.revoke(pendingInvitation.token);

      expect(adminSheetsService.updateRow).toHaveBeenCalledTimes(1);
      const writtenRow: string[] = adminSheetsService.updateRow.mock.calls[0][2];
      expect(writtenRow).toContain('Revoked');
    });

    it('throws NotFoundException when no invitation row has the given token', async () => {
      adminSheetsService.getRange.mockResolvedValue([INVITATIONS_HEADER]);

      await expect(service.revoke('nonexistent-token')).rejects.toThrow(NotFoundException);
      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });
  });

  // ── resend ─────────────────────────────────────────────────────────────────

  describe('resend(token)', () => {
    it('resets expiresAt to now+72h and calls MailService.sendInvitation again', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(pendingInvitation),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const beforeCall = Date.now();
      await service.resend(pendingInvitation.token);
      const afterCall = Date.now();

      expect(adminSheetsService.updateRow).toHaveBeenCalledTimes(1);
      expect(mailService.sendInvitation).toHaveBeenCalledTimes(1);

      const writtenRow: string[] = adminSheetsService.updateRow.mock.calls[0][2];
      // expiresAt is stored at index 7 in the Invitations row
      const newExpiresAt = new Date(writtenRow[7]).getTime();
      expect(newExpiresAt).toBeGreaterThanOrEqual(beforeCall + 72 * 60 * 60 * 1000);
      expect(newExpiresAt).toBeLessThanOrEqual(afterCall + 72 * 60 * 60 * 1000);
    });

    it('throws NotFoundException when no invitation row has the given token', async () => {
      adminSheetsService.getRange.mockResolvedValue([INVITATIONS_HEADER]);

      await expect(service.resend('nonexistent-token')).rejects.toThrow(NotFoundException);
      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
      expect(mailService.sendInvitation).not.toHaveBeenCalled();
    });

    it('sends the email to the same address as the original invitation', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(pendingInvitation),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      await service.resend(pendingInvitation.token);

      const [toEmail] = mailService.sendInvitation.mock.calls[0];
      expect(toEmail).toBe(pendingInvitation.email);
    });
  });

  // ── validate ───────────────────────────────────────────────────────────────

  describe('validate(token)', () => {
    it('returns { valid: true, email, role } for a non-expired Pending invitation', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(pendingInvitation),
      ]);

      const result = await service.validate(pendingInvitation.token);

      expect(result.valid).toBe(true);
      expect((result as any).email).toBe(pendingInvitation.email);
      expect((result as any).role).toBe(pendingInvitation.role);
    });

    it('returns { valid: false, reason: "expired" } for an expired invitation', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(expiredInvitation),
      ]);

      const result = await service.validate(expiredInvitation.token);

      expect(result.valid).toBe(false);
      expect((result as any).reason).toBe('expired');
    });

    it('returns { valid: false, reason: "revoked" } for a Revoked invitation', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(revokedInvitation),
      ]);

      const result = await service.validate(revokedInvitation.token);

      expect(result.valid).toBe(false);
      expect((result as any).reason).toBe('revoked');
    });

    it('returns { valid: false, reason: "consumed" } for a Consumed invitation', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(consumedInvitation),
      ]);

      const result = await service.validate(consumedInvitation.token);

      expect(result.valid).toBe(false);
      expect((result as any).reason).toBe('consumed');
    });

    it('returns { valid: false, reason: "not_found" } for an unknown token', async () => {
      adminSheetsService.getRange.mockResolvedValue([INVITATIONS_HEADER]);

      const result = await service.validate('unknown-token-that-does-not-exist');

      expect(result.valid).toBe(false);
      expect((result as any).reason).toBe('not_found');
    });

    it('treats a Pending invitation whose expiresAt is exactly now as expired', async () => {
      // Force a token that expires exactly at "now" — the boundary: any time <= now is expired
      const boundaryInvitation: Invitation = {
        ...pendingInvitation,
        token: 'e'.repeat(64),
        expiresAt: new Date(Date.now() - 1).toISOString(), // 1ms in the past
      };

      adminSheetsService.getRange.mockResolvedValue([
        INVITATIONS_HEADER,
        makeInvitationRow(boundaryInvitation),
      ]);

      const result = await service.validate(boundaryInvitation.token);

      expect(result.valid).toBe(false);
      expect((result as any).reason).toBe('expired');
    });
  });
});
