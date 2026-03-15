import { IsEmail, IsString, IsOptional, IsIn } from 'class-validator';
import type { CrmRole } from '@crm/types';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsIn(['Admin', 'Sales Manager', 'Sales Rep'])
  role!: CrmRole;

  @IsOptional()
  @IsString()
  firstName?: string;
}
