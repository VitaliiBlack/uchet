import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ILike } from 'typeorm';
import { getUserRepository } from '@/lib/typeorm';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { badRequest, serverError, tooManyRequests } from '@/lib/api';
import { isValidEmail, isValidPassword, normalizeEmail } from '@/lib/validation';

export const runtime = 'nodejs';

const REGISTER_LIMIT = 10;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const limit = rateLimit('register:' + clientIp(req), REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!limit.ok) {
    return tooManyRequests(limit.retryAfter);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return badRequest('Missing required fields');
  }

  if (!isValidEmail(email)) {
    return badRequest('Invalid email address');
  }

  if (!isValidPassword(password)) {
    return badRequest('Password must be at least 8 characters');
  }

  try {
    const userRepository = await getUserRepository();
    const existingUser = await userRepository.findOne({
      where: { email: ILike(email) },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = userRepository.create({
      email,
      password: hashedPassword,
    });

    const savedUser = await userRepository.save(newUser);

    return NextResponse.json(
      { id: savedUser.id, email: savedUser.email },
      { status: 201 }
    );
  } catch (error) {
    // Unique-violation race between two concurrent registrations.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    console.error('Registration error:', error);
    return serverError();
  }
}
