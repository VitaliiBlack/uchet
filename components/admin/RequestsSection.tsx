'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminJson, postAdminJson, fmtDate } from '@/lib/adminClient';

type RequestRow = {
  id: number | string;
  user_id: number | null;
  email: string | null;
  ip: string | null;
  detail: { exists?: boolean } | null;
  created_at: string;
};

export default function RequestsSection({ slug, title }: { slug: string; title: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const login = '/' + slug + '/login';

  const { data } = useQuery({
    queryKey: ['admin', 'requests', slug],
    queryFn: () => fetchAdminJson<{ requests: RequestRow[] }>('/' + slug + '/api/requests', login),
  });

  const mutation = useMutation({
    mutationFn: async (input: { userId: number; password: string }) =>
      postAdminJson('/' + slug + '/api/users/' + input.userId, { action: 'reset-password', password: input.password }, login),
    onSuccess: async () => {
      setError(null);
      setMessage('Пароль обновлён. Пользователь разлогинен везде.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'requests', slug] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Не удалось сбросить пароль'),
  });

  const requests = data?.requests ?? [];

  const reset = (row: RequestRow) => {
    if (!row.user_id) {
      setError('Для этого запроса нет пользователя');
      return;
    }
    const password = window.prompt('Новый пароль для ' + (row.email ?? '') + ' (мин. 8 символов)');
    if (!password) return;
    setMessage(null);
    mutation.mutate({ userId: row.user_id, password });
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-sm text-slate-400">Запросы «забыли пароль» от пользователей.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2 pr-4">Время</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">IP</th>
              <th className="py-2 pr-4">Аккаунт</th>
              <th className="py-2">Действие</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                <td className="py-2 pr-4">{row.email ?? '—'}</td>
                <td className="py-2 pr-4">{row.ip ?? '—'}</td>
                <td className="py-2 pr-4">
                  {row.user_id ? (
                    <span className="text-emerald-400">есть</span>
                  ) : (
                    <span className="text-slate-500">нет</span>
                  )}
                </td>
                <td className="py-2">
                  <button
                    disabled={mutation.isPending || !row.user_id}
                    onClick={() => reset(row)}
                    className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    Сбросить пароль
                  </button>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td className="py-3 text-slate-500" colSpan={5}>
                  Запросов пока нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
