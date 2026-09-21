'use client';

export default function AdminLogout({ slug }: { slug: string }) {
  const logout = async () => {
    try {
      await fetch('/' + slug + '/api/logout', { method: 'POST' });
    } finally {
      window.location.href = '/' + slug + '/login';
    }
  };

  return (
    <button
      onClick={logout}
      className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
    >
      Выйти
    </button>
  );
}
