'use client';

import { useState, type FormEvent } from 'react';

export default function ChangePasswordForm({ slug }: { slug: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/' + slug + '/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newEmail, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Не удалось сохранить');
        return;
      }
      window.location.assign('/' + slug);
    } catch {
      setError('Ошибка сети');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-100"
      >
        <h1 className="text-xl font-semibold">Смена учётных данных админа</h1>
        <p className="text-sm text-slate-400">
          Замените стартовый логин и пароль на свои. Логин и пароль должны отличаться от текущих.
        </p>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Текущий пароль</span>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className={field}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Новый логин (email)</span>
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="username"
            className={field}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Новый пароль (мин. 12 символов)</span>
          <input
            type="password"
            required
            minLength={12}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className={field}
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-slate-100 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
        >
          {busy ? 'Сохраняю...' : 'Сохранить и войти'}
        </button>
      </form>
    </div>
  );
}
