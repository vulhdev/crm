/**
 * Test file: apps/api/src/auth/auth.controller.spec.ts
 *
 * Covers:
 *  - GET /auth/google/callback Case A: existing Active user → JWT issued, redirect to dashboard
 *  - GET /auth/google/callback Case A: Deactivated user → 403 response
 *  - GET /auth/google/callback Case A: user not found, no invite, no bootstrap → 403 response
 *  - GET /auth/google/callback Case B: valid invite_token in state → user created, JWT issued,
 *    redirect to dashboard
 *  - GET /auth/google/callback Bootstrap: Users tab empty + matching email → Admin created,
 *    JWT issued, redirect
 *  - GET /auth/google/callback Bootstrap: Users tab empty + non-matching email → 403
 *
 * Developer must implement:
 *  - apps/api/src/auth/auth.controller.ts — updated googleAuthCallback that:
 *    - Reads invite_token from req.user or req.query.state
 *    - Calls authService.findUserByGoogleId for Case A
 *    - Calls authService.processInviteToken for Case B
 *    - Calls authService.findOrCreateBootstrapAdmin for bootstrap flow
 *    - Returns 403 ForbiddenException for Deactivated / not-found users
 *    - Issues JWT via authService.login(googleUser, crmUser) and redirects
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AuthGuard } from '@nestjs/passport';
import type { CrmUser, GoogleUser } from '@crm/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockActiveGoogleUser: GoogleUser = {
  googleId: 'gid-active-1',
  email: 'active@company.com',
  firstName: 'Active',
  lastName: 'User',
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
};

const mockActiveCrmUser: CrmUser = {
  id: 'crm-uuid-active-1',
  googleId: 'gid-active-1',
  email: 'active@company.com',
  firstName: 'Active',
  lastName: 'User',
  role: 'Sales Rep',
  status: 'Active',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockDeactivatedGoogleUser: GoogleUser = {
  ...mockActiveGoogleUser,
  googleId: 'gid-deactivated-1',
  email: 'deactivated@company.com',
};

const mockBootstrapGoogleUser: GoogleUser = {
  googleId: 'gid-bootstrap-admin',
  email: 'admin@company.com',
  firstName: 'Bootstrap',
  lastName: 'Admin',
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
};

const mockAdminCrmUser: CrmUser = {
  id: 'crm-uuid-admin-1',
  googleId: 'gid-bootstrap-admin',
  email: 'admin@company.com',
  firstName: 'Bootstrap',
  lastName: 'Admin',
  role: 'Admin',
  status: 'Active',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockInvitedNewUser: CrmUser = {
  id: 'crm-uuid-new-invite',
  googleId: 'gid-new-invited',
  email: 'newinvite@company.com',
  firstName: 'New',
  lastName: 'Invite',
  role: 'Sales Rep',
  status: 'Active',
  sheetOwnership: 'service_account',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Mock Google auth guard — injects req.user from our test payload
// ---------------------------------------------------------------------------

/**
 * The real AuthGuard('google') redirects to Google. We replace it with a mock
 * that reads a special request header to inject the desired GoogleUser +
 * optional invite_token into req.user so the controller can act on them.
 */
class MockGoogleAuthGuard {
  canActivate(context: any): boolean {
    const req = context.switchToHttp().getRequest();
    const userHeader = req.headers['x-mock-google-user'];
    const inviteToken = req.headers['x-mock-invite-token'];
    if (userHeader) {
      req.user = JSON.parse(userHeader);
      if (inviteToken) {
        req.user.inviteToken = inviteToken;
      }
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Module builder
// ---------------------------------------------------------------------------

function buildMockAuthService(): jest.Mocked<AuthService> {
  return {
    login: jest.fn().mockReturnValue('mock-jwt-token'),
    findUserByGoogleId: jest.fn(),
    processInviteToken: jest.fn(),
    findOrCreateBootstrapAdmin: jest.fn(),
  } as unknown as jest.Mocked<AuthService>;
}

async function buildApp(authServiceMock: jest.Mocked<AuthService>): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: authServiceMock }],
  })
    .overrideGuard(AuthGuard('google'))
    .useClass(MockGoogleAuthGuard)
    .compile();

  const app = module.createNestApplication();
  await app.init();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthController — GET /auth/google/callback', () => {
  let app: INestApplication;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = buildMockAuthService();
    app = await buildApp(authService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ── Case A: returning user ─────────────────────────────────────────────────

  describe('Case A — returning user', () => {
    it('issues a JWT and redirects to the dashboard when the user is Active', async () => {
      authService.findUserByGoogleId.mockResolvedValue(mockActiveCrmUser);

      const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .set('x-mock-google-user', JSON.stringify(mockActiveGoogleUser))
        .expect(HttpStatus.FOUND);

      expect(authService.findUserByGoogleId).toHaveBeenCalledWith(mockActiveGoogleUser.googleId);
      expect(authService.login).toHaveBeenCalledWith(mockActiveGoogleUser, mockActiveCrmUser);
      expect(response.headers.location).toContain('mock-jwt-token');
    });

    it('returns 403 when the user exists but is Deactivated', async () => {
      const deactivatedCrmUser: CrmUser = {
        ...mockActiveCrmUser,
        googleId: mockDeactivatedGoogleUser.googleId,
        status: 'Deactivated',
      };
      authService.findUserByGoogleId.mockResolvedValue(deactivatedCrmUser);

      await request(app.getHttpServer())
        .get('/auth/google/callback')
        .set('x-mock-google-user', JSON.stringify(mockDeactivatedGoogleUser))
        .expect(HttpStatus.FORBIDDEN);

      expect(authService.login).not.toHaveBeenCalled();
    });

    it('returns 403 when the google_id is not found and no invite token is provided and bootstrap does not apply', async () => {
      authService.findUserByGoogleId.mockResolvedValue(null);
      authService.findOrCreateBootstrapAdmin.mockRejectedValue(new ForbiddenException());

      const unknownGoogleUser: GoogleUser = {
        ...mockActiveGoogleUser,
        googleId: 'gid-unknown',
        email: 'nobody@example.com',
      };

      await request(app.getHttpServer())
        .get('/auth/google/callback')
        .set('x-mock-google-user', JSON.stringify(unknownGoogleUser))
        .expect(HttpStatus.FORBIDDEN);

      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  // ── Case B: invite redemption ──────────────────────────────────────────────

  describe('Case B — invite redemption', () => {
    it('creates the user from invite, issues JWT, and redirects when invite_token state is valid', async () => {
      const inviteToken = 'a'.repeat(64);
      const invitedGoogleUser: GoogleUser = {
        googleId: 'gid-new-invited',
        email: 'newinvite@company.com',
        firstName: 'New',
        lastName: 'Invite',
        accessToken: 'access-tok-2',
        refreshToken: 'refresh-tok-2',
      };

      // No existing user; processInviteToken succeeds
      authService.findUserByGoogleId.mockResolvedValue(null);
      authService.processInviteToken.mockResolvedValue(mockInvitedNewUser);

      const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .set('x-mock-google-user', JSON.stringify(invitedGoogleUser))
        .set('x-mock-invite-token', inviteToken)
        .expect(HttpStatus.FOUND);

      expect(authService.processInviteToken).toHaveBeenCalledWith(inviteToken, invitedGoogleUser);
      expect(authService.login).toHaveBeenCalledWith(invitedGoogleUser, mockInvitedNewUser);
      expect(response.headers.location).toContain('mock-jwt-token');
    });

    it('returns an error response when the invite_token is invalid or expired', async () => {
      const badToken = 'expired-bad-token';
      const invitedGoogleUser: GoogleUser = {
        googleId: 'gid-bad-invite',
        email: 'badinvite@company.com',
        firstName: 'Bad',
        lastName: 'Invite',
        accessToken: 'tok',
        refreshToken: 'rtok',
      };

      authService.findUserByGoogleId.mockResolvedValue(null);
      authService.processInviteToken.mockRejectedValue(new ForbiddenException('Token expired or invalid'));

      await request(app.getHttpServer())
        .get('/auth/google/callback')
        .set('x-mock-google-user', JSON.stringify(invitedGoogleUser))
        .set('x-mock-invite-token', badToken)
        .expect(HttpStatus.FORBIDDEN);

      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  // ── Bootstrap flow ─────────────────────────────────────────────────────────

  describe('Bootstrap flow', () => {
    it('creates the first Admin row, issues JWT, and redirects when Users tab is empty and email matches BOOTSTRAP_ADMIN_EMAIL', async () => {
      authService.findUserByGoogleId.mockResolvedValue(null);
      authService.findOrCreateBootstrapAdmin.mockResolvedValue(mockAdminCrmUser);

      const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .set('x-mock-google-user', JSON.stringify(mockBootstrapGoogleUser))
        .expect(HttpStatus.FOUND);

      expect(authService.findOrCreateBootstrapAdmin).toHaveBeenCalledWith(mockBootstrapGoogleUser);
      expect(authService.login).toHaveBeenCalledWith(mockBootstrapGoogleUser, mockAdminCrmUser);
      expect(response.headers.location).toContain('mock-jwt-token');
    });

    it('returns 403 when Users tab is empty but the email does NOT match BOOTSTRAP_ADMIN_EMAIL', async () => {
      const nonBootstrapUser: GoogleUser = {
        googleId: 'gid-nonbootstrap',
        email: 'stranger@example.com',
        firstName: 'Stranger',
        lastName: 'Danger',
        accessToken: 'tok',
        refreshToken: 'rtok',
      };

      authService.findUserByGoogleId.mockResolvedValue(null);
      authService.findOrCreateBootstrapAdmin.mockRejectedValue(new ForbiddenException());

      await request(app.getHttpServer())
        .get('/auth/google/callback')
        .set('x-mock-google-user', JSON.stringify(nonBootstrapUser))
        .expect(HttpStatus.FORBIDDEN);

      expect(authService.login).not.toHaveBeenCalled();
    });
  });
});
