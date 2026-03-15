/**
 * Test file: apps/api/src/auth/admin-sheets.service.spec.ts
 *
 * Covers:
 *  - AdminSheetsService reads a range from a spreadsheet via Service Account credentials
 *  - AdminSheetsService appends a row to a spreadsheet via Service Account credentials
 *  - AdminSheetsService initialises platform sheet tabs (Users, Invitations, Teams) with
 *    correct headers when the sheet is empty on first run
 *  - AdminSheetsService throws when GOOGLE_SERVICE_ACCOUNT_KEY is missing
 *  - AdminSheetsService throws when PLATFORM_SHEET_ID is missing
 *
 * Developer must implement:
 *  - apps/api/src/auth/admin-sheets.service.ts — AdminSheetsService using
 *    google.auth.GoogleAuth with GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_SERVICE_ACCOUNT_EMAIL
 *  - onModuleInit() that calls initPlatformTabs() to provision headers
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminSheetsService } from './admin-sheets.service';

// ---------------------------------------------------------------------------
// Shared mock key for all GoogleAuth / googleapis interactions
// ---------------------------------------------------------------------------

const mockValuesGet = jest.fn();
const mockValuesAppend = jest.fn();
const mockSpreadsheetsBatchUpdate = jest.fn();
const mockSpreadsheetsGet = jest.fn();

jest.mock('googleapis', () => {
  const sheetsInstance = {
    spreadsheets: {
      values: {
        get: (...args: unknown[]) => mockValuesGet(...args),
        append: (...args: unknown[]) => mockValuesAppend(...args),
      },
      batchUpdate: (...args: unknown[]) => mockSpreadsheetsBatchUpdate(...args),
      get: (...args: unknown[]) => mockSpreadsheetsGet(...args),
    },
  };

  return {
    google: {
      auth: {
        GoogleAuth: jest.fn().mockImplementation(() => ({
          getClient: jest.fn().mockResolvedValue({}),
        })),
      },
      sheets: jest.fn().mockReturnValue(sheetsInstance),
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_SHEET_ID = 'platform-sheet-id-abc';
const SERVICE_ACCOUNT_EMAIL = 'sa@project.iam.gserviceaccount.com';
const SERVICE_ACCOUNT_KEY = JSON.stringify({ type: 'service_account' });

function buildConfigService(overrides: Record<string, string | undefined> = {}): Partial<ConfigService> {
  const defaults: Record<string, string> = {
    PLATFORM_SHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_KEY: SERVICE_ACCOUNT_KEY,
  };
  const merged = { ...defaults, ...overrides };
  return {
    get: jest.fn((key: string) => merged[key]),
  };
}

async function buildModule(configOverrides: Record<string, string | undefined> = {}): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      AdminSheetsService,
      { provide: ConfigService, useValue: buildConfigService(configOverrides) },
    ],
  }).compile();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminSheetsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reads a spreadsheet range using Service Account credentials', () => {
    it('returns parsed row data from the given range', async () => {
      const module = await buildModule();
      const service = module.get<AdminSheetsService>(AdminSheetsService);

      const mockRows = [
        ['id', 'google_id', 'email'],
        ['user-1', 'gid-1', 'alice@example.com'],
      ];
      mockValuesGet.mockResolvedValue({ data: { values: mockRows } });

      const result = await service.getRange(PLATFORM_SHEET_ID, 'Users!A:L');

      expect(mockValuesGet).toHaveBeenCalledWith(
        expect.objectContaining({ spreadsheetId: PLATFORM_SHEET_ID, range: 'Users!A:L' }),
      );
      expect(result).toEqual(mockRows);
    });

    it('returns an empty array when the sheet has no data', async () => {
      const module = await buildModule();
      const service = module.get<AdminSheetsService>(AdminSheetsService);

      mockValuesGet.mockResolvedValue({ data: { values: null } });

      const result = await service.getRange(PLATFORM_SHEET_ID, 'Users!A:L');
      expect(result).toEqual([]);
    });
  });

  describe('appends a row to a spreadsheet using Service Account credentials', () => {
    it('calls the Sheets API append endpoint with the correct payload', async () => {
      const module = await buildModule();
      const service = module.get<AdminSheetsService>(AdminSheetsService);

      mockValuesAppend.mockResolvedValue({ data: {} });

      const row = ['user-2', 'gid-2', 'bob@example.com'];
      await service.appendRow(PLATFORM_SHEET_ID, 'Users!A:L', row);

      expect(mockValuesAppend).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: PLATFORM_SHEET_ID,
          range: 'Users!A:L',
          valueInputOption: 'RAW',
          requestBody: { values: [row] },
        }),
      );
    });
  });

  describe('initialises platform sheet tabs on first run', () => {
    const USERS_HEADERS = [
      'id', 'google_id', 'email', 'first_name', 'last_name',
      'role', 'status', 'team_id', 'sheet_id', 'sheet_ownership',
      'created_at', 'updated_at',
    ];
    const INVITATIONS_HEADERS = [
      'token', 'email', 'role', 'invited_by', 'first_name',
      'status', 'created_at', 'expires_at', 'consumed_at',
    ];
    const TEAMS_HEADERS = [
      'id', 'name', 'manager_id', 'member_ids', 'created_at', 'updated_at',
    ];

    it('writes Users tab headers when the tab is empty', async () => {
      const module = await buildModule();
      const service = module.get<AdminSheetsService>(AdminSheetsService);

      // Simulate empty tabs
      mockValuesGet.mockResolvedValue({ data: { values: null } });
      mockValuesAppend.mockResolvedValue({ data: {} });

      await service.initPlatformTabs();

      const appendCalls: Array<{ range: string; values: string[][] }> = mockValuesAppend.mock.calls.map(
        (call) => ({ range: call[0].range, values: call[0].requestBody.values }),
      );

      const usersCall = appendCalls.find((c) => c.range.startsWith('Users'));
      expect(usersCall).toBeDefined();
      expect(usersCall!.values[0]).toEqual(USERS_HEADERS);
    });

    it('writes Invitations tab headers when the tab is empty', async () => {
      const module = await buildModule();
      const service = module.get<AdminSheetsService>(AdminSheetsService);

      mockValuesGet.mockResolvedValue({ data: { values: null } });
      mockValuesAppend.mockResolvedValue({ data: {} });

      await service.initPlatformTabs();

      const appendCalls: Array<{ range: string; values: string[][] }> = mockValuesAppend.mock.calls.map(
        (call) => ({ range: call[0].range, values: call[0].requestBody.values }),
      );

      const invitationsCall = appendCalls.find((c) => c.range.startsWith('Invitations'));
      expect(invitationsCall).toBeDefined();
      expect(invitationsCall!.values[0]).toEqual(INVITATIONS_HEADERS);
    });

    it('writes Teams tab headers when the tab is empty', async () => {
      const module = await buildModule();
      const service = module.get<AdminSheetsService>(AdminSheetsService);

      mockValuesGet.mockResolvedValue({ data: { values: null } });
      mockValuesAppend.mockResolvedValue({ data: {} });

      await service.initPlatformTabs();

      const appendCalls: Array<{ range: string; values: string[][] }> = mockValuesAppend.mock.calls.map(
        (call) => ({ range: call[0].range, values: call[0].requestBody.values }),
      );

      const teamsCall = appendCalls.find((c) => c.range.startsWith('Teams'));
      expect(teamsCall).toBeDefined();
      expect(teamsCall!.values[0]).toEqual(TEAMS_HEADERS);
    });

    it('does NOT overwrite an existing tab that already has header data', async () => {
      const module = await buildModule();
      const service = module.get<AdminSheetsService>(AdminSheetsService);

      // Simulate all tabs already having headers
      mockValuesGet.mockResolvedValue({ data: { values: [USERS_HEADERS] } });
      mockValuesAppend.mockResolvedValue({ data: {} });

      await service.initPlatformTabs();

      // No append should have been called for tabs that already contain data
      expect(mockValuesAppend).not.toHaveBeenCalled();
    });
  });

  describe('throws on missing required configuration', () => {
    it('throws an error during module init when GOOGLE_SERVICE_ACCOUNT_KEY is missing', async () => {
      await expect(
        buildModule({ GOOGLE_SERVICE_ACCOUNT_KEY: undefined }),
      ).rejects.toThrow();
    });

    it('throws an error during module init when PLATFORM_SHEET_ID is missing', async () => {
      await expect(
        buildModule({ PLATFORM_SHEET_ID: undefined }),
      ).rejects.toThrow();
    });
  });
});
