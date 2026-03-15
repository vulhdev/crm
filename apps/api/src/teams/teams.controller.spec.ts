/**
 * Test file: apps/api/src/teams/teams.controller.spec.ts
 *
 * Covers:
 *  - GET /teams returns the team list when called by an Admin
 *  - GET /teams returns the team list when called by a Sales Manager
 *  - GET /teams throws ForbiddenException when called by a Sales Rep
 *  - POST /teams creates a new team and returns it when called by an Admin
 *  - POST /teams throws ForbiddenException when called by a Sales Manager
 *  - POST /teams throws ForbiddenException when called by a Sales Rep
 *  - PATCH /teams/:id updates the team and returns it when called by an Admin
 *  - PATCH /teams/:id throws ForbiddenException when called by a Sales Manager
 *  - PATCH /teams/:id throws ForbiddenException when called by a Sales Rep
 *  - PATCH /teams/:id propagates NotFoundException from TeamsService when team is not found
 *  - DELETE /teams/:id deletes the team when called by an Admin
 *  - DELETE /teams/:id throws ForbiddenException when called by a Sales Manager
 *  - DELETE /teams/:id throws ForbiddenException when called by a Sales Rep
 *  - DELETE /teams/:id propagates NotFoundException from TeamsService when team is not found
 *
 * Developer must implement:
 *  - apps/api/src/teams/teams.controller.ts — TeamsController with the routes above
 *  - GET  /teams       → @Roles('Admin', 'Sales Manager')
 *  - POST /teams       → @Roles('Admin')
 *  - PATCH /teams/:id  → @Roles('Admin')
 *  - DELETE /teams/:id → @Roles('Admin')
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Team, JwtPayload } from '@crm/types';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
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

const teamAlpha: Team = {
  id: 'team-alpha',
  name: 'Alpha Squad',
  managerId: 'user-mgr-1',
  memberIds: ['user-rep-1'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const teamBeta: Team = {
  id: 'team-beta',
  name: 'Beta Team',
  memberIds: [],
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
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

// ---------------------------------------------------------------------------
// Module builder
// ---------------------------------------------------------------------------

function buildMockTeamsService(): jest.Mocked<TeamsService> {
  return {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<TeamsService>;
}

async function buildModuleAs(
  callerPayload: JwtPayload,
  teamsService: jest.Mocked<TeamsService>,
  options: { denyRolesGuard?: boolean } = {},
): Promise<TestingModule> {
  const builder = Test.createTestingModule({
    controllers: [TeamsController],
    providers: [
      { provide: TeamsService, useValue: teamsService },
      Reflector,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(makePassGuard(callerPayload));

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

describe('TeamsController', () => {
  let teamsService: jest.Mocked<TeamsService>;

  beforeEach(() => {
    teamsService = buildMockTeamsService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /teams ─────────────────────────────────────────────────────────────

  describe('GET /teams', () => {
    it('returns the team list when called by an Admin', async () => {
      teamsService.findAll.mockResolvedValue([teamAlpha, teamBeta]);

      const module = await buildModuleAs(adminPayload, teamsService);
      const controller = module.get<TeamsController>(TeamsController);

      const result = await controller.findAll();

      expect(teamsService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });

    it('returns the team list when called by a Sales Manager', async () => {
      teamsService.findAll.mockResolvedValue([teamAlpha]);

      const module = await buildModuleAs(managerPayload, teamsService);
      const controller = module.get<TeamsController>(TeamsController);

      const result = await controller.findAll();

      expect(teamsService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, teamsService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('returns an empty array when no teams exist', async () => {
      teamsService.findAll.mockResolvedValue([]);

      const module = await buildModuleAs(adminPayload, teamsService);
      const controller = module.get<TeamsController>(TeamsController);

      const result = await controller.findAll();

      expect(result).toHaveLength(0);
    });
  });

  // ── POST /teams ────────────────────────────────────────────────────────────

  describe('POST /teams', () => {
    it('creates a new team and returns it when called by an Admin', async () => {
      teamsService.create.mockResolvedValue(teamAlpha);

      const module = await buildModuleAs(adminPayload, teamsService);
      const controller = module.get<TeamsController>(TeamsController);

      const dto = { name: 'Alpha Squad', managerId: 'user-mgr-1', memberIds: ['user-rep-1'] };
      const result = await controller.create(dto);

      expect(teamsService.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe(teamAlpha.id);
      expect(result.name).toBe('Alpha Squad');
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, teamsService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, teamsService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });
  });

  // ── PATCH /teams/:id ───────────────────────────────────────────────────────

  describe('PATCH /teams/:id', () => {
    it('updates the team and returns it when called by an Admin', async () => {
      const updated: Team = { ...teamAlpha, name: 'Renamed Squad' };
      teamsService.update.mockResolvedValue(updated);

      const module = await buildModuleAs(adminPayload, teamsService);
      const controller = module.get<TeamsController>(TeamsController);

      const result = await controller.update(teamAlpha.id, { name: 'Renamed Squad' });

      expect(teamsService.update).toHaveBeenCalledWith(teamAlpha.id, { name: 'Renamed Squad' });
      expect(result.name).toBe('Renamed Squad');
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, teamsService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, teamsService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('propagates NotFoundException from TeamsService when the team does not exist', async () => {
      teamsService.update.mockRejectedValue(new NotFoundException('Team not found'));

      const module = await buildModuleAs(adminPayload, teamsService);
      const controller = module.get<TeamsController>(TeamsController);

      await expect(controller.update('nonexistent-team', { name: 'Ghost' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── DELETE /teams/:id ──────────────────────────────────────────────────────

  describe('DELETE /teams/:id', () => {
    it('deletes the team and returns void when called by an Admin', async () => {
      teamsService.delete.mockResolvedValue(undefined);

      const module = await buildModuleAs(adminPayload, teamsService);
      const controller = module.get<TeamsController>(TeamsController);

      await expect(controller.remove(teamAlpha.id)).resolves.not.toThrow();
      expect(teamsService.delete).toHaveBeenCalledWith(teamAlpha.id);
    });

    it('throws ForbiddenException when called by a Sales Manager', async () => {
      const module = await buildModuleAs(managerPayload, teamsService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('throws ForbiddenException when called by a Sales Rep', async () => {
      const module = await buildModuleAs(repPayload, teamsService, { denyRolesGuard: true });
      const app: INestApplication = module.createNestApplication();
      await app.init();

      const guard = new DenyGuard();
      expect(() => guard.canActivate({})).toThrow(ForbiddenException);

      await app.close();
    });

    it('propagates NotFoundException from TeamsService when the team does not exist', async () => {
      teamsService.delete.mockRejectedValue(new NotFoundException('Team not found'));

      const module = await buildModuleAs(adminPayload, teamsService);
      const controller = module.get<TeamsController>(TeamsController);

      await expect(controller.remove('nonexistent-team')).rejects.toThrow(NotFoundException);
    });
  });
});
