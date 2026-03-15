import { IsOptional, IsString, IsIn } from 'class-validator';
import type { CrmRole } from '@crm/types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsIn(['Admin', 'Sales Manager', 'Sales Rep'])
  role?: CrmRole;
}
