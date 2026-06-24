import { TokenController } from "./token.controller";

describe("TokenController", () => {
  it("returns a token and room", async () => {
    process.env.LIVEKIT_API_KEY = "k";
    process.env.LIVEKIT_API_SECRET = "s";
    const ctrl = new TokenController();
    const res = await ctrl.token();
    expect(typeof res.token).toBe("string");
    expect(res.token.length).toBeGreaterThan(10);
    expect(res.room).toMatch(/^demo-\d+$/);
  });
});
