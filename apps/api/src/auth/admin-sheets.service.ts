import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';

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

@Injectable()
export class AdminSheetsService {
  private sheetsClient: sheets_v4.Sheets | undefined;
  private sheetsClientPromise: Promise<sheets_v4.Sheets> | undefined;
  readonly platformSheetId: string;
  private readonly serviceAccountKey: string;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY');
    const platformSheetId = this.configService.get<string>('PLATFORM_SHEET_ID');

    if (!key) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing');
    }
    if (!platformSheetId) {
      throw new Error('PLATFORM_SHEET_ID is missing');
    }

    this.serviceAccountKey = key;
    this.platformSheetId = platformSheetId;
  }

  private async getSheets(): Promise<sheets_v4.Sheets> {
    if (this.sheetsClient) return this.sheetsClient;
    if (!this.sheetsClientPromise) {
      this.sheetsClientPromise = (async () => {
        const credentials = JSON.parse(this.serviceAccountKey) as object;
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const client = await auth.getClient();
        this.sheetsClient = google.sheets({ version: 'v4', auth: client as any });
        return this.sheetsClient;
      })();
    }
    return this.sheetsClientPromise;
  }

  async getRange(spreadsheetId: string, range: string): Promise<string[][]> {
    const sheets = await this.getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return (response.data.values as string[][] | null | undefined) ?? [];
  }

  async appendRow(spreadsheetId: string, range: string, values: string[]): Promise<void> {
    const sheets = await this.getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  }

  async updateRow(spreadsheetId: string, range: string, values: string[], options?: object): Promise<void> {
    const sheets = await this.getSheets();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  }

  async initPlatformTabs(): Promise<void> {
    const tabs = [
      { range: 'Users!A:L', headers: USERS_HEADERS },
      { range: 'Invitations!A:I', headers: INVITATIONS_HEADERS },
      { range: 'Teams!A:F', headers: TEAMS_HEADERS },
    ];

    for (const tab of tabs) {
      const rows = await this.getRange(this.platformSheetId, tab.range);
      if (rows.length === 0) {
        await this.appendRow(this.platformSheetId, tab.range, tab.headers);
      }
    }
  }
}
