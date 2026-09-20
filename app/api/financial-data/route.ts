import { NextResponse } from 'next/server';
import { getDataSource } from '@/lib/typeorm';
import { resolveWorkspaceId, workspaceNotFoundResponse } from '@/lib/workspaces';
import { getSessionUserId, unauthorized, badRequest } from '@/lib/api';
import {
  isValidDateKey,
  parseMoney,
  parsePositiveInt,
  sanitizeText,
} from '@/lib/validation';

export const runtime = 'nodejs';

const OPERATION_RETURNING = [
  'id',
  'user_id',
  'workspace_id',
  'date::text',
  'income',
  'expense',
  'description',
  'profit',
];

// GET: fetch financial operations (optionally filtered by date)
export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (date !== null && !isValidDateKey(date)) {
    return badRequest('Invalid date format, expected YYYY-MM-DD');
  }

  const workspaceId = await resolveWorkspaceId(
    userId,
    searchParams.get('workspaceId')
  );
  if (!workspaceId) {
    return workspaceNotFoundResponse();
  }

  try {
    const dataSource = await getDataSource();
    const query = dataSource
      .createQueryBuilder()
      .select('fo.id', 'id')
      .addSelect('fo.user_id', 'user_id')
      .addSelect('fo.workspace_id', 'workspace_id')
      .addSelect('fo.date::text', 'date')
      .addSelect('fo.income', 'income')
      .addSelect('fo.expense', 'expense')
      .addSelect('fo.description', 'description')
      .addSelect('fo.profit', 'profit')
      .from('financial_operations', 'fo')
      .where('fo.workspace_id = :workspaceId', { workspaceId });

    if (date) {
      query.andWhere('fo.date = :date', { date });
    }

    query.orderBy('fo.date', 'ASC').addOrderBy('fo.id', 'ASC');

    return NextResponse.json(await query.getRawMany());
  } catch (err) {
    console.error('Error fetching financial data:', err);
    return NextResponse.json(
      { error: 'Error fetching financial data' },
      { status: 500 }
    );
  }
}

// POST: create a new financial operation
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { date } = body;
  if (!isValidDateKey(date)) {
    return badRequest('Missing or invalid required field: date');
  }

  const workspaceId = await resolveWorkspaceId(userId, body.workspaceId as number | string | null);
  if (!workspaceId) {
    return workspaceNotFoundResponse();
  }

  try {
    const dataSource = await getDataSource();
    const result = await dataSource
      .createQueryBuilder()
      .insert()
      .into('financial_operations')
      .values({
        user_id: userId,
        workspace_id: workspaceId,
        date,
        income: parseMoney(body.income),
        expense: parseMoney(body.expense),
        description: sanitizeText(body.description),
      })
      .returning(OPERATION_RETURNING)
      .execute();

    const saved = result.raw[0];
    return NextResponse.json({
      ...saved,
      date: saved.date,
    });
  } catch (err) {
    console.error('Error saving financial data:', err);
    return NextResponse.json(
      { error: 'Error saving financial data' },
      { status: 500 }
    );
  }
}

// PUT: update an existing operation
export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const id = parsePositiveInt(body.id);
  if (!id) {
    return badRequest('Missing or invalid required field: id');
  }

  const workspaceId = await resolveWorkspaceId(userId, body.workspaceId as number | string | null);
  if (!workspaceId) {
    return workspaceNotFoundResponse();
  }

  try {
    const dataSource = await getDataSource();
    const result = await dataSource
      .createQueryBuilder()
      .update('financial_operations')
      .set({
        income: parseMoney(body.income),
        expense: parseMoney(body.expense),
        description: sanitizeText(body.description),
      })
      .where('id = :id AND workspace_id = :workspaceId', {
        id,
        workspaceId,
      })
      .returning(OPERATION_RETURNING)
      .execute();

    if (!result.affected) {
      return NextResponse.json(
        { error: 'Operation not found or access denied' },
        { status: 404 }
      );
    }

    const updated = result.raw[0];
    return NextResponse.json({
      ...updated,
      date: updated.date,
    });
  } catch (err) {
    console.error('Error updating financial data:', err);
    return NextResponse.json(
      { error: 'Error updating financial data' },
      { status: 500 }
    );
  }
}

// DELETE: delete an operation
export async function DELETE(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const id = parsePositiveInt(searchParams.get('id'));
  if (!id) {
    return badRequest('Missing or invalid id parameter');
  }

  const workspaceId = await resolveWorkspaceId(
    userId,
    searchParams.get('workspaceId')
  );
  if (!workspaceId) {
    return workspaceNotFoundResponse();
  }

  try {
    const dataSource = await getDataSource();
    const result = await dataSource
      .createQueryBuilder()
      .delete()
      .from('financial_operations')
      .where('id = :id AND workspace_id = :workspaceId', {
        id,
        workspaceId,
      })
      .returning('id')
      .execute();

    if (!result.affected) {
      return NextResponse.json(
        { error: 'Operation not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting financial data:', err);
    return NextResponse.json(
      { error: 'Error deleting financial data' },
      { status: 500 }
    );
  }
}
