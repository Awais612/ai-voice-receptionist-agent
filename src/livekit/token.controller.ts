import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import type { Request } from 'express';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';

@Controller('livekit')
export class TokenController {
  // Only authenticated users can obtain a room token — this is the real gate
  // that prevents unregistered visitors from calling Ava.
  @Post('token')
  @UseGuards(JwtAuthGuard)
  async token(@Req() req: Request & { user: AuthUser }) {
    const room = `demo-${Math.floor(Math.random() * 1e6)}`;
    // Tie the LiveKit identity to the real user so calls are attributable.
    const identity = `user-${req.user.sub}-${Math.floor(Math.random() * 1e4)}`;
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity, name: req.user.name },
    );
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });
    return { token: await at.toJwt(), room };
  }
}
