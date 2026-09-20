'use client';

import { useCallback, useEffect, useState } from 'react';

type Counts = {
  users: number;
  workspaces: number;
  operations: number;
  members: number;
  admins: number;
  db_bytes: string | number;
};
type EventRow = {
  id: number;
  type: string;
  user_id: number | null;
  email: string | null;
  ip: string | null;
  detail: unknown;
  created_at: string;
};
type UserRow = {
  id: number;
  email: string;
  workspaces: number;
  operations: number;
  last_login: string | null;
  failed_logins: number;
};

const fmtBytes = (value: string | number): string => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
};

const fmtDate = (value: string | null): string =>
  value ? new Date(value).toLocaleString('ru-RU') : '—';

export default function AdminDashboard({ slug }: { slug: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const me = await fetch('/' + slug + '/api/me', { cache: 'no-store' });
    if (me.status === 401) {
      window.location.href = '/' + slug + '/login';
      return;
    }
    const [statsRes, usersRes] = await Promise.all([
      fetch('/' + slug + '/api/stats', { cache: 'no-store' }),
      fetch('/' + slug + '/api/users', { cache: 'no-store' }),
    ]);
    if (statsRes.ok) {
      const data = await statsRes.json();
      setCounts(data.counts);
      setEvents(data.events ?? []);
    }
    if (usersRes.ok) {
      const data = await usersRes.json();
      setUsers(data.users ?? []);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (userId: number, action: string, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/' + slug + '/api/users/' + userId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Ошибка операции');
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = (u: UserRow) => {
    const password = window.prompt('Новый пароль для ' + u.email + ' (мин. 8 символов)');
    if (password) void act(u.id, 'reset-password', { password });
  };

  const changeEmail = (u: UserRow) => {
    const email = window.prompt('Новый email для пользователя #' + u.id, u.email);
    if (email) void act(u.id, 'change-email', { email });
  };

  const revoke = (u: UserRow) => {
    if (window.confirm('Разлогинить ' + u.email + ' на всех устройствах?')) {
      void act(u.id, 'revoke-sessions');
    }
  };

  const logout = async () => {
    await fetch('/' + slug + '/api/logout', { method: 'POST' });
    window.location.href = '/' + slug + '/login';
  };

  const card = 'rounded-xl border border-slate-800 bg-slate-900 p-4';

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Админ-панель</h1>
          <button
            onClick={logout}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            Выйти
          </button>
        </header>

        {error && (
          <p className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            ['Пользователи', counts?.users],
            ['Магазины', counts?.workspaces],
            ['Операции', counts?.operations],
            ['Участники', counts?.members],
            ['Админы', counts?.admins],
            ['Размер БД', counts ? fmtBytes(counts.db_bytes) : undefined],
          ].map(([label, value]) => (
            <div key={String(label)} className={card}>
              <div className="text-xs text-slate-400">{label}</div>
              <div className="mt-1 text-xl font-semibold">{value ?? '—'}</div>
            </div>
          ))}
        </section>

        <section className={card}>
          <h2 className="mb-3 text-lg font-medium">Пользователи</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Магазинов</th>
                  <th className="py-2 pr-4">Операций</th>
                  <th className="py-2 pr-4">Последний вход</th>
                  <th className="py-2 pr-4">Ошибок входа</th>
                  <th className="py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-800">
                    <td className="py-2 pr-4 text-slate-400">{u.id}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">{u.workspaces}</td>
                    <td className="py-2 pr-4">{u.operations}</td>
                    <td className="py-2 pr-4">{fmtDate(u.last_login)}</td>
                    <td className="py-2 pr-4">
                      {u.failed_logins > 0 ? (
                        <span className="text-amber-400">{u.failed_logins}</span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busy}
                          onClick={() => resetPassword(u)}
                          className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                        >
                          Сбросить пароль
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => changeEmail(u)}
                          className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                        >
                          Сменить email
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => revoke(u)}
                          className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                        >
                          Разлогинить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={7}>
                      Пользователей пока нет.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-3 text-lg font-medium">Журнал событий (последние 50)</h2>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Время</th>
                  <th className="py-2 pr-4">Тип</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2">Детали</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-slate-800">
                    <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(e.created_at)}</td>
                    <td className="py-2 pr-4">{e.type}</td>
                    <td className="py-2 pr-4">{e.email ?? '—'}</td>
                    <td className="py-2 pr-4">{e.ip ?? '—'}</td>
                    <td className="py-2 font-mono text-xs text-slate-400">
                      {e.detail ? JSON.stringify(e.detail) : '—'}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={5}>
                      Событий пока нет.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
