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
import type { CreateCustomerDto, UpdateCustomerDto, JwtPayload } from '@crm/types';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly sheetsService: SheetsService,
    private readonly driveService: DriveService,
  ) {}

  private getUser(req: Request): JwtPayload {
    return req.user as JwtPayload;
  }

  @Get()
  async getAll(@Req() req: Request) {
    const { sub, accessToken, refreshToken } = this.getUser(req);
    const spreadsheetId = await this.driveService.getOrCreateSpreadsheet(sub, accessToken, refreshToken);
    return this.sheetsService.getAll(accessToken, refreshToken, spreadsheetId);
  }

  @Post()
  @HttpCode(201)
  async create(@Req() req: Request, @Body() dto: CreateCustomerDto) {
    const { sub, accessToken, refreshToken } = this.getUser(req);
    const spreadsheetId = await this.driveService.getOrCreateSpreadsheet(sub, accessToken, refreshToken);
    return this.sheetsService.append(dto, accessToken, refreshToken, spreadsheetId);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    const { sub, accessToken, refreshToken } = this.getUser(req);
    const spreadsheetId = await this.driveService.getOrCreateSpreadsheet(sub, accessToken, refreshToken);
    return this.sheetsService.update(id, dto, accessToken, refreshToken, spreadsheetId);
  }
}
