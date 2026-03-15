/**
 * Test file: apps/api/src/auth/roles.guard.spec.ts
 *
 * Covers:
 *  - Allows request when user role exactly matches the required role
 *  - Admin role is treated as superuser — allowed regardless of which role is required
 *  - Throws ForbiddenException when the user's role is insufficient
 *  - Throws ForbiddenException when there is no user on the request
 *  - Allows request (no-op) when no @Roles() decorator metadata is set on the handler
 *
 * Developer must implement:
 *  - apps/api/src/auth/roles.guard.ts — RolesGuard implementing CanActivate
 *  - apps/api/src/auth/roles.decorator.ts — @Roles(...CrmRole[]) custom decorator
 *    using Reflector / SetMetadata
 */

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { CrmRole, JwtPayload } from '@crm/types';
import { RolesGuard } from './roles.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLES_METADATA_KEY = 'roles';

function buildMockContext(
  user: Partial<JwtPayload> | null,
  requiredRoles: CrmRole[] | undefined,
): ExecutionContext {
  const mockHandler = jest.fn();
  const mockClass = jest.fn();

  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation(
    (metadataKey: string) => {
      if (metadataKey === ROLES_METADATA_KEY) return requiredRoles;
      return undefined;
    },
  );

  const mockRequest = { user };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => mockHandler,
    getClass: () => mockClass,
  } as unknown as ExecutionContext;
}

function buildGuard(requiredRoles: CrmRole[] | undefined, user: Partial<JwtPayload> | null): RolesGuard {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
  return new RolesGuard(reflector);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RolesGuard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows the request when the user role matches the required role', () => {
    const user: Partial<JwtPayload> = { sub: 'uid-1', role: 'Sales Rep' };
    const guard = buildGuard(['Sales Rep'], user);
    const ctx = buildMockContext(user, ['Sales Rep']);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows the request when the user is an Admin regardless of the required role', () => {
    const adminUser: Partial<JwtPayload> = { sub: 'uid-admin', role: 'Admin' };

    for (const requiredRole of ['Sales Rep', 'Sales Manager', 'Admin'] as CrmRole[]) {
      const guard = buildGuard([requiredRole], adminUser);
      const ctx = buildMockContext(adminUser, [requiredRole]);
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it('allows the request when the user role is Sales Manager and the required role is Sales Manager', () => {
    const user: Partial<JwtPayload> = { sub: 'uid-mgr', role: 'Sales Manager' };
    const guard = buildGuard(['Sales Manager'], user);
    const ctx = buildMockContext(user, ['Sales Manager']);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when a Sales Rep tries to access a Sales Manager route', () => {
    const user: Partial<JwtPayload> = { sub: 'uid-rep', role: 'Sales Rep' };
    const guard = buildGuard(['Sales Manager'], user);
    const ctx = buildMockContext(user, ['Sales Manager']);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when a Sales Rep tries to access an Admin-only route', () => {
    const user: Partial<JwtPayload> = { sub: 'uid-rep', role: 'Sales Rep' };
    const guard = buildGuard(['Admin'], user);
    const ctx = buildMockContext(user, ['Admin']);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when a Sales Manager tries to access an Admin-only route', () => {
    const user: Partial<JwtPayload> = { sub: 'uid-mgr', role: 'Sales Manager' };
    const guard = buildGuard(['Admin'], user);
    const ctx = buildMockContext(user, ['Admin']);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no user on the request (unauthenticated)', () => {
    const guard = buildGuard(['Sales Rep'], null);
    const ctx = buildMockContext(null, ['Sales Rep']);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows the request (no-op) when no @Roles() metadata is defined on the handler', () => {
    const user: Partial<JwtPayload> = { sub: 'uid-1', role: 'Sales Rep' };
    const guard = buildGuard(undefined, user);
    const ctx = buildMockContext(user, undefined);

    // Guard should be a no-op when no roles are required — allow the request
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows Admin access to a route that accepts multiple roles including non-Admin', () => {
    const adminUser: Partial<JwtPayload> = { sub: 'uid-admin', role: 'Admin' };
    const guard = buildGuard(['Sales Manager', 'Admin'], adminUser);
    const ctx = buildMockContext(adminUser, ['Sales Manager', 'Admin']);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when user role is one of several acceptable roles', () => {
    const managerUser: Partial<JwtPayload> = { sub: 'uid-mgr', role: 'Sales Manager' };
    const guard = buildGuard(['Sales Manager', 'Admin'], managerUser);
    const ctx = buildMockContext(managerUser, ['Sales Manager', 'Admin']);

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
