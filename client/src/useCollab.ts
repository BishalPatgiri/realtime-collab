import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyTextOp,
  type Cursor,
  type PublicUser,
  type ServerMessage,
  type TextOp,
} from '@realtime-collab/shared';
import { diffToOps } from './diff';

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export interface Member {
  connectionId: string;
  user: PublicUser;
  cursor: Cursor | null;
}

/** Caret position the editor should restore after a remote edit shifts it. */
export interface RestoreCaret {
  anchor: number;
  head: number;
  seq: number;
}

/**
 * Shift a character offset to account for a remote op applied before it, so a
 * local caret stays put over the same text when someone else edits.
 */
function transformIndex(index: number, op: TextOp): number {
  if (op.kind === 'insert') {
    return op.index <= index ? index + op.text.length : index;
  }
  if (op.index + op.length <= index) return index - op.length;
  if (op.index >= index) return index;
  return op.index; // caret was inside the deleted range
}

interface UseCollab {
  status: ConnectionStatus;
  content: string;
  members: Member[];
  myConnectionId: string | null;
  restoreCaret: RestoreCaret;
  applyLocalEdit: (value: string, selStart: number, selEnd: number) => void;
  reportCaret: (anchor: number, head: number) => void;
}

export function useCollab(token: string, roomId: string): UseCollab {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [content, setContent] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [myConnectionId, setMyConnectionId] = useState<string | null>(null);
  const [restoreCaret, setRestoreCaret] = useState<RestoreCaret>({ anchor: 0, head: 0, seq: 0 });

  const wsRef = useRef<WebSocket | null>(null);
  const contentRef = useRef('');
  const caretRef = useRef<Cursor>({ anchor: 0, head: 0 });
  const seqRef = useRef(0);

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    let closedByUs = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      setStatus('connecting');
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => setStatus('open');

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as ServerMessage;
        switch (msg.type) {
          case 'welcome':
            setMyConnectionId(msg.connectionId);
            send({ type: 'join', roomId });
            break;
          case 'joined':
            contentRef.current = msg.snapshot.content;
            setContent(msg.snapshot.content);
            break;
          case 'presence:sync':
            setMembers(msg.members);
            break;
          case 'presence:join':
            setMembers((prev) => [...prev.filter((m) => m.connectionId !== msg.member.connectionId), msg.member]);
            break;
          case 'presence:leave':
            setMembers((prev) => prev.filter((m) => m.connectionId !== msg.connectionId));
            break;
          case 'presence:cursor':
            setMembers((prev) =>
              prev.map((m) => (m.connectionId === msg.connectionId ? { ...m, cursor: msg.cursor } : m)),
            );
            break;
          case 'doc:op': {
            const next = applyTextOp(contentRef.current, msg.op);
            contentRef.current = next;
            setContent(next);
            caretRef.current = {
              anchor: transformIndex(caretRef.current.anchor, msg.op),
              head: transformIndex(caretRef.current.head, msg.op),
            };
            seqRef.current += 1;
            setRestoreCaret({ ...caretRef.current, seq: seqRef.current });
            break;
          }
          default:
            break;
        }
      };

      ws.onclose = () => {
        setStatus('closed');
        if (!closedByUs) reconnectTimer = setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      closedByUs = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [token, roomId, send]);

  const applyLocalEdit = useCallback(
    (value: string, selStart: number, selEnd: number) => {
      for (const op of diffToOps(contentRef.current, value)) {
        send({ type: 'doc:op', roomId, op });
      }
      contentRef.current = value;
      setContent(value);
      caretRef.current = { anchor: selStart, head: selEnd };
      send({ type: 'cursor', roomId, cursor: caretRef.current });
    },
    [roomId, send],
  );

  const reportCaret = useCallback(
    (anchor: number, head: number) => {
      caretRef.current = { anchor, head };
      send({ type: 'cursor', roomId, cursor: caretRef.current });
    },
    [roomId, send],
  );

  return { status, content, members, myConnectionId, restoreCaret, applyLocalEdit, reportCaret };
}
