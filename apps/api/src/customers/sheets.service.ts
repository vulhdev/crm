import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import type {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
} from '@crm/types';

const SHEET_RANGE = 'Sheet1!A:J';

@Injectable()
export class SheetsService {
  private readonly sheets: sheets_v4.Sheets;
  private readonly spreadsheetId: string;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY') ?? '';
    const email = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '';

    // Parse JSON key if provided; fall back to treating rawKey as the private key directly
    let privateKey = rawKey;
    let clientEmail = email;
    try {
      const parsed = JSON.parse(rawKey) as { client_email?: string; private_key?: string };
      privateKey = parsed.private_key ?? rawKey;
      clientEmail = email || parsed.client_email || '';
    } catch {
      // rawKey is not JSON — treat it as the raw private key string
    }

    // Env vars store literal \n — replace with real newlines for the PEM key
    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = this.configService.get<string>('GOOGLE_SHEET_ID') ?? '';
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

  async getAll(): Promise<Customer[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: SHEET_RANGE,
    });

    const rows = response.data.values ?? [];

    // Skip header row (index 0)
    return rows.slice(1).map((row) => this.rowToCustomer(row as string[]));
  }

  async append(dto: CreateCustomerDto): Promise<Customer> {
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

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: SHEET_RANGE,
      valueInputOption: 'RAW',
      requestBody: {
        values: [this.customerToRow(customer)],
      },
    });

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: SHEET_RANGE,
    });

    const rows = response.data.values ?? [];
    // rows[0] is the header row, data starts at rows[1]
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

    // Row number in the sheet: header is row 1, first data row is row 2
    const sheetRowNumber = dataIndex + 2;

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Sheet1!A${sheetRowNumber}:J${sheetRowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [this.customerToRow(updated)],
      },
    });

    return updated;
  }
}
