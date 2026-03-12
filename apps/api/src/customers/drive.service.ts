import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

const SHEET_HEADERS = [
  'id', 'first_name', 'last_name', 'email', 'phone',
  'company', 'status', 'last_contact_date', 'notes', 'created_at',
];
const DRIVE_FOLDER_NAME = 'crm';
const SPREADSHEET_NAME = 'customers';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);
  private readonly spreadsheetCache = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {}

  private buildOAuth2Client(accessToken: string, refreshToken: string): OAuth2Client {
    const client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET'),
    );
    client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    return client;
  }

  async getOrCreateSpreadsheet(
    userId: string,
    accessToken: string,
    refreshToken: string,
  ): Promise<string> {
    const cached = this.spreadsheetCache.get(userId);
    if (cached) return cached;

    const auth = this.buildOAuth2Client(accessToken, refreshToken);
    const folderId = await this.findOrCreateFolder(auth);
    const spreadsheetId = await this.findOrCreateSpreadsheet(auth, folderId);
    this.spreadsheetCache.set(userId, spreadsheetId);
    this.logger.log(`Resolved spreadsheet ${spreadsheetId} for user ${userId}`);
    return spreadsheetId;
  }

  private async findOrCreateFolder(auth: OAuth2Client): Promise<string> {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
      q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    const files = res.data.files ?? [];
    if (files.length > 0 && files[0].id) return files[0].id;

    const created = await drive.files.create({
      requestBody: { name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    this.logger.log(`Created Drive folder: ${created.data.id}`);
    return created.data.id!;
  }

  private async findOrCreateSpreadsheet(
    auth: OAuth2Client,
    folderId: string,
  ): Promise<string> {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
      q: `name='${SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    const files = res.data.files ?? [];
    if (files.length > 0 && files[0].id) return files[0].id;

    const sheets = google.sheets({ version: 'v4', auth });
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: SPREADSHEET_NAME },
        sheets: [{
          properties: { title: 'Sheet1' },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [{
              values: SHEET_HEADERS.map((h) => ({ userEnteredValue: { stringValue: h } })),
            }],
          }],
        }],
      },
      fields: 'spreadsheetId',
    });
    const spreadsheetId = created.data.spreadsheetId!;

    // Move the new spreadsheet into the crm folder
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: 'root',
      fields: 'id',
    });

    this.logger.log(`Created spreadsheet ${spreadsheetId} in folder ${folderId}`);
    return spreadsheetId;
  }
}
