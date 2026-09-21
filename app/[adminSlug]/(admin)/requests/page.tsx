import RequestsSection from '@/components/admin/RequestsSection';

export const dynamic = 'force-dynamic';

export default async function AdminRequestsPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  return <RequestsSection slug={adminSlug} title="Запросы" />;
}
