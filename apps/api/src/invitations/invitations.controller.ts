import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import type { Invitation } from '@crm/types';
import { InvitationsService } from './invitations.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @HttpCode(201)
  async create(
    @Body() dto: CreateInvitationDto,
    @Request() req: { user: { sub: string } },
  ): Promise<Invitation | { duplicate: true; invitation: Invitation }> {
    return this.invitationsService.create(dto, req.user.sub);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async findAll(): Promise<Invitation[]> {
    return this.invitationsService.findAll();
  }

  @Delete(':token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @HttpCode(200)
  async revoke(@Param('token') token: string): Promise<void> {
    return this.invitationsService.revoke(token);
  }

  @Post(':token/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async resend(@Param('token') token: string): Promise<void> {
    return this.invitationsService.resend(token);
  }

  @Get('validate/:token')
  async validate(@Param('token') token: string): Promise<
    | { valid: true; email: string; role: Invitation['role'] }
    | { valid: false; reason: string }
  > {
    return this.invitationsService.validate(token);
  }
}
