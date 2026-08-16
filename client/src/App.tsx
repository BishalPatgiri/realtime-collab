import { useState } from 'react';
import type { AuthResult } from './api';
import { Login } from './components/Login';
import { Editor } from './components/Editor';
import { PresenceList } from './components/PresenceList';
import { useCollab } from './useCollab';

const AUTH_KEY = 'rc.auth';

function loadAuth(): AuthResult | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthResult) : null;
  } catch {
    return null;
  }
}

export function App() {
  const [auth, setAuth] = useState<AuthResult | null>(loadAuth);

  const authenticate = (result: AuthResult) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(result));
    setAuth(result);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuth(null);
  };

  if (!auth) return <Login onAuthenticated={authenticate} />;
  return <Workspace auth={auth} onLogout={logout} />;
}

function Workspace({ auth, onLogout }: { auth: AuthResult; onLogout: () => void }) {
  const [roomInput, setRoomInput] = useState('general');
  const [roomId, setRoomId] = useState('general');
  const { status, content, members, myConnectionId, restoreCaret, applyLocalEdit, reportCaret } =
    useCollab(auth.token, roomId);

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const next = roomInput.trim();
    if (next) setRoomId(next);
  };

  return (
    <div className="workspace">
      <header className="topbar">
        <div className="brand">
          realtime-collab
          <span className={`status status-${status}`}>{status}</span>
        </div>
        <form className="room-form" onSubmit={joinRoom}>
          <span className="room-label">room</span>
          <input value={roomInput} onChange={(e) => setRoomInput(e.target.value)} />
          <button type="submit">Join</button>
        </form>
        <div className="user-box">
          <span>{auth.user.username}</span>
          <button className="link" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="main">
        <Editor
          content={content}
          members={members}
          myConnectionId={myConnectionId}
          restoreCaret={restoreCaret}
          onEdit={applyLocalEdit}
          onCaret={reportCaret}
        />
        <PresenceList members={members} myConnectionId={myConnectionId} />
      </main>
    </div>
  );
}
