import { Injectable, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { CrmUser, GoogleUser, Invitation, JwtPayload, CrmRole, UserStatus, InvitationStatus } from '@crm/types';
import { AdminSheetsService } from './admin-sheets.service.js';

const USERS_RANGE = 'Users!A:L';
const INVITATIONS_RANGE = 'Invitations!A:I';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private adminSheets: AdminSheetsService,
    private configService: ConfigService,
  ) {}

  login(googleUser: GoogleUser, crmUser: CrmUser): string {
    const payload: JwtPayload = {
      sub: crmUser.id,
      googleId: crmUser.googleId,
      email: crmUser.email,
      firstName: crmUser.firstName,
      lastName: crmUser.lastName,
      role: crmUser.role,
    };
    return this.jwtService.sign(payload);
  }

  async findUserByGoogleId(googleId: string): Promise<CrmUser | null> {
    const platformSheetId = this.configService.get<string>('PLATFORM_SHEET_ID') as string;
    const rows = await this.adminSheets.getRange(platformSheetId, USERS_RANGE);
    const dataRows = rows.slice(1);
    const found = dataRows.find((row) => row[1] === googleId);
    if (!found) return null;
    return this.rowToCrmUser(found);
  }

  async findOrCreateBootstrapAdmin(googleUser: GoogleUser): Promise<CrmUser> {
    const platformSheetId = this.configService.get<string>('PLATFORM_SHEET_ID') as string;
    const bootstrapEmail = this.configService.get<string>('BOOTSTRAP_ADMIN_EMAIL');

    const rows = await this.adminSheets.getRange(platformSheetId, USERS_RANGE);
    const dataRows = rows.slice(1);

    if (dataRows.length > 0) {
      throw new ForbiddenException('Bootstrap admin can only be created when no users exist');
    }

    if (googleUser.email !== bootstrapEmail) {
      throw new ForbiddenException('Email does not match BOOTSTRAP_ADMIN_EMAIL');
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const newUser: CrmUser = {
      id,
      googleId: googleUser.googleId,
      email: googleUser.email,
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      role: 'Admin',
      status: 'Active',
      sheetOwnership: 'service_account',
      createdAt: now,
      updatedAt: now,
    };

    const row = this.crmUserToRow(newUser);
    await this.adminSheets.appendRow(platformSheetId, USERS_RANGE, row);

    return newUser;
  }

  async processInviteToken(token: string, googleUser: GoogleUser): Promise<CrmUser> {
    const platformSheetId = this.configService.get<string>('PLATFORM_SHEET_ID') as string;

    const invRows = await this.adminSheets.getRange(platformSheetId, INVITATIONS_RANGE);
    const invDataRows = invRows.slice(1);

    const rowIndex = invDataRows.findIndex((row) => row[0] === token);
    if (rowIndex === -1) {
      throw new ForbiddenException('Invite token not found');
    }

    const invitation = this.rowToInvitation(invDataRows[rowIndex]);

    if (invitation.status !== 'Pending') {
      throw new ForbiddenException(`Invite token is ${invitation.status}`);
    }

    if (new Date(invitation.expiresAt) <= new Date()) {
      throw new ForbiddenException('Invite token has expired');
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const newUser: CrmUser = {
      id,
      googleId: googleUser.googleId,
      email: invitation.email,
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      role: invitation.role,
      status: 'Active',
      sheetOwnership: 'service_account',
      createdAt: now,
      updatedAt: now,
    };

    await this.adminSheets.appendRow(platformSheetId, USERS_RANGE, this.crmUserToRow(newUser));

    const updatedInvRow = [...invDataRows[rowIndex]];
    updatedInvRow[5] = 'Consumed';
    updatedInvRow[8] = now;

    const sheetRowNum = rowIndex + 2;
    await this.adminSheets.updateRow(
      platformSheetId,
      `Invitations!A${sheetRowNum}:I${sheetRowNum}`,
      updatedInvRow,
      { valueInputOption: 'RAW' },
    );

    return newUser;
  }

  private rowToCrmUser(row: string[]): CrmUser {
    return {
      id: row[0] ?? '',
      googleId: row[1] ?? '',
      email: row[2] ?? '',
      firstName: row[3] ?? '',
      lastName: row[4] ?? '',
      role: (row[5] as CrmRole) ?? 'Sales Rep',
      status: (row[6] as UserStatus) ?? 'Active',
      teamId: row[7] || undefined,
      sheetId: row[8] || undefined,
      sheetOwnership: (row[9] as 'user' | 'service_account') || undefined,
      createdAt: row[10] ?? '',
      updatedAt: row[11] ?? '',
    };
  }

  private rowToInvitation(row: string[]): Invitation {
    return {
      token: row[0] ?? '',
      email: row[1] ?? '',
      role: (row[2] as CrmRole) ?? 'Sales Rep',
      invitedBy: row[3] ?? '',
      firstName: row[4] || undefined,
      status: (row[5] as InvitationStatus) ?? 'Pending',
      createdAt: row[6] ?? '',
      expiresAt: row[7] ?? '',
      consumedAt: row[8] || undefined,
    };
  }

  private crmUserToRow(user: CrmUser): string[] {
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
      user.sheetOwnership ?? '',
      user.createdAt,
      user.updatedAt,
    ];
  }
}
