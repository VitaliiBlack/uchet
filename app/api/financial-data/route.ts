import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { auth } from '@/lib/auth';

// GET: fetch financial operations (optionally filtered by date)
export async function GET(request: Request) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } // Ensure user ID is present
  const userId = session.user.id;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    const client = await pool.connect();
    let result;
    if (date) {
      result = await client.query(
        'SELECT * FROM financial_operations WHERE user_id = $1 AND date = $2::date ORDER BY id',
        [userId, date]
      );
    } else {
      result = await client.query(
        'SELECT * FROM financial_operations WHERE user_id = $1 ORDER BY date, id',
        [userId]
      );
    }
    client.release();
    return NextResponse.json(result.rows);
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
  const userId = session.user.id;

  try {
    const { date, income, expense, description } = await request.json();

    if (!date) {
      return NextResponse.json({ error: 'Missing required field: date' }, { status: 400 });
    }

    const incomeNum = parseFloat(income) || 0;
    const expenseNum = parseFloat(expense) || 0;

    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO financial_operations (user_id, date, income, expense, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, date, incomeNum, expenseNum, description || '']
    );
    client.release();
    return NextResponse.json(result.rows[0]);
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
  const userId = session.user.id;

  try {
    const { id, income, expense, description } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const incomeNum = parseFloat(income) || 0;
    const expenseNum = parseFloat(expense) || 0;

    const client = await pool.connect();
    const result = await client.query(
      `UPDATE financial_operations
       SET income = $3, expense = $4, description = $5
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, incomeNum, expenseNum, description || '']
    );
    client.release();
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Operation not found or access denied' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
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
  const userId = session.user.id;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }
    const client = await pool.connect();
    const result = await client.query(
      'DELETE FROM financial_operations WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    client.release();
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Operation not found or access denied' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting financial data:', err);
    return NextResponse.json({ error: 'Error deleting financial data' }, { status: 500 });
  }
}