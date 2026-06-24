const spanEnd = jest.fn();
const span = jest.fn(() => ({ end: spanEnd }));
const trace = jest.fn(() => ({ span }));
jest.mock("langfuse", () => ({ Langfuse: jest.fn(() => ({ trace })) }));

import { LangfuseService } from "./langfuse.service";

describe("LangfuseService.traceTool", () => {
  const svc = new LangfuseService();

  beforeEach(() => jest.clearAllMocks());

  it("returns the wrapped function result", async () => {
    const result = await svc.traceTool("book", { a: 1 }, async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  it("calls span.end with output", async () => {
    await svc.traceTool("test", {}, async () => "done");
    expect(spanEnd).toHaveBeenCalledWith({ output: "done" });
  });

  it("re-throws errors and records them", async () => {
    await expect(
      svc.traceTool("err", {}, async () => { throw new Error("fail"); })
    ).rejects.toThrow("fail");
    expect(spanEnd).toHaveBeenCalledWith({ output: { error: "Error: fail" } });
  });
});
