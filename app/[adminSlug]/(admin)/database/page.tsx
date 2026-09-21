import DatabaseSection from '@/components/admin/DatabaseSection';

export const dynamic = 'force-dynamic';

export default async function AdminDatabasePage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  return <DatabaseSection slug={adminSlug} title="База данных" />;
}
