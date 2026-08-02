import { z } from 'zod';
import { textOp, type DocumentSnapshot, type TextOp } from './document.js';

/**
 * The wire protocol spoken over the WebSocket connection.
 *
 * Every message is a JSON object with a `type` discriminator. Inbound
 * (client -> server) messages are validated with zod so the server never
 * trusts the shape of untrusted input. New message types are added here as
 * the protocol grows (auth, rooms, document ops, presence).
 */

export const PROTOCOL_VERSION = 1;

/** Room ids are short, url-safe slugs. */
export const roomId = z.string().min(1).max(64).regex(/^[\w-]+$/);

/** A user as exposed to other clients — never includes credentials. */
export interface PublicUser {
  id: string;
  username: string;
}

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

export const joinMessage = z.object({
  type: z.literal('join'),
  roomId,
});

export const leaveMessage = z.object({
  type: z.literal('leave'),
  roomId,
});

export const docOpMessage = z.object({
  type: z.literal('doc:op'),
  roomId,
  op: textOp,
});

export const clientMessage = z.discriminatedUnion('type', [
  pingMessage,
  echoMessage,
  joinMessage,
  leaveMessage,
  docOpMessage,
]);

export type ClientMessage = z.infer<typeof clientMessage>;

/* ------------------------------------------------------------------ */
/* Server -> Client                                                    */
/* ------------------------------------------------------------------ */

export interface WelcomeMessage {
  type: 'welcome';
  connectionId: string;
  protocolVersion: number;
  serverTime: string;
  user: PublicUser;
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

/** Sent to a client right after it joins a room: the full current document. */
export interface JoinedMessage {
  type: 'joined';
  roomId: string;
  snapshot: DocumentSnapshot;
}

/** Broadcast to the other room members when a document operation is applied. */
export interface DocOpBroadcast {
  type: 'doc:op';
  roomId: string;
  op: TextOp;
  revision: number;
  authorId: string;
}

export type ServerMessage =
  | WelcomeMessage
  | PongMessage
  | EchoReplyMessage
  | ErrorMessage
  | JoinedMessage
  | DocOpBroadcast;

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
