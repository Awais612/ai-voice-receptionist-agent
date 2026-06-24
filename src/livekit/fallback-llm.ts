import { llm as lkllm, DEFAULT_API_CONNECT_OPTIONS } from '@livekit/agents';
import type { APIConnectOptions } from '@livekit/agents';

type ChatArgs = {
  chatCtx: lkllm.ChatContext;
  toolCtx?: lkllm.ToolContext;
  connOptions?: APIConnectOptions;
  parallelToolCalls?: boolean;
  toolChoice?: lkllm.ToolChoice;
  extraKwargs?: Record<string, unknown>;
};

// If the primary emits no chunk within this window, treat it as a hang and
// fail over to the secondary. Guards against Gemini accepting the request but
// never streaming back (no error is thrown in that case).
const FIRST_CHUNK_TIMEOUT_MS = 8000;

/**
 * An LLM that delegates to a primary model and transparently falls back to a
 * secondary model if the primary fails OR hangs before emitting any content.
 * Once tokens have started streaming we can't cleanly switch, so we only fail
 * over before the first chunk.
 */
export class FallbackLLM extends lkllm.LLM {
  // Circuit breaker: once the primary fails, skip it for this many ms so we
  // don't pay the (slow) primary-failure penalty on every single turn.
  private primaryDeadUntil = 0;

  constructor(
    private readonly primary: lkllm.LLM,
    private readonly fallback: lkllm.LLM,
    private readonly cooldownMs = 5 * 60 * 1000,
  ) {
    super();
  }

  label(): string {
    return `fallback(${this.primary.label()}, ${this.fallback.label()})`;
  }

  get model(): string {
    return this.primary.model;
  }

  /** True if the primary is currently "tripped" and should be skipped. */
  isPrimaryTripped(now: number): boolean {
    return now < this.primaryDeadUntil;
  }

  /** Trip the breaker — skip the primary until the cooldown elapses. */
  tripPrimary(now: number): void {
    this.primaryDeadUntil = now + this.cooldownMs;
  }

  chat(args: ChatArgs): lkllm.LLMStream {
    return new FallbackLLMStream(this, this.primary, this.fallback, args);
  }
}

class FallbackLLMStream extends lkllm.LLMStream {
  constructor(
    private readonly parent: FallbackLLM,
    private readonly primary: lkllm.LLM,
    private readonly fallback: lkllm.LLM,
    private readonly args: ChatArgs,
  ) {
    super(parent, {
      chatCtx: args.chatCtx,
      toolCtx: args.toolCtx,
      connOptions: args.connOptions ?? DEFAULT_API_CONNECT_OPTIONS,
    });
  }

  protected async run(): Promise<void> {
    // NOTE: do NOT close `this.queue` here — the base LLMStream closes it
    // automatically once run() resolves, and a separate metrics monitor
    // forwards queue -> output. Closing it ourselves breaks the pipe.

    // Circuit breaker: if the primary recently failed, skip it entirely so we
    // don't waste ~10s on Gemini retries every turn while it's quota-capped.
    if (this.parent.isPrimaryTripped(Date.now())) {
      this.logger.info(
        'FallbackLLM: primary tripped, going straight to secondary (Ollama)',
      );
      await this.streamFrom(this.fallback, 'fallback', false);
      return;
    }

    try {
      const used = await this.streamFrom(this.primary, 'primary', true);
      if (used) return;
      this.logger.warn(
        'primary LLM produced no output; falling back to secondary',
      );
    } catch (err) {
      this.logger.warn(
        { err: String(err) },
        'primary LLM failed before emitting; falling back to secondary',
      );
    }

    // Primary failed OR produced nothing — trip the breaker so subsequent
    // turns skip it (avoids paying the primary penalty every turn).
    this.parent.tripPrimary(Date.now());

    // Fallback path — no timeout guard, this is the last resort.
    this.logger.info('FallbackLLM: invoking secondary (Ollama) LLM');
    await this.streamFrom(this.fallback, 'fallback', false);
  }

  /**
   * Pipes one LLM's chunks into the queue. Returns true if at least one chunk
   * was emitted. When `withTimeout` is set, throws if the first chunk doesn't
   * arrive within FIRST_CHUNK_TIMEOUT_MS. Throws if the model errors before
   * emitting; if it errors *after* emitting, the error is rethrown (no clean
   * failover is possible mid-stream).
   */
  private async streamFrom(
    model: lkllm.LLM,
    which: string,
    withTimeout: boolean,
  ): Promise<boolean> {
    const startMs = Date.now();
    let firstChunkMs = -1;
    let chunkCount = 0;
    this.logger.info(`FallbackLLM[${which}]: requesting completion`);

    const stream = model.chat(this.args);
    let emittedAny = false;

    const iterator = stream[Symbol.asyncIterator]();
    try {
      while (true) {
        const nextPromise = iterator.next();
        const result =
          withTimeout && !emittedAny
            ? await this.withFirstChunkTimeout(nextPromise, which)
            : await nextPromise;
        if (result.done) break;
        if (!emittedAny) {
          firstChunkMs = Date.now() - startMs;
          this.logger.info(
            `FallbackLLM[${which}]: first chunk after ${firstChunkMs}ms`,
          );
        }
        emittedAny = true;
        chunkCount++;
        this.queue.put(result.value);
      }
    } catch (err) {
      this.logger.warn(
        `FallbackLLM[${which}]: error after ${Date.now() - startMs}ms (emitted=${emittedAny})`,
      );
      throw err; // surface to run() (can't fail over mid-stream anyway)
    } finally {
      stream.close();
    }
    this.logger.info(
      `FallbackLLM[${which}]: done — ${chunkCount} chunks, ttft=${firstChunkMs}ms, total=${Date.now() - startMs}ms`,
    );
    return emittedAny;
  }

  private withFirstChunkTimeout<T>(p: Promise<T>, which: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `${which} LLM did not emit within ${FIRST_CHUNK_TIMEOUT_MS}ms (treated as hang)`,
          ),
        );
      }, FIRST_CHUNK_TIMEOUT_MS);
    });
    return Promise.race([p, timeout]);
  }
}
