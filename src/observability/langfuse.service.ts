import { Injectable } from "@nestjs/common";
import { Langfuse } from "langfuse";

@Injectable()
export class LangfuseService {
  private readonly lf = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  async traceTool<T>(name: string, input: unknown, fn: () => Promise<T>): Promise<T> {
    const trace = this.lf.trace({ name });
    const span = trace.span({ name, input: input as Record<string, unknown> });
    try {
      const out = await fn();
      span.end({ output: out as Record<string, unknown> });
      return out;
    } catch (e) {
      span.end({ output: { error: String(e) } });
      throw e;
    }
  }
}
