import { notFound, redirect } from 'next/navigation';
import { adminNeedsPasswordChange, getAdminSlug } from '@/lib/adminAuth';
import { getAdminPageSession } from '@/lib/adminServer';
import ChangePasswordForm from '@/components/admin/ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function AdminChangePasswordPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (!getAdminSlug() || adminSlug !== getAdminSlug()) {
    notFound();
  }
  const session = await getAdminPageSession();
  if (!session) {
    redirect('/' + adminSlug + '/login');
  }
  if (!(await adminNeedsPasswordChange(session.adminId))) {
    redirect('/' + adminSlug);
  }
  return <ChangePasswordForm slug={adminSlug} />;
}
