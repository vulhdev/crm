import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SheetsService } from './sheets.service.js';
import type { CreateCustomerDto, UpdateCustomerDto } from '@crm/types';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly sheetsService: SheetsService) {}

  @Get()
  getAll() {
    return this.sheetsService.getAll();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateCustomerDto) {
    return this.sheetsService.append(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.sheetsService.update(id, dto);
  }
}
