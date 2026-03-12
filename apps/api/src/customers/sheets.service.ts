import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
} from '@crm/types';

const SHEET_RANGE = 'Sheet1!A:J';

@Injectable()
export class SheetsService {
  constructor(private readonly configService: ConfigService) {}

  private buildSheetsClient(accessToken: string, refreshToken: string): sheets_v4.Sheets {
    const auth: OAuth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET'),
    );
    auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    return google.sheets({ version: 'v4', auth });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private rowToCustomer(row: string[]): Customer {
    return {
      id: row[0] ?? '',
      firstName: row[1] ?? '',
      lastName: row[2] ?? '',
      email: row[3] ?? '',
      phone: row[4] ?? '',
      company: row[5] ?? '',
      status: (row[6] as Customer['status']) ?? 'Lead',
      lastContactDate: row[7] ?? '',
      notes: row[8] ?? '',
      createdAt: row[9] ?? '',
    };
  }

  private customerToRow(customer: Customer): string[] {
    return [
      customer.id,
      customer.firstName,
      customer.lastName,
      customer.email,
      customer.phone,
      customer.company,
      customer.status,
      customer.lastContactDate,
      customer.notes,
      customer.createdAt,
    ];
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async getAll(
    accessToken: string,
    refreshToken: string,
    spreadsheetId: string,
  ): Promise<Customer[]> {
    const sheets = this.buildSheetsClient(accessToken, refreshToken);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SHEET_RANGE,
    });

    const rows = response.data.values ?? [];
    return rows.slice(1).map((row) => this.rowToCustomer(row as string[]));
  }

  async append(
    dto: CreateCustomerDto,
    accessToken: string,
    refreshToken: string,
    spreadsheetId: string,
  ): Promise<Customer> {
    const sheets = this.buildSheetsClient(accessToken, refreshToken);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const customer: Customer = {
      id,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      status: dto.status,
      lastContactDate: dto.lastContactDate,
      notes: dto.notes,
      createdAt: now,
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: SHEET_RANGE,
      valueInputOption: 'RAW',
      requestBody: {
        values: [this.customerToRow(customer)],
      },
    });

    return customer;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    accessToken: string,
    refreshToken: string,
    spreadsheetId: string,
  ): Promise<Customer> {
    const sheets = this.buildSheetsClient(accessToken, refreshToken);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SHEET_RANGE,
    });

    const rows = response.data.values ?? [];
    const dataRows = rows.slice(1) as string[][];
    const dataIndex = dataRows.findIndex((row) => row[0] === id);

    if (dataIndex === -1) {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }

    const existing = this.rowToCustomer(dataRows[dataIndex]);
    const updated: Customer = {
      id: existing.id,
      firstName: dto.firstName ?? existing.firstName,
      lastName: dto.lastName ?? existing.lastName,
      email: dto.email ?? existing.email,
      phone: dto.phone ?? existing.phone,
      company: dto.company ?? existing.company,
      status: dto.status ?? existing.status,
      lastContactDate: dto.lastContactDate ?? existing.lastContactDate,
      notes: dto.notes ?? existing.notes,
      createdAt: existing.createdAt,
    };

    const sheetRowNumber = dataIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!A${sheetRowNumber}:J${sheetRowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [this.customerToRow(updated)],
      },
    });

    return updated;
  }
}
