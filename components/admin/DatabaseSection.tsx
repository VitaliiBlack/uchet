'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminJson, postAdminJson, fmtBytes, fmtDate } from '@/lib/adminClient';

type Snapshot = { filename: string; bytes: number; createdAt: string };
type Table = { name: string; rows: number; bytes: string | number };
type DbData = {
  snapshots: Snapshot[];
  tables: Table[];
  dbBytes: string | number;
  retain: number;
};

export default function DatabaseSection({ slug, title }: { slug: string; title: string }) {
  const queryClient = useQueryClient();
  const [sendToTelegram, setSendToTelegram] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const login = '/' + slug + '/login';

  const { data } = useQuery({
    queryKey: ['admin', 'database', slug],
    queryFn: () => fetchAdminJson<DbData>('/' + slug + '/api/database/snapshots', login),
  });

  const dump = useMutation({
    mutationFn: async (toTelegram: boolean) =>
      postAdminJson<{ filename: string; bytes: number; sentToTelegram: boolean }>(
        '/' + slug + '/api/database/dump',
        { sendToTelegram: toTelegram },
        login
      ),
    onSuccess: async (result) => {
      setError(null);
      setMessage(
        'Дамп создан: ' + result.filename + (result.sentToTelegram ? ' · отправлен в Telegram' : '')
      );
      await queryClient.invalidateQueries({ queryKey: ['admin', 'database', slug] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Не удалось создать дамп'),
  });

  const snapshots = data?.snapshots ?? [];
  const tables = data?.tables ?? [];
  // Sum of our own tables — the meaningful number. pg_database_size() also
  // includes Postgres' system catalogs (~7 MB for any empty database).
  const dataBytes = tables.reduce((sum, table) => sum + Number(table.bytes || 0), 0);
  const card = 'rounded-xl border border-slate-800 bg-slate-900 p-4';

  const download = (file: string) => {
    window.location.assign('/' + slug + '/api/database/download?file=' + encodeURIComponent(file));
  };

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-medium">{title}</h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={card}>
          <div className="text-xs text-slate-400">Размер БД (вся)</div>
          <div className="mt-1 text-xl font-semibold">{fmtBytes(data?.dbBytes ?? 0)}</div>
          <div className="mt-1 text-[11px] text-slate-500">включая системный каталог Postgres</div>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-400">Данные приложения</div>
          <div className="mt-1 text-xl font-semibold">{fmtBytes(dataBytes)}</div>
          <div className="mt-1 text-[11px] text-slate-500">наши таблицы</div>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-400">Снапшотов хранится</div>
          <div className="mt-1 text-xl font-semibold">{snapshots.length}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-slate-400">Хранить последних</div>
          <div className="mt-1 text-xl font-semibold">{data?.retain ?? '—'}</div>
        </div>
      </div>

      <div className={card}>
        <h3 className="mb-3 text-base font-medium">Создать снапшот</h3>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => dump.mutate(sendToTelegram)}
            disabled={dump.isPending}
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
          >
            {dump.isPending ? 'Создаю...' : 'Создать дамп БД'}
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={sendToTelegram}
              onChange={(e) => setSendToTelegram(e.target.checked)}
            />
            отправить в Telegram
          </label>
        </div>
      </div>

      <div className={card}>
        <h3 className="mb-3 text-base font-medium">Таблицы</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2 pr-4">Таблица</th>
              <th className="py-2 pr-4">Строк</th>
              <th className="py-2">Размер</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => (
              <tr key={table.name} className="border-t border-slate-800">
                <td className="py-2 pr-4 font-mono text-xs">{table.name}</td>
                <td className="py-2 pr-4">{table.rows}</td>
                <td className="py-2">{fmtBytes(table.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={card}>
        <h3 className="mb-3 text-base font-medium">Снапшоты</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2 pr-4">Файл</th>
              <th className="py-2 pr-4">Размер</th>
              <th className="py-2 pr-4">Создан</th>
              <th className="py-2">Действие</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.filename} className="border-t border-slate-800">
                <td className="py-2 pr-4 font-mono text-xs">{snapshot.filename}</td>
                <td className="py-2 pr-4">{fmtBytes(snapshot.bytes)}</td>
                <td className="py-2 pr-4">{fmtDate(snapshot.createdAt)}</td>
                <td className="py-2">
                  <button
                    onClick={() => download(snapshot.filename)}
                    className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                  >
                    Скачать
                  </button>
                </td>
              </tr>
            ))}
            {snapshots.length === 0 && (
              <tr>
                <td className="py-3 text-slate-500" colSpan={4}>
                  Снапшотов пока нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
