import { NextResponse } from 'next/server';

// 👇 AQUÍ PONES LOS NOMBRES PERMITIDOS (en minúsculas)
const USUARIOS_PERMITIDOS = ['david', 'José', 'Marta', 'laura']; 

export async function POST(request: Request) {
  try {
    const { password, name } = await request.json();
    const correctPassword = process.env.ADMIN_PASSWORD;

    // Limpiamos el nombre que llega
    const nombreLimpio = name ? name.trim().toLowerCase() : '';

    // Comprobamos la contraseña Y que el nombre esté en la lista
    if (password === correctPassword && USUARIOS_PERMITIDOS.includes(nombreLimpio)) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Usuario no autorizado o contraseña incorrecta" }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}