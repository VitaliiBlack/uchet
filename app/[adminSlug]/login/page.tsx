import { notFound, redirect } from 'next/navigation';
import { getAdminSlug } from '@/lib/adminAuth';
import { isAdminRequestAuthorized } from '@/lib/adminServer';
import AdminLogin from '@/components/admin/AdminLogin';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (!getAdminSlug() || adminSlug !== getAdminSlug()) {
    notFound();
  }
  // Already authenticated? Skip the login form.
  if (await isAdminRequestAuthorized()) {
    redirect('/' + adminSlug);
  }
  return <AdminLogin slug={adminSlug} />;
}
