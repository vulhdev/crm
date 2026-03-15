import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Invitation, InvitationStatus } from '@crm/types';
import { AdminSheetsService } from '../auth/admin-sheets.service.js';
import { MailService } from '../mail/mail.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';

const INVITATIONS_RANGE = 'Invitations!A:I';
const USERS_RANGE = 'Users!A:L';

function rowToInvitation(row: string[]): Invitation {
  return {
    token: row[0],
    email: row[1],
    role: row[2] as Invitation['role'],
    invitedBy: row[3],
    firstName: row[4] || undefined,
    status: row[5] as InvitationStatus,
    createdAt: row[6],
    expiresAt: row[7],
    consumedAt: row[8] || undefined,
  };
}

function invitationToRow(inv: Invitation): string[] {
  return [
    inv.token,
    inv.email,
    inv.role,
    inv.invitedBy,
    inv.firstName ?? '',
    inv.status,
    inv.createdAt,
    inv.expiresAt,
    inv.consumedAt ?? '',
  ];
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly adminSheetsService: AdminSheetsService,
    private readonly mailService: MailService,
  ) {}

  async create(
    dto: CreateInvitationDto,
    adminId: string,
  ): Promise<Invitation | { duplicate: true; invitation: Invitation }> {
    // Check for Active user with this email
    const userRows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      USERS_RANGE,
    );
    const dataUserRows = userRows.slice(1);
    const activeUser = dataUserRows.find((r) => r[2] === dto.email && r[6] === 'Active');
    if (activeUser) {
      throw new ConflictException(`Email ${dto.email} belongs to an Active user`);
    }

    // Check for existing Pending invitation
    const invRows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      INVITATIONS_RANGE,
    );
    const dataInvRows = invRows.slice(1);
    const existing = dataInvRows.find((r) => r[1] === dto.email && r[5] === 'Pending');
    if (existing) {
      return { duplicate: true, invitation: rowToInvitation(existing) };
    }

    // Create new invitation
    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const invitation: Invitation = {
      token,
      email: dto.email,
      role: dto.role,
      invitedBy: adminId,
      firstName: dto.firstName,
      status: 'Pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.adminSheetsService.appendRow(
      this.adminSheetsService.platformSheetId,
      INVITATIONS_RANGE,
      invitationToRow(invitation),
    );

    await this.mailService.sendInvitation(dto.email, token, dto.role, dto.firstName);

    return invitation;
  }

  async findAll(): Promise<Invitation[]> {
    const rows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      INVITATIONS_RANGE,
    );
    if (rows.length <= 1) return [];
    return rows.slice(1).map(rowToInvitation);
  }

  async revoke(token: string): Promise<void> {
    const rows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      INVITATIONS_RANGE,
    );
    const dataRows = rows.slice(1);
    const rowIndex = dataRows.findIndex((r) => r[0] === token);
    if (rowIndex === -1) {
      throw new NotFoundException(`Invitation with token ${token} not found`);
    }

    const inv = rowToInvitation(dataRows[rowIndex]);
    const updated: Invitation = { ...inv, status: 'Revoked' };
    const sheetRowNumber = rowIndex + 2;
    const range = `Invitations!A${sheetRowNumber}:I${sheetRowNumber}`;

    await this.adminSheetsService.updateRow(
      this.adminSheetsService.platformSheetId,
      range,
      invitationToRow(updated),
    );
  }

  async resend(token: string): Promise<void> {
    const rows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      INVITATIONS_RANGE,
    );
    const dataRows = rows.slice(1);
    const rowIndex = dataRows.findIndex((r) => r[0] === token);
    if (rowIndex === -1) {
      throw new NotFoundException(`Invitation with token ${token} not found`);
    }

    const inv = rowToInvitation(dataRows[rowIndex]);
    const newExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const updated: Invitation = { ...inv, expiresAt: newExpiresAt };
    const sheetRowNumber = rowIndex + 2;
    const range = `Invitations!A${sheetRowNumber}:I${sheetRowNumber}`;

    await this.adminSheetsService.updateRow(
      this.adminSheetsService.platformSheetId,
      range,
      invitationToRow(updated),
    );

    await this.mailService.sendInvitation(inv.email, token, inv.role, inv.firstName);
  }

  async validate(
    token: string,
  ): Promise<
    | { valid: true; email: string; role: Invitation['role'] }
    | { valid: false; reason: 'expired' | 'revoked' | 'consumed' | 'not_found' }
  > {
    const rows = await this.adminSheetsService.getRange(
      this.adminSheetsService.platformSheetId,
      INVITATIONS_RANGE,
    );
    const dataRows = rows.slice(1);
    const row = dataRows.find((r) => r[0] === token);
    if (!row) {
      return { valid: false, reason: 'not_found' };
    }

    const inv = rowToInvitation(row);

    if (inv.status === 'Revoked') {
      return { valid: false, reason: 'revoked' };
    }

    if (inv.status === 'Consumed') {
      return { valid: false, reason: 'consumed' };
    }

    // Check expiry
    if (new Date(inv.expiresAt).getTime() <= Date.now()) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true, email: inv.email, role: inv.role };
  }
}
