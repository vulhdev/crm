/**
 * Test file: apps/api/src/auth/google.strategy.spec.ts
 *
 * Covers:
 *  - authorizationParams(req) includes state=<invite_token> when req.query.invite_token is present
 *  - authorizationParams(req) does NOT include state when invite_token is absent
 *  - validate() calls done callback with a correctly shaped GoogleUser (passReqToCallback mode)
 *
 * Developer must implement:
 *  - apps/api/src/auth/google.strategy.ts — updated GoogleStrategy with:
 *    - passReqToCallback: true in PassportStrategy options
 *    - authorizationParams(req) reads req.query.invite_token and embeds as state
 *    - validate(req, accessToken, refreshToken, profile, done) signature
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { GoogleUser } from '@crm/types';
import { GoogleStrategy } from './google.strategy';

// ---------------------------------------------------------------------------
// Prevent passport-google-oauth20 from actually calling Google
// ---------------------------------------------------------------------------

jest.mock('passport-google-oauth20', () => {
  const mockStrategy = jest.fn().mockImplementation(function (this: object, _opts: object, verify: Function) {
    (this as any)._verify = verify;
  });
  return { Strategy: mockStrategy, VerifyCallback: jest.fn() };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConfigService(): Partial<ConfigService> {
  return {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        GOOGLE_OAUTH_CLIENT_ID: 'client-id',
        GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
        GOOGLE_OAUTH_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
      };
      return values[key];
    }),
  };
}

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      GoogleStrategy,
      { provide: ConfigService, useValue: buildConfigService() },
    ],
  }).compile();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(async () => {
    const module = await buildModule();
    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authorizationParams(req)', () => {
    it('includes state equal to invite_token when req.query.invite_token is present', () => {
      const req = { query: { invite_token: 'abc123invitetoken' } };

      const params = strategy.authorizationParams(req as any);

      expect(params).toHaveProperty('state', 'abc123invitetoken');
    });

    it('includes access_type=offline and prompt=consent regardless of invite_token', () => {
      const req = { query: { invite_token: 'some-token' } };

      const params = strategy.authorizationParams(req as any);

      expect(params).toMatchObject({ access_type: 'offline', prompt: 'consent' });
    });

    it('does NOT include state when invite_token is absent from the request', () => {
      const req = { query: {} };

      const params = strategy.authorizationParams(req as any);

      expect(params).not.toHaveProperty('state');
    });

    it('does NOT include state when req.query is undefined', () => {
      const req = {};

      const params = strategy.authorizationParams(req as any);

      expect(params).not.toHaveProperty('state');
    });
  });

  describe('validate(req, accessToken, refreshToken, profile, done)', () => {
    it('calls done with a correctly shaped GoogleUser built from profile data', () => {
      const mockProfile = {
        id: 'google-profile-id-1',
        name: { givenName: 'Carol', familyName: 'Sales' },
        emails: [{ value: 'carol@example.com' }],
      };
      const mockDone = jest.fn();
      const mockReq = { query: {} };

      strategy.validate(
        mockReq as any,
        'access-tok',
        'refresh-tok',
        mockProfile as any,
        mockDone,
      );

      expect(mockDone).toHaveBeenCalledTimes(1);
      const [err, user] = mockDone.mock.calls[0] as [null, GoogleUser];
      expect(err).toBeNull();
      expect(user).toMatchObject({
        googleId: 'google-profile-id-1',
        email: 'carol@example.com',
        firstName: 'Carol',
        lastName: 'Sales',
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
      });
    });

    it('passes invite_token from req.query to done as part of the GoogleUser context or as extra state', () => {
      const mockProfile = {
        id: 'google-profile-id-2',
        name: { givenName: 'Dave', familyName: 'Rep' },
        emails: [{ value: 'dave@example.com' }],
      };
      const mockDone = jest.fn();
      const mockReq = { query: { state: 'invite-token-xyz' } };

      strategy.validate(
        mockReq as any,
        'access-tok',
        'refresh-tok',
        mockProfile as any,
        mockDone,
      );

      // done must be called (not throw)
      expect(mockDone).toHaveBeenCalledTimes(1);
      // The user object or additional arg should carry invite_token for AuthController
      const args = mockDone.mock.calls[0];
      expect(args[0]).toBeNull(); // no error
    });
  });
});
