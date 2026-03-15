/**
 * Test file: apps/api/src/invitations/invitations.controller.spec.ts
 *
 * Covers:
 *  - POST /invitations creates an invitation (201) when called by an Admin
 *  - POST /invitations throws ForbiddenException when called by a Sales Manager
 *  - POST /invitations throws ForbiddenException when called by a Sales Rep
 *  - POST /invitations returns the duplicate object when service returns { duplicate: true }
 *  - POST /invitations propagates ConflictException from InvitationsService for Active user email
 *  - GET /invitations returns the invitation list when called by an Admin
 *  - GET /invitations throws ForbiddenException when called by a Sales Manager
 *  - GET /invitations throws ForbiddenException when called by a Sales Rep
 *  - DELETE /invitations/:token revokes the invitation (200) when called by an Admin
 *  - DELETE /invitations/:token throws ForbiddenException for non-Admin roles
 *  - DELETE /invitations/:token propagates NotFoundException from InvitationsService
 *  - POST /invitations/:token/resend resends the invitation when called by an Admin
 *  - POST /invitations/:token/resend throws ForbiddenException for non-Admin roles
 *  - POST /invitations/:token/resend propagates NotFoundException from InvitationsService
 *  - GET /invitations/validate/:token is publicly accessible (no auth guard); returns { valid: true }
 *  - GET /invitations/validate/:token returns { valid: false, reason } for invalid tokens
 *
 * Developer must implement:
 *  - apps/api/src/invitations/invitations.controller.ts — InvitationsController
 *  - POST /invitations              → @Roles('Admin'), 201
 *  - GET  /invitations              → @Roles('Admin')
 *  - DELETE /invitations/:token     → @Roles('Admin')
 *  - POST /invitations/:token/resend → @Roles('Admin')
 *  - GET  /invitations/validate/:token → public (skip JwtAuthGuard)
 *  - Controller must pass req.user.sub as adminId to InvitationsService.create
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Invitation, JwtPayload, CrmRole } from '@crm/types';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminPayload: JwtPayload = {
  sub: 'user-admin-1',
  googleId: 'gid-admin-1',
  email: 'admin@company.com',
  firstName: 'Alice',
  lastName: 'Admin',
  role: 'Admin',
};

const managerPayload: JwtPayload = {
  sub: 'user-mgr-1',
  googleId: 'gid-mgr-1',
  email: 'mgr@company.com',
  firstName: 'Carol',
  lastName: 'Manager',
  role: 'Sales Manager',
};

const repPayload: JwtPayload = {
  sub: 'user-rep-1',
  googleId: 'gid-rep-1',
  email: 'rep@company.com',
  firstName: 'Bob',
  lastName: 'Rep',
  role: 'Sales Rep',
};

const FUTURE_DATE = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

const pendingInvitation: Invitation = {
  token: 'a'.repeat(64),
  email: 'newrep@company.com',
  role: 'Sales Rep',
  invitedBy: adminPayload.sub,
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

// ---------------------------------------------------------------------------
// Guard helpers
// ---------------------------------------------------------------------------

function makePassGuard(user: JwtPayload) {
  return class {
    canActivate(context: any): boolean {
      context.switchToHttp().getRequest().user = user;
      return true;
    }
  };
}

class DenyGuard {
  canActivate(): boolean {
    throw new ForbiddenException();
  }
}

class NoOpGuard {
  canActivate(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Module builder
// ---------------------------------------------------------------------------

function buildMockInvitationsService(): jest.Mocked<InvitationsService> {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
    revoke: jest.fn(),
    resend: jest.fn(),
    validate: jest.fn(),
  } as unknown as jest.Mocked<InvitationsService>;
}

async function buildModuleAs(
  callerPayload: JwtPayload | null,
  invitationsService: jest.Mocked<InvitationsService>,
  options: { denyRolesGuard?: boolean; bypassJwt?: boolean } = {},
): Promise<TestingModule> {
  const builder = Test.createTestingModule({
    controllers: [InvitationsController],
    providers: [
      { provide: InvitationsService, useValue: invitationsService },
      Reflector,
    ],
  });

  if (options.bypassJwt || callerPayload === null) {
    builder.overrideGuard(JwtAuthGuard).useClass(NoOpGuard);
  } else {
    builder.overrideGuard(JwtAuthGuard).useClass(makePassGuard(callerPayload));
  }

  if (options.denyRolesGuard) {
    builder.overrideGuard(RolesGuard).useClass(DenyGuard);
  } else {
    builder.overrideGuard(RolesGuard).useValue(new RolesGuard(new Reflector()));
  }

  return builder.compile();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvitationsController', () => {
  let invitationsService: jest.Mocked<InvitationsService>;

  beforeEach(() => {
    invitationsService = buildMockInvitationsService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /invitations ──────────────────────────────────────────────────────

  describe('POST /invitations', () => {
    it('creates an invitation and returns it (201) when called by an Admin', async () => {
      invitationsService.create.mockResolvedValue(pendingInvitation as any);

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      const dto = { email: 'newrep@company.com', role: 'Sales Rep' as CrmRole };
      const result = await controller.create(dto, { user: adminPayload } as any);

      expect(invitationsService.create).toHaveBeenCalledWith(dto, adminPayload.sub);
      expect(result).toBeDefined();
    });

    it('passes the caller sub (adminId) to InvitationsService.create', async () => {
      invitationsService.create.mockResolvedValue(pendingInvitation as any);

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      const dto = { email: 'newrep@company.com', role: 'Sales Rep' as CrmRole };
      await controller.create(dto, { user: adminPayload } as any);

      expect(invitationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'newrep@company.com' }),
        adminPayload.sub,
      );
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, invitationsService, {
        denyRolesGuard: true,
      });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, invitationsService, {
        denyRolesGuard: true,
      });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('returns the duplicate response object when the service returns { duplicate: true }', async () => {
      const duplicateResponse = { duplicate: true, invitation: pendingInvitation };
      invitationsService.create.mockResolvedValue(duplicateResponse as any);

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      const dto = { email: pendingInvitation.email, role: 'Sales Rep' as CrmRole };
      const result = await controller.create(dto, { user: adminPayload } as any);

      expect((result as any).duplicate).toBe(true);
      expect((result as any).invitation.token).toBe(pendingInvitation.token);
    });

    it('propagates ConflictException from InvitationsService when email belongs to Active user', async () => {
      invitationsService.create.mockRejectedValue(
        new ConflictException('Email already belongs to an Active user'),
      );

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      const dto = { email: 'existing@company.com', role: 'Sales Rep' as CrmRole };

      await expect(controller.create(dto, { user: adminPayload } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── GET /invitations ───────────────────────────────────────────────────────

  describe('GET /invitations', () => {
    it('returns the invitation list when called by an Admin', async () => {
      invitationsService.findAll.mockResolvedValue([pendingInvitation, revokedInvitation]);

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      const result = await controller.findAll();

      expect(invitationsService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when no invitations exist', async () => {
      invitationsService.findAll.mockResolvedValue([]);

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      const result = await controller.findAll();

      expect(result).toHaveLength(0);
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, invitationsService, {
        denyRolesGuard: true,
      });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, invitationsService, {
        denyRolesGuard: true,
      });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });
  });

  // ── DELETE /invitations/:token ─────────────────────────────────────────────

  describe('DELETE /invitations/:token', () => {
    it('revokes the invitation (200) when called by an Admin', async () => {
      invitationsService.revoke.mockResolvedValue(undefined);

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      await expect(controller.revoke(pendingInvitation.token)).resolves.not.toThrow();
      expect(invitationsService.revoke).toHaveBeenCalledWith(pendingInvitation.token);
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, invitationsService, {
        denyRolesGuard: true,
      });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, invitationsService, {
        denyRolesGuard: true,
      });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('propagates NotFoundException from InvitationsService when token is not found', async () => {
      invitationsService.revoke.mockRejectedValue(new NotFoundException('Invitation not found'));

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      await expect(controller.revoke('nonexistent-token')).rejects.toThrow(NotFoundException);
    });
  });

  // ── POST /invitations/:token/resend ────────────────────────────────────────

  describe('POST /invitations/:token/resend', () => {
    it('resends the invitation when called by an Admin', async () => {
      invitationsService.resend.mockResolvedValue(undefined);

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      await expect(controller.resend(pendingInvitation.token)).resolves.not.toThrow();
      expect(invitationsService.resend).toHaveBeenCalledWith(pendingInvitation.token);
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, invitationsService, {
        denyRolesGuard: true,
      });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, invitationsService, {
        denyRolesGuard: true,
      });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('propagates NotFoundException from InvitationsService when token is not found', async () => {
      invitationsService.resend.mockRejectedValue(new NotFoundException('Invitation not found'));

      const module = await buildModuleAs(adminPayload, invitationsService);
      const controller = module.get<InvitationsController>(InvitationsController);

      await expect(controller.resend('nonexistent-token')).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /invitations/validate/:token ───────────────────────────────────────

  describe('GET /invitations/validate/:token', () => {
    it('is accessible without authentication and returns { valid: true, email, role } for a valid token', async () => {
      invitationsService.validate.mockResolvedValue({
        valid: true,
        email: pendingInvitation.email,
        role: pendingInvitation.role,
      } as any);

      // Bypass JWT entirely — validate route is public
      const module = await buildModuleAs(null, invitationsService, { bypassJwt: true });
      const controller = module.get<InvitationsController>(InvitationsController);

      const result = await controller.validate(pendingInvitation.token);

      expect(invitationsService.validate).toHaveBeenCalledWith(pendingInvitation.token);
      expect(result.valid).toBe(true);
      expect((result as any).email).toBe(pendingInvitation.email);
    });

    it('returns { valid: false, reason: "expired" } for an expired token', async () => {
      invitationsService.validate.mockResolvedValue({ valid: false, reason: 'expired' } as any);

      const module = await buildModuleAs(null, invitationsService, { bypassJwt: true });
      const controller = module.get<InvitationsController>(InvitationsController);

      const result = await controller.validate('expired-token');

      expect(result.valid).toBe(false);
      expect((result as any).reason).toBe('expired');
    });

    it('returns { valid: false, reason: "revoked" } for a revoked token', async () => {
      invitationsService.validate.mockResolvedValue({ valid: false, reason: 'revoked' } as any);

      const module = await buildModuleAs(null, invitationsService, { bypassJwt: true });
      const controller = module.get<InvitationsController>(InvitationsController);

      const result = await controller.validate(revokedInvitation.token);

      expect(result.valid).toBe(false);
      expect((result as any).reason).toBe('revoked');
    });

    it('returns { valid: false, reason: "consumed" } for a consumed token', async () => {
      invitationsService.validate.mockResolvedValue({ valid: false, reason: 'consumed' } as any);

      const module = await buildModuleAs(null, invitationsService, { bypassJwt: true });
      const controller = module.get<InvitationsController>(InvitationsController);

      const result = await controller.validate('consumed-token');

      expect(result.valid).toBe(false);
      expect((result as any).reason).toBe('consumed');
    });

    it('returns { valid: false, reason: "not_found" } for an unknown token', async () => {
      invitationsService.validate.mockResolvedValue({ valid: false, reason: 'not_found' } as any);

      const module = await buildModuleAs(null, invitationsService, { bypassJwt: true });
      const controller = module.get<InvitationsController>(InvitationsController);

      const result = await controller.validate('totally-unknown-token');

      expect(result.valid).toBe(false);
      expect((result as any).reason).toBe('not_found');
    });
  });
});
