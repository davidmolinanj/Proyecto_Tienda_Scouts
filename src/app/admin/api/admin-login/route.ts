import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.ADMIN_PASSWORD;

    // Esto saldrá en los Logs de Vercel para que veas qué llega
    console.log("Contraseña introducida:", password);
    console.log("Contraseña esperada en Vercel:", correctPassword);

    if (password === correctPassword) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Contraseña incorrecta" }, { status: 401 });
    }
  } catch (error) {
    console.error("Error en API admin-login:", error);
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}