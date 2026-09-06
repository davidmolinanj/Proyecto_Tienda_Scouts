import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.ADMIN_PASSWORD;

    if (password === correctPassword) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Contraseña incorrecta" }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}