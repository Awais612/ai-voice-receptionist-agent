import { AdminGuard } from "./admin.guard";

function makeCtx(pw?: string): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: pw ? { "x-admin-password": pw } : {} }),
    }),
  };
}

describe("AdminGuard", () => {
  beforeAll(() => { process.env.ADMIN_PASSWORD = "secret"; });

  const g = new AdminGuard();

  it("allows correct password", () => expect(g.canActivate(makeCtx("secret"))).toBe(true));
  it("rejects wrong password", () => expect(g.canActivate(makeCtx("nope"))).toBe(false));
  it("rejects missing header", () => expect(g.canActivate(makeCtx())).toBe(false));
});
