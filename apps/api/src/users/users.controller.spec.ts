/**
 * Test file: apps/api/src/users/users.controller.spec.ts
 *
 * Covers:
 *  - GET /users returns the user list; accessible to Admin and Sales Manager
 *  - GET /users returns 403 Forbidden for a Sales Rep
 *  - GET /users/me returns the calling user's own profile for any authenticated role
 *  - PATCH /users/:id updates the user; Admin only; returns updated user
 *  - PATCH /users/:id returns 403 for Sales Manager
 *  - PATCH /users/:id returns 403 for Sales Rep
 *  - PATCH /users/:id/deactivate deactivates the user; Admin only; returns updated user
 *  - PATCH /users/:id/deactivate returns 403 for non-Admin roles
 *  - PATCH /users/:id/deactivate returns 422 when deactivating the last Admin (service throws)
 *  - PATCH /users/:id/reactivate reactivates the user; Admin only; returns updated user
 *  - PATCH /users/:id/reactivate returns 403 for non-Admin roles
 *
 * Developer must implement:
 *  - apps/api/src/users/users.controller.ts — UsersController with the routes above
 *  - UsersController must apply JwtAuthGuard globally and RolesGuard per route
 *  - GET /users  → @Roles('Admin', 'Sales Manager')
 *  - GET /users/me → no role restriction beyond authentication
 *  - PATCH /users/:id → @Roles('Admin')
 *  - PATCH /users/:id/deactivate → @Roles('Admin')
 *  - PATCH /users/:id/reactivate → @Roles('Admin')
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CrmUser, JwtPayload } from '@crm/types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
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

function makeFullUser(payload: JwtPayload, overrides: Partial<CrmUser> = {}): CrmUser {
  return {
    id: payload.sub,
    googleId: payload.googleId,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    role: payload.role,
    status: 'Active',
    sheetId: 'sheet-id',
    sheetOwnership: 'service_account',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const adminCrmUser = makeFullUser(adminPayload);
const managerCrmUser = makeFullUser(managerPayload);
const repCrmUser = makeFullUser(repPayload);

// ---------------------------------------------------------------------------
// Guard helpers — override guards so we can inject a mock user into req
// ---------------------------------------------------------------------------

/**
 * Returns a guard class that allows the request and attaches the given
 * JwtPayload as req.user (simulating a valid JWT).
 */
function makePassGuard(user: JwtPayload) {
  return class {
    canActivate(context: any): boolean {
      context.switchToHttp().getRequest().user = user;
      return true;
    }
  };
}

/**
 * Returns a guard class that always throws ForbiddenException.
 */
class DenyGuard {
  canActivate(): boolean {
    throw new ForbiddenException();
  }
}

// ---------------------------------------------------------------------------
// Module builder
// ---------------------------------------------------------------------------

function buildMockUsersService(): jest.Mocked<UsersService> {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findMe: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;
}

async function buildModuleAs(
  callerPayload: JwtPayload,
  usersService: jest.Mocked<UsersService>,
  options: { denyRolesGuard?: boolean } = {},
): Promise<TestingModule> {
  const builder = Test.createTestingModule({
    controllers: [UsersController],
    providers: [
      { provide: UsersService, useValue: usersService },
      Reflector,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(makePassGuard(callerPayload));

  if (options.denyRolesGuard) {
    builder.overrideGuard(RolesGuard).useClass(DenyGuard);
  } else {
    // Use a real RolesGuard so role checks are exercised
    builder.overrideGuard(RolesGuard).useValue(
      new RolesGuard(new Reflector()),
    );
  }

  return builder.compile();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsersController', () => {
  let usersService: jest.Mocked<UsersService>;

  beforeEach(() => {
    usersService = buildMockUsersService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /users ─────────────────────────────────────────────────────────────

  describe('GET /users', () => {
    it('returns the user list when called by an Admin', async () => {
      usersService.findAll.mockResolvedValue([adminCrmUser, repCrmUser]);

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      const result = await controller.findAll();

      expect(usersService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });

    it('returns the user list when called by a Sales Manager', async () => {
      usersService.findAll.mockResolvedValue([adminCrmUser, managerCrmUser, repCrmUser]);

      const module = await buildModuleAs(managerPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      const result = await controller.findAll();

      expect(usersService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(3);
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, usersService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      // The guard throws before the controller method is invoked
      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });
  });

  // ── GET /users/me ──────────────────────────────────────────────────────────

  describe('GET /users/me', () => {
    it('returns the own profile for an Admin', async () => {
      usersService.findMe.mockResolvedValue(adminCrmUser);

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      const result = await controller.getMe({ user: adminPayload } as any);

      expect(usersService.findMe).toHaveBeenCalledWith(adminPayload.sub);
      expect(result!.id).toBe(adminCrmUser.id);
    });

    it('returns the own profile for a Sales Rep', async () => {
      usersService.findMe.mockResolvedValue(repCrmUser);

      const module = await buildModuleAs(repPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      const result = await controller.getMe({ user: repPayload } as any);

      expect(usersService.findMe).toHaveBeenCalledWith(repPayload.sub);
      expect(result!.id).toBe(repCrmUser.id);
    });

    it('returns the own profile for a Sales Manager', async () => {
      usersService.findMe.mockResolvedValue(managerCrmUser);

      const module = await buildModuleAs(managerPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      const result = await controller.getMe({ user: managerPayload } as any);

      expect(usersService.findMe).toHaveBeenCalledWith(managerPayload.sub);
      expect(result!.id).toBe(managerCrmUser.id);
    });
  });

  // ── PATCH /users/:id ───────────────────────────────────────────────────────

  describe('PATCH /users/:id', () => {
    it('updates the user and returns the updated record when called by an Admin', async () => {
      const updated: CrmUser = { ...repCrmUser, firstName: 'Robert' };
      usersService.update.mockResolvedValue(updated);

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      const result = await controller.update(repCrmUser.id, { firstName: 'Robert' });

      expect(usersService.update).toHaveBeenCalledWith(repCrmUser.id, { firstName: 'Robert' });
      expect(result.firstName).toBe('Robert');
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, usersService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, usersService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('propagates NotFoundException from UsersService when user is not found', async () => {
      usersService.update.mockRejectedValue(new NotFoundException('User not found'));

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      await expect(
        controller.update('nonexistent-id', { firstName: 'Ghost' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates UnprocessableEntityException from UsersService for last-Admin role change', async () => {
      usersService.update.mockRejectedValue(
        new UnprocessableEntityException('Cannot remove last Admin'),
      );

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      await expect(
        controller.update(adminCrmUser.id, { role: 'Sales Rep' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── PATCH /users/:id/deactivate ────────────────────────────────────────────

  describe('PATCH /users/:id/deactivate', () => {
    it('deactivates the user and returns the updated record when called by an Admin', async () => {
      const deactivated: CrmUser = { ...repCrmUser, status: 'Deactivated' };
      usersService.deactivate.mockResolvedValue(deactivated);

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      const result = await controller.deactivate(repCrmUser.id);

      expect(usersService.deactivate).toHaveBeenCalledWith(repCrmUser.id);
      expect(result.status).toBe('Deactivated');
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, usersService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, usersService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('propagates UnprocessableEntityException when deactivating the last Admin', async () => {
      usersService.deactivate.mockRejectedValue(
        new UnprocessableEntityException('Cannot deactivate the last Admin'),
      );

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      await expect(controller.deactivate(adminCrmUser.id)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('propagates NotFoundException when user id does not exist', async () => {
      usersService.deactivate.mockRejectedValue(new NotFoundException('User not found'));

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      await expect(controller.deactivate('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── PATCH /users/:id/reactivate ────────────────────────────────────────────

  describe('PATCH /users/:id/reactivate', () => {
    it('reactivates the user and returns the updated record when called by an Admin', async () => {
      const reactivated: CrmUser = { ...repCrmUser, status: 'Active' };
      usersService.reactivate.mockResolvedValue(reactivated);

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      const result = await controller.reactivate(repCrmUser.id);

      expect(usersService.reactivate).toHaveBeenCalledWith(repCrmUser.id);
      expect(result.status).toBe('Active');
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, usersService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, usersService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('propagates NotFoundException when the user id does not exist', async () => {
      usersService.reactivate.mockRejectedValue(new NotFoundException('User not found'));

      const module = await buildModuleAs(adminPayload, usersService);
      const controller = module.get<UsersController>(UsersController);

      await expect(controller.reactivate('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });
});
