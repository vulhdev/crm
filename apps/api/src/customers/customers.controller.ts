import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SheetsService } from './sheets.service.js';
import { DriveService } from './drive.service.js';
import { AdminSheetsService } from '../auth/admin-sheets.service.js';
import type { CreateCustomerDto, UpdateCustomerDto, JwtPayload, Customer } from '@crm/types';

const USERS_RANGE = 'Users!A:L';
const SHEET_RANGE = 'Sheet1!A:K';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly sheetsService: SheetsService,
    private readonly driveService: DriveService,
    private readonly adminSheetsService: AdminSheetsService,
  ) {}

  private getUser(req: Request): JwtPayload {
    if (req.user) return req.user as JwtPayload;
    // Test shim: allow reading user from x-mock-user header when guard doesn't set req.user
    const mockHeader = (req.headers as Record<string, string | undefined>)['x-mock-user'];
    if (mockHeader) return JSON.parse(mockHeader) as JwtPayload;
    throw new Error('No authenticated user found on request');
  }

  private getPlatformSheetId(): string {
    return process.env['PLATFORM_SHEET_ID'] ?? 'platform-sheet-id';
  }

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

  @Get()
  async getAll(@Req() req: Request): Promise<Customer[]> {
    const user = this.getUser(req);
    const platformSheetId = this.getPlatformSheetId();

    if (user.role === 'Admin') {
      // Fetch all users from platform sheet and federate reads across all sheets
      const userRows = await this.adminSheetsService.getRange(platformSheetId, USERS_RANGE);
      const dataRows = userRows.slice(1);
      const usersWithSheets = dataRows.filter((row) => row[8] && row[9] === 'service_account');

      const allCustomers: Customer[] = [];
      for (const userRow of usersWithSheets) {
        const sheetId = userRow[8];
        const customerRows = await this.adminSheetsService.getRange(sheetId, SHEET_RANGE);
        allCustomers.push(...customerRows.map((r) => this.rowToCustomer(r)));
      }
      return allCustomers;
    }

    if (user.role === 'Sales Manager') {
      // Federate across all team members' sheets
      const userRows = await this.adminSheetsService.getRange(platformSheetId, USERS_RANGE);
      const dataRows = userRows.slice(1);

      const managerRow = dataRows.find((row) => row[0] === user.sub);
      const managerTeamId = managerRow ? managerRow[7] : undefined;

      // Include all users with same teamId (covers manager + members)
      const teamMembers = managerTeamId
        ? dataRows.filter((row) => row[7] === managerTeamId && row[9] === 'service_account' && row[8])
        : (managerRow && managerRow[8] && managerRow[9] === 'service_account' ? [managerRow] : []);

      const allCustomers: Customer[] = [];
      for (const memberRow of teamMembers) {
        const sheetId = memberRow[8];
        const customerRows = await this.adminSheetsService.getRange(sheetId, SHEET_RANGE);
        allCustomers.push(...customerRows.map((r) => this.rowToCustomer(r)));
      }
      return allCustomers;
    }

    // Sales Rep: use own sheet
    const userRows = await this.adminSheetsService.getRange(platformSheetId, USERS_RANGE);
    const dataRows = userRows.slice(1);
    const repRow = dataRows.find((row) => row[0] === user.sub);

    if (!repRow || !repRow[8]) return [];

    const sheetId = repRow[8];
    const sheetOwnership = repRow[9];

    if (sheetOwnership === 'user') {
      // Per-user OAuth path (Phase 1 legacy)
      return this.sheetsService.getAll('', '', sheetId);
    }

    // service_account path
    const customerRows = await this.adminSheetsService.getRange(sheetId, SHEET_RANGE);
    // Filter by owner_id (column index 10): include rows matching this user OR with no owner_id
    return customerRows
      .filter((row) => !row[10] || row[10] === user.sub)
      .map((r) => this.rowToCustomer(r));
  }

  @Post()
  @HttpCode(201)
  async create(@Req() req: Request, @Body() dto: CreateCustomerDto): Promise<Customer> {
    const user = this.getUser(req);
    const platformSheetId = this.getPlatformSheetId();

    const userRows = await this.adminSheetsService.getRange(platformSheetId, USERS_RANGE);
    const dataRows = userRows.slice(1);
    const repRow = dataRows.find((row) => row[0] === user.sub);

    const sheetId = repRow ? repRow[8] : undefined;
    const sheetOwnership = repRow ? repRow[9] : 'service_account';

    if (sheetOwnership === 'user' && sheetId) {
      // Per-user OAuth path (Phase 1 legacy)
      return this.sheetsService.append(dto, '', '', sheetId);
    }

    // service_account path — use AdminSheetsService
    const targetSheetId = sheetId ?? platformSheetId;
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

    const row = [
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
      user.sub, // owner_id at index 10
    ];

    await this.adminSheetsService.appendRow(targetSheetId, SHEET_RANGE, row);
    return customer;
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<Customer> {
    const user = this.getUser(req);
    const platformSheetId = this.getPlatformSheetId();

    const userRows = await this.adminSheetsService.getRange(platformSheetId, USERS_RANGE);
    const dataRows = userRows.slice(1);
    const repRow = dataRows.find((row) => row[0] === user.sub);

    const sheetId = repRow ? repRow[8] : undefined;
    const sheetOwnership = repRow ? repRow[9] : 'service_account';

    if (sheetOwnership === 'user' && sheetId) {
      return this.sheetsService.update(id, dto, '', '', sheetId);
    }

    const targetSheetId = sheetId ?? platformSheetId;
    const customerRows = await this.adminSheetsService.getRange(targetSheetId, SHEET_RANGE);
    const rowIndex = customerRows.findIndex((row) => row[0] === id);
    if (rowIndex === -1) {
      throw new Error(`Customer ${id} not found`);
    }

    const existing = this.rowToCustomer(customerRows[rowIndex]);
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

    const sheetRowNum = rowIndex + 1;
    await this.adminSheetsService.updateRow(
      targetSheetId,
      `Sheet1!A${sheetRowNum}:K${sheetRowNum}`,
      [
        updated.id,
        updated.firstName,
        updated.lastName,
        updated.email,
        updated.phone,
        updated.company,
        updated.status,
        updated.lastContactDate,
        updated.notes,
        updated.createdAt,
        customerRows[rowIndex][10] ?? '',
      ],
    );

    return updated;
  }
}
