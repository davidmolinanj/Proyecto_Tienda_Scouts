import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; // Ajusta los ../ si te da error de ruta

export async function GET() {
  try {
    // 1. MANTENER SUPABASE DESPIERTO
    await supabase.from('configuracion').select('id').limit(1);

    // 2. LIMPIEZA AUTOMÁTICA DE PEDIDOS CADUCADOS
    // Calculamos la fecha exacta de hace 15 días
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 15); 
    const fechaISO = fechaLimite.toISOString();

    // Borramos los pedidos que estén en 'Pendiente' y sean más antiguos que esa fecha
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('status', 'Pendiente')
      .lt('created_at', fechaISO);

    if (deleteError) throw deleteError;

    return NextResponse.json({ 
      success: true,
      message: '¡Supabase está despierto y los pedidos caducados han sido eliminados! 🧹⏰', 
      timestamp: new Date().toISOString() 
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false,
      message: 'Error al ejecutar las tareas de mantenimiento',
      detalles_del_error: error?.message || "Error desconocido."
    }, { status: 500 });
  }
}