import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataSource } from '@/lib/typeorm';
import { resolveWorkspaceId, workspaceNotFoundResponse } from '@/lib/workspaces';

export const runtime = 'nodejs';

// GET: fetch financial operations (optionally filtered by date)
export async function GET(request: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } // Ensure user ID is present
  const userId = Number(session.user.id);

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const workspaceId = await resolveWorkspaceId(
      userId,
      searchParams.get('workspaceId')
    );
    if (!workspaceId) {
      return workspaceNotFoundResponse();
    }

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
    return NextResponse.json({ error: 'Error fetching financial data' }, { status: 500 });
  }
}

// POST: create a new financial operation
export async function POST(request: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = Number(session.user.id);

  try {
    const { date, income, expense, description, workspaceId: rawWorkspaceId } = await request.json();

    if (!date) {
      return NextResponse.json({ error: 'Missing required field: date' }, { status: 400 });
    }

    const workspaceId = await resolveWorkspaceId(userId, rawWorkspaceId);
    if (!workspaceId) {
      return workspaceNotFoundResponse();
    }

    const incomeNum = parseFloat(income) || 0;
    const expenseNum = parseFloat(expense) || 0;
    const dataSource = await getDataSource();

    const result = await dataSource
      .createQueryBuilder()
      .insert()
      .into('financial_operations')
      .values({
        user_id: userId,
        workspace_id: workspaceId,
        date,
        income: incomeNum,
        expense: expenseNum,
        description: description || '',
      })
      .returning([
        'id',
        'user_id',
        'workspace_id',
        'date::text',
        'income',
        'expense',
        'description',
        'profit',
      ])
      .execute();

    const saved = result.raw[0];
    return NextResponse.json({
      ...saved,
      date: saved.date,
    });
  } catch (err) {
    console.error('Error saving financial data:', err);
    return NextResponse.json({ error: 'Error saving financial data' }, { status: 500 });
  }
}

// PUT: update an existing operation
export async function PUT(request: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = Number(session.user.id);

  try {
    const { id, income, expense, description, workspaceId: rawWorkspaceId } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const workspaceId = await resolveWorkspaceId(userId, rawWorkspaceId);
    if (!workspaceId) {
      return workspaceNotFoundResponse();
    }

    const incomeNum = parseFloat(income) || 0;
    const expenseNum = parseFloat(expense) || 0;
    const dataSource = await getDataSource();

    const result = await dataSource
      .createQueryBuilder()
      .update('financial_operations')
      .set({
        income: incomeNum,
        expense: expenseNum,
        description: description || '',
      })
      .where('id = :id AND workspace_id = :workspaceId', {
        id,
        workspaceId,
      })
      .returning([
        'id',
        'user_id',
        'workspace_id',
        'date::text',
        'income',
        'expense',
        'description',
        'profit',
      ])
      .execute();

    if (!result.affected) {
      return NextResponse.json({ error: 'Operation not found or access denied' }, { status: 404 });
    }
    const updated = result.raw[0];
    return NextResponse.json({
      ...updated,
      date: updated.date,
    });
  } catch (err) {
    console.error('Error updating financial data:', err);
    return NextResponse.json({ error: 'Error updating financial data' }, { status: 500 });
  }
}

// DELETE: delete an operation
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = Number(session.user.id);

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const workspaceId = await resolveWorkspaceId(
      userId,
      searchParams.get('workspaceId')
    );
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }
    if (!workspaceId) {
      return workspaceNotFoundResponse();
    }
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
      return NextResponse.json({ error: 'Operation not found or access denied' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting financial data:', err);
    return NextResponse.json({ error: 'Error deleting financial data' }, { status: 500 });
  }
}
