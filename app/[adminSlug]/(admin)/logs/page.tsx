import LogsSection from '@/components/admin/LogsSection';

export const dynamic = 'force-dynamic';

export default async function AdminLogsPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  return <LogsSection slug={adminSlug} title="Журнал" />;
}
