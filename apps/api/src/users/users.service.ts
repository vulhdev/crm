import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { CrmUser, UserStatus } from '@crm/types';
import { AdminSheetsService } from '../auth/admin-sheets.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const USERS_RANGE = 'Users!A:L';

function rowToUser(row: string[]): CrmUser {
  return {
    id: row[0],
    googleId: row[1],
    email: row[2],
    firstName: row[3],
    lastName: row[4],
    role: row[5] as CrmUser['role'],
    status: row[6] as UserStatus,
    teamId: row[7] || undefined,
    sheetId: row[8] || undefined,
    sheetOwnership: (row[9] || undefined) as CrmUser['sheetOwnership'],
    createdAt: row[10],
    updatedAt: row[11],
  };
}

function userToRow(user: CrmUser): string[] {
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

@Injectable()
export class UsersService {
  constructor(private readonly adminSheetsService: AdminSheetsService) {}

  async findAll(): Promise<CrmUser[]> {
    const rows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      USERS_RANGE,
    );
    if (rows.length <= 1) return [];
    return rows.slice(1).map(rowToUser);
  }

  async findById(id: string): Promise<CrmUser | null> {
    const users = await this.findAll();
    return users.find((u) => u.id === id) ?? null;
  }

  async findMe(sub: string): Promise<CrmUser | null> {
    return this.findById(sub);
  }

  async update(id: string, dto: UpdateUserDto): Promise<CrmUser> {
    const rows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      USERS_RANGE,
    );

    const dataRows = rows.slice(1);
    const rowIndex = dataRows.findIndex((r) => r[0] === id);
    if (rowIndex === -1) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const existing = rowToUser(dataRows[rowIndex]);

    // Last-Admin guard: if changing role away from Admin
    if (dto.role !== undefined && dto.role !== 'Admin' && existing.role === 'Admin') {
      const activeAdmins = dataRows
        .map(rowToUser)
        .filter((u) => u.role === 'Admin' && u.status === 'Active');
      if (activeAdmins.length <= 1) {
        throw new UnprocessableEntityException('Cannot change role of the last Admin');
      }
    }

    const now = new Date().toISOString();
    const updated: CrmUser = {
      ...existing,
      firstName: dto.firstName ?? existing.firstName,
      lastName: dto.lastName ?? existing.lastName,
      role: dto.role ?? existing.role,
      updatedAt: now,
    };

    // Row number in sheet is 1-indexed; header is row 1, so data starts at row 2
    const sheetRowNumber = rowIndex + 2;
    const range = `Users!A${sheetRowNumber}:L${sheetRowNumber}`;

    await this.adminSheetsService.updateRow(
      this.adminSheetsService.platformSheetId,
      range,
      userToRow(updated),
    );

    return updated;
  }

  async deactivate(id: string): Promise<CrmUser> {
    const rows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      USERS_RANGE,
    );

    const dataRows = rows.slice(1);
    const rowIndex = dataRows.findIndex((r) => r[0] === id);
    if (rowIndex === -1) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const existing = rowToUser(dataRows[rowIndex]);

    // Last-Admin guard: only applies if the user is currently Active Admin
    if (existing.role === 'Admin' && existing.status === 'Active') {
      const activeAdmins = dataRows
        .map(rowToUser)
        .filter((u) => u.role === 'Admin' && u.status === 'Active');
      if (activeAdmins.length <= 1) {
        throw new UnprocessableEntityException('Cannot deactivate the last Active Admin');
      }
    }

    const now = new Date().toISOString();
    const updated: CrmUser = {
      ...existing,
      status: 'Deactivated',
      updatedAt: now,
    };

    const sheetRowNumber = rowIndex + 2;
    const range = `Users!A${sheetRowNumber}:L${sheetRowNumber}`;

    await this.adminSheetsService.updateRow(
      this.adminSheetsService.platformSheetId,
      range,
      userToRow(updated),
    );

    return updated;
  }

  async reactivate(id: string): Promise<CrmUser> {
    const rows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      USERS_RANGE,
    );

    const dataRows = rows.slice(1);
    const rowIndex = dataRows.findIndex((r) => r[0] === id);
    if (rowIndex === -1) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const existing = rowToUser(dataRows[rowIndex]);
    const now = new Date().toISOString();
    const updated: CrmUser = {
      ...existing,
      status: 'Active',
      updatedAt: now,
    };

    const sheetRowNumber = rowIndex + 2;
    const range = `Users!A${sheetRowNumber}:L${sheetRowNumber}`;

    await this.adminSheetsService.updateRow(
      this.adminSheetsService.platformSheetId,
      range,
      userToRow(updated),
    );

    return updated;
  }
}
