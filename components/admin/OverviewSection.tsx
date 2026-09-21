'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAdminJson, fmtBytes, fmtDate } from '@/lib/adminClient';

type Counts = {
  users: number;
  workspaces: number;
  operations: number;
  members: number;
  admins: number;
  db_bytes: string | number;
};
type EventRow = {
  id: number | string;
  type: string;
  email: string | null;
  ip: string | null;
  created_at: string;
};

export default function OverviewSection({ slug, title }: { slug: string; title: string }) {
  const { data, error } = useQuery({
    queryKey: ['admin', 'overview', slug],
    queryFn: () => fetchAdminJson<{ counts: Counts; events: EventRow[] }>('/' + slug + '/api/stats', '/' + slug + '/login'),
  });

  const counts = data?.counts;
  const events = data?.events ?? [];
  const card = 'rounded-xl border border-slate-800 bg-slate-900 p-4';

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-medium">{title}</h2>
      {error && <p className="text-sm text-red-400">Не удалось загрузить статистику</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
      </div>

      <div className={card}>
        <h3 className="mb-3 text-base font-medium">Последние события</h3>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">Время</th>
                <th className="py-2 pr-4">Тип</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-slate-800">
                  <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(event.created_at)}</td>
                  <td className="py-2 pr-4">{event.type}</td>
                  <td className="py-2 pr-4">{event.email ?? '—'}</td>
                  <td className="py-2">{event.ip ?? '—'}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={4}>
                    Событий пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
