import { z } from 'zod';

/**
 * The wire protocol spoken over the WebSocket connection.
 *
 * Every message is a JSON object with a `type` discriminator. Inbound
 * (client -> server) messages are validated with zod so the server never
 * trusts the shape of untrusted input. New message types are added here as
 * the protocol grows (auth, rooms, document ops, presence).
 */

export const PROTOCOL_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Client -> Server                                                    */
/* ------------------------------------------------------------------ */

export const pingMessage = z.object({
  type: z.literal('ping'),
});

export const echoMessage = z.object({
  type: z.literal('echo'),
  payload: z.string().max(4096),
});

export const clientMessage = z.discriminatedUnion('type', [pingMessage, echoMessage]);

export type ClientMessage = z.infer<typeof clientMessage>;

/* ------------------------------------------------------------------ */
/* Server -> Client                                                    */
/* ------------------------------------------------------------------ */

export interface WelcomeMessage {
  type: 'welcome';
  connectionId: string;
  protocolVersion: number;
  serverTime: string;
}

export interface PongMessage {
  type: 'pong';
  serverTime: string;
}

export interface EchoReplyMessage {
  type: 'echo';
  payload: string;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export type ServerMessage = WelcomeMessage | PongMessage | EchoReplyMessage | ErrorMessage;

/* ------------------------------------------------------------------ */
/* Codec helpers                                                       */
/* ------------------------------------------------------------------ */

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: string };

/** Safely parse and validate a raw inbound frame into a ClientMessage. */
export function parseClientMessage(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Message is not valid JSON' };
  }

  const result = clientMessage.safeParse(json);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid message' };
  }
  return { ok: true, message: result.data };
}

/** Serialize a server message for transmission. */
export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
