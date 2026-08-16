import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { getCaretCoordinates } from '../caret';
import { colorFor } from '../colors';
import type { Member, RestoreCaret } from '../useCollab';

interface Props {
  content: string;
  members: Member[];
  myConnectionId: string | null;
  restoreCaret: RestoreCaret;
  onEdit: (value: string, selStart: number, selEnd: number) => void;
  onCaret: (anchor: number, head: number) => void;
}

interface RemoteCaret {
  connectionId: string;
  username: string;
  color: string;
  top: number;
  left: number;
  height: number;
}

export function Editor({ content, members, myConnectionId, restoreCaret, onEdit, onCaret }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [carets, setCarets] = useState<RemoteCaret[]>([]);

  const recomputeCarets = useCallback(() => {
    const textarea = ref.current;
    if (!textarea) return;
    const next: RemoteCaret[] = [];
    for (const m of members) {
      if (m.connectionId === myConnectionId || !m.cursor) continue;
      const pos = getCaretCoordinates(textarea, Math.min(m.cursor.head, content.length));
      next.push({
        connectionId: m.connectionId,
        username: m.user.username,
        color: colorFor(m.connectionId),
        ...pos,
      });
    }
    setCarets(next);
  }, [members, myConnectionId, content]);

  // Keep overlay carets aligned with content, roster, and scrolling.
  useLayoutEffect(recomputeCarets, [recomputeCarets]);

  // Restore the local caret after a remote edit re-rendered the textarea value.
  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea || document.activeElement !== textarea) return;
    textarea.selectionStart = Math.min(restoreCaret.anchor, restoreCaret.head);
    textarea.selectionEnd = Math.max(restoreCaret.anchor, restoreCaret.head);
  }, [restoreCaret]);

  const handleCaret = () => {
    const t = ref.current;
    if (t) onCaret(t.selectionStart, t.selectionEnd);
  };

  return (
    <div className="editor">
      <div className="editor-overlay" aria-hidden>
        {carets.map((c) => (
          <div key={c.connectionId} className="remote-caret" style={{ top: c.top, left: c.left }}>
            <span className="remote-caret-bar" style={{ background: c.color, height: c.height }} />
            <span className="remote-caret-label" style={{ background: c.color }}>
              {c.username}
            </span>
          </div>
        ))}
      </div>
      <textarea
        ref={ref}
        className="editor-input"
        value={content}
        spellCheck={false}
        placeholder="Start typing — everyone in this room sees it live…"
        onChange={(e) => onEdit(e.target.value, e.target.selectionStart, e.target.selectionEnd)}
        onSelect={handleCaret}
        onKeyUp={handleCaret}
        onClick={handleCaret}
        onScroll={recomputeCarets}
      />
    </div>
  );
}
