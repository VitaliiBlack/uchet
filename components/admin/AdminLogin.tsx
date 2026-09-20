'use client';

import { useState, type FormEvent } from 'react';

export default function AdminLogin({ slug }: { slug: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/' + slug + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.href = '/' + slug;
        return;
      }
      setError(
        res.status === 429
          ? 'Слишком много попыток. Попробуйте позже.'
          : 'Неверный email или пароль'
      );
    } catch {
      setError('Ошибка сети');
    }
    setBusy(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-100"
      >
        <h1 className="text-xl font-semibold">Админ-панель</h1>
        <p className="text-xs text-slate-400">Доступ только для администратора</p>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Пароль</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-slate-100 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
        >
          {busy ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </main>
  );
}
