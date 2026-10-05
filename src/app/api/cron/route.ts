import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; // Si esto tiene una línea roja debajo, el fallo es la ruta

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('id')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({ 
      success: true,
      message: '¡Supabase está despierto! ⏰', 
      timestamp: new Date().toISOString() 
    }, { status: 200 });

  } catch (error: any) {
    // ESTO ES NUEVO: Imprime el error real en la pantalla
    return NextResponse.json({ 
      success: false,
      message: 'Error al contactar con Supabase',
      detalles_del_error: error?.message || "Error desconocido. Revisa la ruta de importación de supabase."
    }, { status: 500 });
  }
}