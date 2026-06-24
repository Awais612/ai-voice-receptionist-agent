import { TokenController } from './token.controller';
import type { Request } from 'express';
import type { AuthUser } from '../auth/jwt-auth.guard';

describe('TokenController', () => {
  it('returns a token and room', async () => {
    process.env.LIVEKIT_API_KEY = 'k';
    process.env.LIVEKIT_API_SECRET = 's';
    const ctrl = new TokenController();
    const req = {
      user: { sub: 'user_1', email: 'a@b.com', name: 'Test User' },
    } as Request & { user: AuthUser };
    const res = await ctrl.token(req);
    expect(typeof res.token).toBe('string');
    expect(res.token.length).toBeGreaterThan(10);
    expect(res.room).toMatch(/^demo-\d+$/);
  });
});
