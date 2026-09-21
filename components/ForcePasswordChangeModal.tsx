'use client';

import { useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';

const field =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500';

/**
 * Prompt shown while the signed-in user still has a temporary password. It can
 * be postponed until the grace deadline, after which it blocks the app.
 */
export default function ForcePasswordChangeModal() {
  const { data: session, update } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [postponed, setPostponed] = useState(false);

  const mustChange = Boolean(session?.user?.mustChangePassword);
  const deadline = session?.mustChangeBy ?? null;
  const overdue = deadline === null || Date.now() > new Date(deadline).getTime();

  if (!mustChange || (postponed && !overdue)) {
    return null;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Не удалось сохранить');
        return;
      }
      await update();
    } catch {
      setError('Ошибка сети');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">Смените временный пароль</h2>
        <p className="text-sm text-slate-400">
          {overdue
            ? 'Пароль выдан временно и его нужно сменить, чтобы продолжить.'
            : 'Пароль выдан временно. Задайте свой' +
              (deadline
                ? ' — можно отложить до ' + new Date(deadline).toLocaleString('ru-RU') + '.'
                : '.')}
        </p>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Текущий (временный) пароль</span>
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
          <span className="mb-1 block text-slate-300">Новый пароль</span>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Повторите новый пароль</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className={field}
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-slate-100 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
          >
            {busy ? 'Сохраняю...' : 'Сменить пароль'}
          </button>
          {!overdue && (
            <button
              type="button"
              onClick={() => setPostponed(true)}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Позже
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
