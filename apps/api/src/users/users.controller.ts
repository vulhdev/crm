import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import type { CrmUser } from '@crm/types';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('Admin', 'Sales Manager')
  async findAll(): Promise<CrmUser[]> {
    return this.usersService.findAll();
  }

  @Get('me')
  async getMe(@Request() req: { user: { sub: string } }): Promise<CrmUser | null> {
    return this.usersService.findMe(req.user.sub);
  }

  @Patch(':id')
  @Roles('Admin')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<CrmUser> {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles('Admin')
  async deactivate(@Param('id') id: string): Promise<CrmUser> {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/reactivate')
  @Roles('Admin')
  async reactivate(@Param('id') id: string): Promise<CrmUser> {
    return this.usersService.reactivate(id);
  }
}
