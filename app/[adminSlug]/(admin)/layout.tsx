import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getAdminSlug } from '@/lib/adminAuth';
import { getAdminPageSession } from '@/lib/adminServer';
import { adminNeedsPasswordChange } from '@/lib/adminAuth';
import AdminNav from '@/components/admin/AdminNav';
import AdminLogout from '@/components/admin/AdminLogout';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (!getAdminSlug() || adminSlug !== getAdminSlug()) {
    notFound();
  }
  // Server-side guard: no protected markup is streamed before authentication.
  const session = await getAdminPageSession();
  if (!session) {
    redirect('/' + adminSlug + '/login');
  }
  // The bootstrap admin must replace the placeholder login/password first.
  if (await adminNeedsPasswordChange(session.adminId)) {
    redirect('/' + adminSlug + '/change-password');
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Админ-панель</h1>
          <AdminLogout slug={adminSlug} />
        </header>
        <AdminNav slug={adminSlug} />
        {children}
      </div>
    </div>
  );
}
