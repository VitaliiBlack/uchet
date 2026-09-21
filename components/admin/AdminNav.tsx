'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '', label: 'Обзор' },
  { href: '/users', label: 'Пользователи' },
  { href: '/database', label: 'База данных' },
  { href: '/logs', label: 'Журнал' },
  { href: '/requests', label: 'Запросы' },
];

export default function AdminNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = '/' + slug;

  return (
    <nav className="flex flex-wrap gap-2">
      {ITEMS.map((item) => {
        const href = base + item.href;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={
              'rounded-lg border px-3 py-1.5 text-sm transition-colors ' +
              (active
                ? 'border-slate-600 bg-slate-800 text-white'
                : 'border-slate-800 text-slate-300 hover:bg-slate-900')
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
