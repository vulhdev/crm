import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import type { GoogleUser } from '@crm/types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_OAUTH_CLIENT_ID') as string,
      clientSecret: configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') as string,
      callbackURL:
        configService.get<string>('GOOGLE_OAUTH_CALLBACK_URL') ??
        'http://localhost:3000/auth/google/callback',
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
      passReqToCallback: true,
    });
  }

  authorizationParams(req: any): Record<string, string> {
    const params: Record<string, string> = { access_type: 'offline', prompt: 'consent' };
    const inviteToken = req?.query?.invite_token;
    if (inviteToken) {
      params.state = inviteToken;
    }
    return params;
  }

  validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): void {
    const { name, emails } = profile;
    const user: GoogleUser = {
      googleId: profile.id,
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}
