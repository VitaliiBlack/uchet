import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserRepository } from '@/lib/typeorm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { password, email } = await req.json();

    if (!password || !email) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const userRepository = await getUserRepository();
    const existingUser = await userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
      },
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
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
