import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
}

/** Reads the `auth_token` httpOnly cookie, verifies it, attaches the user. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = (req.cookies as Record<string, string> | undefined)
      ?.auth_token;
    if (!token) throw new UnauthorizedException('Not authenticated');
    try {
      req.user = this.jwt.verify<AuthUser>(token, {
        secret: process.env.JWT_SECRET,
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
