import { readLogEntries } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Server-sent events stream of the shared log buffer.
 * The client reconnects automatically, so a 60 second window is plenty.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let lastTs: string | undefined;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      // Seed the stream with the most recent entries.
      const initial = await readLogEntries(120);
      if (initial.length) lastTs = initial[initial.length - 1].ts;
      send(`event: snapshot\ndata: ${JSON.stringify(initial)}\n\n`);

      const timer = setInterval(async () => {
        if (closed) return;
        try {
          const entries = await readLogEntries(60, lastTs);
          if (entries.length) {
            lastTs = entries[entries.length - 1].ts;
            send(`event: logs\ndata: ${JSON.stringify(entries)}\n\n`);
          } else {
            send(`: keepalive\n\n`);
          }
        } catch {
          send(`: error\n\n`);
        }
      }, 2000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener('abort', close);
      setTimeout(close, 55_000);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
