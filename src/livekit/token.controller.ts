import { Controller, Post } from "@nestjs/common";
import { AccessToken } from "livekit-server-sdk";

@Controller("livekit")
export class TokenController {
  @Post("token")
  async token() {
    const room = `demo-${Math.floor(Math.random() * 1e6)}`;
    const identity = `caller-${Math.floor(Math.random() * 1e6)}`;
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity },
    );
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });
    return { token: await at.toJwt(), room };
  }
}
