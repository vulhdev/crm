import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsArray()
  memberIds?: string[];
}
