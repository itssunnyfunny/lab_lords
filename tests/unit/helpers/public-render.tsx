import { renderToReadableStream } from "react-dom/server";
import type { ReactNode } from "react";

/** Public renderers read request language on the server, so wait for their complete SSR stream. */
export async function renderPublic(node: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}
