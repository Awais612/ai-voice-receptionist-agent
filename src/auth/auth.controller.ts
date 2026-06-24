import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard, type AuthUser } from './jwt-auth.guard';

const COOKIE_NAME = 'auth_token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// The frontend and backend run on different origins (different ports in dev,
// likely different domains in prod), so the auth cookie must be cross-site:
// SameSite=None requires Secure. Browsers treat http://localhost as a secure
// context, so Secure cookies still work in local dev.
function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { email?: string; password?: string; name?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password, name } = body;
    if (!email || !password || !name) {
      throw new BadRequestException('Email, password and name are required');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const { token, user } = await this.auth.register(email, password, name);
    setAuthCookie(res, token);
    return { user };
  }

  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = body;
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }
    const { token, user } = await this.auth.login(email, password);
    setAuthCookie(res, token);
    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    // Must match the attributes used when setting, or the browser won't clear it.
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
    });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: AuthUser }) {
    return {
      user: { id: req.user.sub, email: req.user.email, name: req.user.name },
    };
  }
}
