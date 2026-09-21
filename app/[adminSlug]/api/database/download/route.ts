import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { isSafeSnapshotName, readSnapshot } from '@/lib/dbDump';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ adminSlug: string }> }
) {
  const { adminSlug } = await context.params;
  const guard = await requireAdmin(request, adminSlug);
  if ('response' in guard) {
    return guard.response;
  }

  const file = new URL(request.url).searchParams.get('file') ?? '';
  if (!isSafeSnapshotName(file)) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  }

  try {
    const content = await readSnapshot(file);
    return new Response(new Uint8Array(content), {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'attachment; filename="' + file + '"',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
  }
}
