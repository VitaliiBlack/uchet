import UsersSection from '@/components/admin/UsersSection';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  return <UsersSection slug={adminSlug} title="Пользователи" />;
}
