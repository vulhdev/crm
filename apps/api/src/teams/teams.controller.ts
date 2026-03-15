import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import type { Team } from '@crm/types';
import { TeamsService } from './teams.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('teams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Roles('Admin', 'Sales Manager')
  async findAll(): Promise<Team[]> {
    return this.teamsService.findAll();
  }

  @Post()
  @Roles('Admin')
  async create(@Body() dto: CreateTeamDto): Promise<Team> {
    return this.teamsService.create(dto);
  }

  @Patch(':id')
  @Roles('Admin')
  async update(@Param('id') id: string, @Body() dto: UpdateTeamDto): Promise<Team> {
    return this.teamsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  async remove(@Param('id') id: string): Promise<void> {
    return this.teamsService.delete(id);
  }
}
