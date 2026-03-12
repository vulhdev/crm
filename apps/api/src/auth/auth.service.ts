import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface GoogleUser {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  login(user: GoogleUser): string {
    const payload = {
      sub: user.googleId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    return this.jwtService.sign(payload);
  }
}
