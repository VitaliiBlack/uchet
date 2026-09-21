'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminJson, fmtDate } from '@/lib/adminClient';

type EventRow = {
  id: number | string;
  type: string;
  user_id: number | null;
  email: string | null;
  ip: string | null;
  detail: unknown;
  created_at: string;
};

const TYPES = [
  '',
  'login_ok',
  'login_fail',
  'logout',
  'password_reset_request',
  'password_reset',
  'email_change',
  'session_revoked',
  'admin_login_ok',
  'admin_login_fail',
  'admin_action',
  'admin_dump',
  'admin_snapshot',
];

export default function LogsSection({ slug, title }: { slug: string; title: string }) {
  const [type, setType] = useState('');
  const { data, error } = useQuery({
    queryKey: ['admin', 'logs', slug, type],
    queryFn: () =>
      fetchAdminJson<{ events: EventRow[] }>(
        '/' + slug + '/api/logs' + (type ? '?type=' + encodeURIComponent(type) : ''),
        '/' + slug + '/login'
      ),
  });

  const events = data?.events ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">{title}</h2>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
        >
          {TYPES.map((value) => (
            <option key={value} value={value}>
              {value === '' ? 'все типы' : value}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-400">Не удалось загрузить журнал</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
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
            {events.map((event) => (
              <tr key={event.id} className="border-t border-slate-800">
                <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(event.created_at)}</td>
                <td className="py-2 pr-4">{event.type}</td>
                <td className="py-2 pr-4">{event.email ?? '—'}</td>
                <td className="py-2 pr-4">{event.ip ?? '—'}</td>
                <td className="py-2 font-mono text-xs text-slate-400">
                  {event.detail ? JSON.stringify(event.detail) : '—'}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td className="py-3 text-slate-500" colSpan={5}>
                  Событий нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
