import { notFound } from 'next/navigation';
import { getAdminSlug } from '@/lib/adminAuth';
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
  return <AdminLogin slug={adminSlug} />;
}
