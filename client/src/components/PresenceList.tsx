import type { Member } from '../useCollab';
import { colorFor, initials } from '../colors';

interface Props {
  members: Member[];
  myConnectionId: string | null;
}

export function PresenceList({ members, myConnectionId }: Props) {
  const sorted = [...members].sort((a, b) => a.user.username.localeCompare(b.user.username));

  return (
    <aside className="presence">
      <h2>In this room · {members.length}</h2>
      <ul>
        {sorted.map((m) => (
          <li key={m.connectionId}>
            <span className="avatar" style={{ background: colorFor(m.connectionId) }}>
              {initials(m.user.username)}
            </span>
            <span className="name">
              {m.user.username}
              {m.connectionId === myConnectionId && <em> (you)</em>}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
