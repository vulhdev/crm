import { Controller, Get, Req, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import type { GoogleUser, CrmUser } from '@crm/types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res() res: any): Promise<void> {
    const rawUser = req.user as GoogleUser & { inviteToken?: string };
    const inviteToken: string | undefined = rawUser.inviteToken;

    const googleUser: GoogleUser = {
      googleId: rawUser.googleId,
      email: rawUser.email,
      firstName: rawUser.firstName,
      lastName: rawUser.lastName,
      accessToken: rawUser.accessToken,
      refreshToken: rawUser.refreshToken,
    };

    let crmUser: CrmUser;

    try {
      if (inviteToken) {
        // Case B: invite redemption
        crmUser = await this.authService.processInviteToken(inviteToken, googleUser);
      } else {
        // Case A: returning user
        const found = await this.authService.findUserByGoogleId(googleUser.googleId);
        if (found) {
          if (found.status === 'Deactivated') {
            throw new ForbiddenException('User is deactivated');
          }
          crmUser = found;
        } else {
          // Bootstrap flow
          crmUser = await this.authService.findOrCreateBootstrapAdmin(googleUser);
        }
      }
    } catch (err) {
      if (err instanceof ForbiddenException) {
        res.status(403).json({ statusCode: 403, message: (err as Error).message });
        return;
      }
      throw err;
    }

    const token = this.authService.login(googleUser, crmUser);
    res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
  }
}
