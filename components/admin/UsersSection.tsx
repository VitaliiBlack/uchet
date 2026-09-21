'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminJson, postAdminJson, fmtDate } from '@/lib/adminClient';

type UserRow = {
  id: number;
  email: string;
  workspaces: number;
  operations: number;
  last_login: string | null;
  failed_logins: number;
};

export default function UsersSection({ slug, title }: { slug: string; title: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const login = '/' + slug + '/login';

  const { data } = useQuery({
    queryKey: ['admin', 'users', slug],
    queryFn: () => fetchAdminJson<{ users: UserRow[] }>('/' + slug + '/api/users', login),
  });

  const mutation = useMutation({
    mutationFn: async (input: { userId: number; action: string; payload?: Record<string, unknown> }) =>
      postAdminJson('/' + slug + '/api/users/' + input.userId, { action: input.action, ...(input.payload ?? {}) }, login),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users', slug] }),
    onError: (err) => setError(err instanceof Error ? err.message : 'Ошибка операции'),
  });

  const users = data?.users ?? [];

  const resetPassword = (user: UserRow) => {
    const password = window.prompt('Новый пароль для ' + user.email + ' (мин. 8 символов)');
    if (password) mutation.mutate({ userId: user.id, action: 'reset-password', payload: { password } });
  };

  const changeEmail = (user: UserRow) => {
    const email = window.prompt('Новый email для пользователя #' + user.id, user.email);
    if (email) mutation.mutate({ userId: user.id, action: 'change-email', payload: { email } });
  };

  const revoke = (user: UserRow) => {
    if (window.confirm('Разлогинить ' + user.email + ' на всех устройствах?')) {
      mutation.mutate({ userId: user.id, action: 'revoke-sessions' });
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{title}</h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
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
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-800">
                <td className="py-2 pr-4 text-slate-400">{user.id}</td>
                <td className="py-2 pr-4">{user.email}</td>
                <td className="py-2 pr-4">{user.workspaces}</td>
                <td className="py-2 pr-4">{user.operations}</td>
                <td className="py-2 pr-4">{fmtDate(user.last_login)}</td>
                <td className="py-2 pr-4">
                  {user.failed_logins > 0 ? (
                    <span className="text-amber-400">{user.failed_logins}</span>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={mutation.isPending}
                      onClick={() => resetPassword(user)}
                      className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                    >
                      Сбросить пароль
                    </button>
                    <button
                      disabled={mutation.isPending}
                      onClick={() => changeEmail(user)}
                      className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                    >
                      Сменить email
                    </button>
                    <button
                      disabled={mutation.isPending}
                      onClick={() => revoke(user)}
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
  );
}
