/**
 * LiveKit agent worker entrypoint.
 *
 * Launched as a separate process by AgentBootstrap so that cli.runApp() can
 * own the process lifecycle without conflicting with NestJS.
 */

import 'dotenv/config';
import {
  defineAgent,
  JobContext,
  cli,
  voice,
  llm,
  ServerOptions,
} from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as googlePlugin from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';
import { PrismaClient } from '@prisma/client';
import { FallbackLLM } from './fallback-llm';
import { createPrismaAdapter } from '../appointments/prisma-adapter';
import { PrismaService } from '../appointments/prisma.service';
import { BusinessConfig } from '../config/business.config';
import { GoogleClientService } from '../calendar/google-client.service';
import { AvailabilityService } from '../calendar/availability.service';
import { CalendarBookingService } from '../calendar/booking.service';
import { ToolsService } from '../booking/tools.service';
import { LangfuseService } from '../observability/langfuse.service';

// Bootstrap DI manually — this file runs outside the Nest container
const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const cfg = new BusinessConfig();
const gclient = new GoogleClientService();
const availability = new AvailabilityService(gclient, cfg);
const calBooking = new CalendarBookingService(gclient, cfg);
// ToolsService wants the Nest PrismaService, which only adds lifecycle hooks
// over PrismaClient; the raw client is behaviourally identical for our queries.
const svcTools = new ToolsService(
  availability,
  calBooking,
  prisma as unknown as PrismaService,
);
const langfuse = new LangfuseService();

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const session = await prisma.callSession.create({
      data: { roomName: ctx.room.name ?? 'unknown' },
    });

    const gemini = new googlePlugin.LLM({ model: 'gemini-2.0-flash' });
    // Equivalent to openai.LLM.withOllama(...) but via the full constructor so
    // we can cap maxCompletionTokens — keeps the local model's replies short,
    // which is both faster to generate and faster to speak (voice = concise).
    const ollama = new openai.LLM({
      model: process.env.OLLAMA_MODEL ?? 'qwen2.5:7b',
      baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
      apiKey: 'ollama',
      temperature: 0.4,
      maxCompletionTokens: 200,
    });

    // LLM_MODE: "fallback" (default) = Gemini primary + Ollama fallback,
    // "gemini" = Gemini only, "ollama" = Ollama only. Set via env for debugging.
    const llmMode = process.env.LLM_MODE ?? 'fallback';
    const sessionLlm =
      llmMode === 'gemini'
        ? gemini
        : llmMode === 'ollama'
          ? ollama
          : new FallbackLLM(gemini, ollama);

    const agentSession = new voice.AgentSession({
      // VAD is bundled by AgentSession (silero via @livekit/local-inference) — no explicit plugin needed.
      stt: new deepgram.STT(),
      llm: sessionLlm,
      // Deepgram Aura streams raw linear16 PCM. Use its native 24kHz rate —
      // forcing a server-side upsample (e.g. 48kHz) introduces within-word
      // artifacts; LiveKit resamples 24kHz -> 48kHz cleanly on its own.
      tts: new deepgram.TTS({
        model: 'aura-asteria-en',
        encoding: 'linear16',
        sampleRate: 24000,
      }),
      turnHandling: {
        // Wait a touch longer after the caller stops talking before
        // declaring their turn over — avoids cutting in on natural pauses.
        endpointing: { minDelay: 700, maxDelay: 4000 },
        // Require a real utterance before Ava lets herself be interrupted,
        // so brief noise / backchannels ("uh-huh") don't chop her off.
        interruption: { minDuration: 800, minWords: 2 },
      },
    });

    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const todayHuman = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const instructions = `You are ${cfg.persona}, the friendly and professional front-desk receptionist at ${cfg.name}.
Shop hours: Monday–Saturday, ${cfg.hours.start}:00–${cfg.hours.end}:00. Appointments are 1-hour slots.

KEEP EVERY REPLY SHORT — this is a phone call. One or two sentences, max ~30 words. Ask for one or two pieces of information at a time. Do NOT list everything at once or speak in paragraphs.

TODAY'S DATE is ${todayHuman} (${todayISO}).
- NEVER guess or invent a date. Always compute dates relative to today.
- When the caller says a weekday like "Friday", work out the NEXT upcoming date for that weekday on or after today, and confirm the exact date with the caller (e.g. "this Friday, June 27th — is that right?").
- All dates passed to tools MUST be in YYYY-MM-DD format.

Your job is to book, check, cancel, or reschedule car repair appointments using the tools available.

YOU MUST COLLECT ALL of the following from the caller BEFORE calling book_appointment. Ask for any that are still missing, ONE OR TWO AT A TIME, in a natural conversation. Do NOT offer to book or confirm a booking until you have every item:
1. Full name
2. Email address
3. Phone number
4. Vehicle (make, model, and year — e.g. "Toyota Corolla 2018")
5. Service or issue (e.g. "oil change", "brake check", "engine noise")
6. Preferred date and time

CONVERSATION FLOW:
- Greet, then ask what they need (book / check / cancel / reschedule).
- For a booking: collect the caller's details above. It's fine to check availability for a date they mention, but do NOT finalise the booking until name, email, phone, and vehicle are all gathered.
- Before calling book_appointment, read back ALL details to the caller and get a clear "yes".

Rules:
1. ALWAYS call check_availability before offering or confirming a time slot.
2. If the requested slot is full, offer the open alternatives from the tool result — never guess availability.
3. If you cannot hear or understand the caller, politely ask them to repeat.
4. If the caller asks about hours, location, or other general questions, answer from the context above, then return to the task.
5. Never invent availability, dates, or confirmation codes — only use the tools.`;

    const agent = new voice.Agent({
      instructions,
      tools: {
        check_availability: llm.tool({
          description:
            'Check open appointment slots for a given date (YYYY-MM-DD format).',
          parameters: {
            type: 'object' as const,
            properties: {
              date: {
                type: 'string',
                description: 'Date in YYYY-MM-DD format',
              },
            },
            required: ['date'],
          },
          execute: async ({ date }: { date: string }) =>
            langfuse.traceTool('check_availability', { date }, () =>
              svcTools
                .checkAvailability({ date })
                .catch((e) => ({ ok: false, error: String(e) })),
            ),
        }),
        book_appointment: llm.tool({
          description:
            'Book a car repair appointment after confirming all caller details.',
          parameters: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              vehicle: {
                type: 'string',
                description: 'Make, model and year e.g. Toyota Corolla 2018',
              },
              service: {
                type: 'string',
                description: 'Service or issue description',
              },
              date: { type: 'string', description: 'YYYY-MM-DD' },
              time: { type: 'string', description: 'HH:MM in 24-hour format' },
            },
            required: [
              'name',
              'email',
              'phone',
              'vehicle',
              'service',
              'date',
              'time',
            ],
          },
          execute: async (args: {
            name: string;
            email: string;
            phone: string;
            vehicle: string;
            service: string;
            date: string;
            time: string;
          }) =>
            langfuse.traceTool('book_appointment', args, () =>
              svcTools
                .bookAppointment(args)
                .catch((e) => ({ ok: false, error: String(e) })),
            ),
        }),
        cancel_appointment: llm.tool({
          description:
            'Cancel an existing appointment by confirmation code or caller name.',
          parameters: {
            type: 'object' as const,
            properties: {
              identifier: {
                type: 'string',
                description: 'Confirmation code (e.g. AC-1234) or caller name',
              },
            },
            required: ['identifier'],
          },
          execute: async ({ identifier }: { identifier: string }) =>
            langfuse.traceTool('cancel_appointment', { identifier }, () =>
              svcTools
                .cancelAppointment({ identifier })
                .catch((e) => ({ ok: false, error: String(e) })),
            ),
        }),
        reschedule_appointment: llm.tool({
          description: 'Move an existing appointment to a new date and time.',
          parameters: {
            type: 'object' as const,
            properties: {
              identifier: {
                type: 'string',
                description: 'Confirmation code or caller name',
              },
              newDate: { type: 'string', description: 'New date YYYY-MM-DD' },
              newTime: { type: 'string', description: 'New time HH:MM' },
            },
            required: ['identifier', 'newDate', 'newTime'],
          },
          execute: async (args: {
            identifier: string;
            newDate: string;
            newTime: string;
          }) =>
            langfuse.traceTool('reschedule_appointment', args, () =>
              svcTools
                .rescheduleAppointment(args)
                .catch((e) => ({ ok: false, error: String(e) })),
            ),
        }),
      },
    });

    agentSession.on(
      voice.AgentSessionEventTypes.ConversationItemAdded,
      (ev) => {
        const item = ev.item;
        if (!('role' in item)) return;
        const role =
          item.role === 'user' ? ('user' as const) : ('agent' as const);
        const contentParts: unknown[] =
          (item as { content?: unknown[] }).content ?? [];
        const text = contentParts
          .map((c) =>
            typeof c === 'string' ? c : ((c as { text?: string }).text ?? ''),
          )
          .join(' ')
          .trim();
        if (!text) return;
        void prisma.transcriptEntry
          .create({ data: { sessionId: session.id, role, content: text } })
          .catch((e: Error) => console.error('transcript persist failed', e));
      },
    );

    await agentSession.start({ agent, room: ctx.room });
    await agentSession.say(
      `Thanks for calling ${cfg.name}, this is ${cfg.persona}. How can I help you today?`,
    );

    ctx.room.on('disconnected', () => {
      const endedAt = new Date();
      const durationSeconds = Math.round(
        (endedAt.getTime() - session.startedAt.getTime()) / 1000,
      );
      void prisma.callSession
        .update({
          where: { id: session.id },
          data: { endedAt, durationSeconds },
        })
        .catch(() => {});
    });
  },
});

cli.runApp(new ServerOptions({ agent: __filename }));
