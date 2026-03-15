/**
 * Test file: apps/api/src/teams/teams.service.spec.ts
 *
 * Covers:
 *  - findAll() returns all teams mapped from the Teams tab, with memberIds parsed
 *    from the pipe-delimited member_ids column
 *  - findAll() returns an empty array when only the header row exists
 *  - findAll() parses a single-member pipe string correctly
 *  - findAll() returns empty memberIds array when member_ids cell is empty string
 *  - create(dto) appends a new row to Teams tab; updates teamId on each listed member
 *    in the Users tab; returns the created Team
 *  - create(dto) generates a unique id for the new team
 *  - create(dto) with no memberIds creates the team and does not write Users rows
 *  - update(id, dto) updates name, managerId, and/or memberIds in the Teams row
 *  - update(id, dto) when memberIds change, removes teamId from users no longer in team
 *    and adds teamId to newly added members
 *  - update(id, dto) throws NotFoundException when no team row has the given id
 *  - delete(id) removes the team row from the Teams tab; sets teamId='' on all former members
 *  - delete(id) throws NotFoundException when no team row has the given id
 *
 * Developer must implement:
 *  - apps/api/src/teams/teams.service.ts — TeamsService with the methods above
 *  - apps/api/src/teams/teams.module.ts  — TeamsModule wiring AdminSheetsService
 *  - apps/api/src/teams/dto/create-team.dto.ts — CreateTeamDto { name, managerId?, memberIds? }
 *  - apps/api/src/teams/dto/update-team.dto.ts — UpdateTeamDto (Partial<CreateTeamDto>)
 *  - team row deletion must shift subsequent rows; or use a Spreadsheet batchUpdate delete to
 *    remove the physical row; the Teams tab must not retain a blank row after delete
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { Team, CrmUser } from '@crm/types';
import { TeamsService } from './teams.service';
import { AdminSheetsService } from '../auth/admin-sheets.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLATFORM_SHEET_ID = 'platform-sheet-id';

const TEAMS_HEADER = ['id', 'name', 'manager_id', 'member_ids', 'created_at', 'updated_at'];

const USERS_HEADER = [
  'id', 'google_id', 'email', 'first_name', 'last_name',
  'role', 'status', 'team_id', 'sheet_id', 'sheet_ownership',
  'created_at', 'updated_at',
];

function makeTeamRow(team: Team): string[] {
  return [
    team.id,
    team.name,
    team.managerId ?? '',
    team.memberIds.join('|'),
    team.createdAt,
    team.updatedAt,
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

const teamAlpha: Team = {
  id: 'team-alpha',
  name: 'Alpha Squad',
  managerId: 'user-mgr-1',
  memberIds: ['user-rep-1', 'user-rep-2'],
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

const rep1: CrmUser = {
  id: 'user-rep-1',
  googleId: 'gid-rep-1',
  email: 'rep1@company.com',
  firstName: 'Bob',
  lastName: 'Rep',
  role: 'Sales Rep',
  status: 'Active',
  teamId: 'team-alpha',
  sheetId: 'sheet-rep-1',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const rep2: CrmUser = {
  id: 'user-rep-2',
  googleId: 'gid-rep-2',
  email: 'rep2@company.com',
  firstName: 'Dan',
  lastName: 'Rep',
  role: 'Sales Rep',
  status: 'Active',
  teamId: 'team-alpha',
  sheetId: 'sheet-rep-2',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const rep3: CrmUser = {
  id: 'user-rep-3',
  googleId: 'gid-rep-3',
  email: 'rep3@company.com',
  firstName: 'Eve',
  lastName: 'Rep',
  role: 'Sales Rep',
  status: 'Active',
  sheetId: 'sheet-rep-3',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const manager: CrmUser = {
  id: 'user-mgr-1',
  googleId: 'gid-mgr-1',
  email: 'mgr@company.com',
  firstName: 'Carol',
  lastName: 'Manager',
  role: 'Sales Manager',
  status: 'Active',
  sheetId: 'sheet-mgr-1',
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

async function buildModule(
  adminSheetsMock: jest.Mocked<AdminSheetsService>,
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      TeamsService,
      { provide: AdminSheetsService, useValue: adminSheetsMock },
    ],
  }).compile();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamsService', () => {
  let service: TeamsService;
  let adminSheetsService: jest.Mocked<AdminSheetsService>;

  beforeEach(async () => {
    adminSheetsService = buildAdminSheetsServiceMock();
    const module = await buildModule(adminSheetsService);
    service = module.get<TeamsService>(TeamsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns all teams mapped from the Teams tab skipping the header row', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha),
        makeTeamRow(teamBeta),
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(teamAlpha.id);
      expect(result[1].id).toBe(teamBeta.id);
    });

    it('parses the pipe-delimited member_ids string into a memberIds array', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha),
      ]);

      const [result] = await service.findAll();

      expect(result.memberIds).toEqual(['user-rep-1', 'user-rep-2']);
    });

    it('returns an empty memberIds array when the member_ids cell is empty', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        TEAMS_HEADER,
        makeTeamRow(teamBeta),
      ]);

      const [result] = await service.findAll();

      expect(result.memberIds).toEqual([]);
    });

    it('handles a single member in the pipe-delimited string correctly', async () => {
      const singleMemberTeam: Team = {
        ...teamAlpha,
        memberIds: ['user-rep-1'],
      };

      adminSheetsService.getRange.mockResolvedValue([
        TEAMS_HEADER,
        makeTeamRow(singleMemberTeam),
      ]);

      const [result] = await service.findAll();

      expect(result.memberIds).toEqual(['user-rep-1']);
    });

    it('returns an empty array when only the header row exists', async () => {
      adminSheetsService.getRange.mockResolvedValue([TEAMS_HEADER]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });

    it('maps name and managerId fields correctly', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha),
      ]);

      const [result] = await service.findAll();

      expect(result.name).toBe(teamAlpha.name);
      expect(result.managerId).toBe(teamAlpha.managerId);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create(dto)', () => {
    it('appends a new row to the Teams tab and returns the created Team', async () => {
      // Teams tab — empty
      adminSheetsService.getRange.mockResolvedValueOnce([TEAMS_HEADER]);
      // Users tab for member assignment
      adminSheetsService.getRange.mockResolvedValueOnce([
        USERS_HEADER,
        makeUserRow(rep1),
        makeUserRow(rep2),
        makeUserRow(manager),
      ]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const dto = {
        name: 'New Team',
        managerId: manager.id,
        memberIds: [rep1.id, rep2.id],
      };

      const result = await service.create(dto);

      expect(adminSheetsService.appendRow).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('New Team');
      expect(result.managerId).toBe(manager.id);
      expect(result.memberIds).toEqual(expect.arrayContaining([rep1.id, rep2.id]));
    });

    it('generates a non-empty unique id for the new team', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([TEAMS_HEADER]);
      adminSheetsService.getRange.mockResolvedValueOnce([USERS_HEADER]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      const result = await service.create({ name: 'Solo Team' });

      expect(result.id).toBeTruthy();
      expect(typeof result.id).toBe('string');
    });

    it('updates the teamId field on each assigned member in the Users tab', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([TEAMS_HEADER]);
      adminSheetsService.getRange.mockResolvedValueOnce([
        USERS_HEADER,
        makeUserRow(rep1),
        makeUserRow(rep2),
      ]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const dto = { name: 'Assigned Team', memberIds: [rep1.id, rep2.id] };
      await service.create(dto);

      // updateRow should be called once per member to stamp their teamId
      expect(adminSheetsService.updateRow).toHaveBeenCalledTimes(2);
    });

    it('does not call updateRow on Users tab when memberIds is empty', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([TEAMS_HEADER]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      await service.create({ name: 'Empty Team' });

      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });

    it('does not call updateRow on Users tab when memberIds is omitted', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([TEAMS_HEADER]);
      adminSheetsService.appendRow.mockResolvedValue(undefined);

      await service.create({ name: 'No Members Team' });

      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update(id, dto)', () => {
    it('updates the team name in the Teams row and returns the updated Team', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha),
      ]);
      adminSheetsService.getRange.mockResolvedValueOnce([USERS_HEADER]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const result = await service.update(teamAlpha.id, { name: 'Renamed Squad' });

      expect(adminSheetsService.updateRow).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Renamed Squad');
    });

    it('updates the managerId in the Teams row', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha),
      ]);
      adminSheetsService.getRange.mockResolvedValueOnce([USERS_HEADER]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      const result = await service.update(teamAlpha.id, { managerId: 'user-mgr-2' });

      expect(result.managerId).toBe('user-mgr-2');
    });

    it('removes teamId from users who are no longer in the team when memberIds change', async () => {
      // rep2 is being removed; rep3 is being added
      adminSheetsService.getRange.mockResolvedValueOnce([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha), // currently has rep1, rep2
      ]);
      adminSheetsService.getRange.mockResolvedValueOnce([
        USERS_HEADER,
        makeUserRow(rep1),
        makeUserRow(rep2),
        makeUserRow(rep3),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      await service.update(teamAlpha.id, { memberIds: [rep1.id, rep3.id] });

      // updateRow is called for: the team row itself + rep2 clear + rep3 assign
      const calls = adminSheetsService.updateRow.mock.calls;

      // At least the team row update plus user row updates
      expect(calls.length).toBeGreaterThanOrEqual(2);

      // The row written for rep2 should contain an empty teamId
      const rep2Update = calls.find((c) => {
        const row: string[] = c[2];
        return row.includes(rep2.id);
      });
      expect(rep2Update).toBeDefined();
      if (rep2Update) {
        const row: string[] = rep2Update[2];
        // teamId column (index 7) should be empty for rep2
        expect(row[7]).toBe('');
      }
    });

    it('adds teamId to newly assigned members when memberIds change', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha), // currently has rep1, rep2
      ]);
      adminSheetsService.getRange.mockResolvedValueOnce([
        USERS_HEADER,
        makeUserRow(rep1),
        makeUserRow(rep2),
        makeUserRow(rep3),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);

      await service.update(teamAlpha.id, { memberIds: [rep1.id, rep2.id, rep3.id] });

      const calls = adminSheetsService.updateRow.mock.calls;

      // A call must exist where rep3's row is written with teamAlpha.id as teamId
      const rep3Update = calls.find((c) => {
        const row: string[] = c[2];
        return row.includes(rep3.id);
      });
      expect(rep3Update).toBeDefined();
      if (rep3Update) {
        const row: string[] = rep3Update[2];
        expect(row[7]).toBe(teamAlpha.id);
      }
    });

    it('throws NotFoundException when no team row has the given id', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha),
      ]);

      await expect(service.update('nonexistent-team', { name: 'Ghost' })).rejects.toThrow(
        NotFoundException,
      );
      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete(id)', () => {
    it('removes the team row and clears teamId on all former member rows', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha),
      ]);
      adminSheetsService.getRange.mockResolvedValueOnce([
        USERS_HEADER,
        makeUserRow(rep1),
        makeUserRow(rep2),
        makeUserRow(manager),
      ]);
      adminSheetsService.updateRow.mockResolvedValue(undefined);
      // deleteRow or equivalent — the implementation may use a different method
      // We rely on the service to call the correct AdminSheetsService primitive
      (adminSheetsService as any).deleteRow = jest.fn().mockResolvedValue(undefined);

      await service.delete(teamAlpha.id);

      // teamId must be cleared on rep1 and rep2
      const updateCalls = adminSheetsService.updateRow.mock.calls;
      const rep1Update = updateCalls.find((c) => (c[2] as string[]).includes(rep1.id));
      const rep2Update = updateCalls.find((c) => (c[2] as string[]).includes(rep2.id));

      expect(rep1Update).toBeDefined();
      expect(rep2Update).toBeDefined();

      if (rep1Update) {
        expect((rep1Update[2] as string[])[7]).toBe('');
      }
      if (rep2Update) {
        expect((rep2Update[2] as string[])[7]).toBe('');
      }
    });

    it('throws NotFoundException when no team row has the given id', async () => {
      adminSheetsService.getRange.mockResolvedValue([
        TEAMS_HEADER,
        makeTeamRow(teamAlpha),
      ]);

      await expect(service.delete('nonexistent-team')).rejects.toThrow(NotFoundException);
    });

    it('does not call updateRow on Users tab when the deleted team has no members', async () => {
      adminSheetsService.getRange.mockResolvedValueOnce([
        TEAMS_HEADER,
        makeTeamRow(teamBeta), // no members
      ]);
      adminSheetsService.getRange.mockResolvedValueOnce([USERS_HEADER]);
      (adminSheetsService as any).deleteRow = jest.fn().mockResolvedValue(undefined);

      await service.delete(teamBeta.id);

      expect(adminSheetsService.updateRow).not.toHaveBeenCalled();
    });
  });
});
