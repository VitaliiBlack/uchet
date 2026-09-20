import { notFound } from 'next/navigation';
import { getAdminSlug } from '@/lib/adminAuth';
import AdminDashboard from '@/components/admin/AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (!getAdminSlug() || adminSlug !== getAdminSlug()) {
    notFound();
  }
  return <AdminDashboard slug={adminSlug} />;
}
