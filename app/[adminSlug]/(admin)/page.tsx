import OverviewSection from '@/components/admin/OverviewSection';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  return <OverviewSection slug={adminSlug} title="Обзор" />;
}
