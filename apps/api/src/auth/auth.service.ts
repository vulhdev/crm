import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { GoogleUser, JwtPayload } from '@crm/types';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  login(user: GoogleUser): string {
    const payload: JwtPayload = {
      sub: user.googleId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    };
    return this.jwtService.sign(payload);
  }
}
