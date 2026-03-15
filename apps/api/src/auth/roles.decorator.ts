import { SetMetadata } from '@nestjs/common';
import type { CrmRole } from '@crm/types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: CrmRole[]) => SetMetadata(ROLES_KEY, roles);
