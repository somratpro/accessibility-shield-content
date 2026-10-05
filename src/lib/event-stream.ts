/** Reads a server-sent event stream from our API routes (/api/generate, Posts cleanup). */
export async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (type: string, data: any) => Promise<void> | void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const type = part.match(/^event:\s*(.+)$/m)?.[1]?.trim() || "message";
      const data = part.match(/^data:\s*(.+)$/m)?.[1];
      if (data) await onEvent(type, JSON.parse(data));
    }
  }
}
