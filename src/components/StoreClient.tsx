'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

// Función para mandar mensajes a Telegram (Colocada fuera para que no se repita)
const avisarPorTelegram = async (mensaje: string) => {
  const token = process.env.NEXT_PUBLIC_TELEGRAM_TOKEN;
  const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
      }),
    });
  } catch (error) {
    console.error("Error al avisar por Telegram:", error);
  }
};

// Tipos de datos
interface Variant { id: string; size: string; price: number; stock: number; }
interface Product { id: string; name: string; description?: string;category: string; product_variants: Variant[]; }
interface CartItem { variant_id: string; product_name: string; size: string; price: number; quantity: number; }

export default function StoreClient({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buyerName, setBuyerName] = useState('');
  const [scoutUnit, setScoutUnit] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const router = useRouter();

  const addToCart = (product: Product, variant: Variant) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.variant_id === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stock) return prev;
        return prev.map((item) => item.variant_id === variant.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { variant_id: variant.id, product_name: product.name, size: variant.size, price: variant.price, quantity: 1 }];
    });
  };

  // Función para eliminar un producto entero del carrito
  const removeFromCart = (variant_id: string) => {
    setCart((prev) => prev.filter((item) => item.variant_id !== variant_id));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (!buyerName.trim()) {
      alert('Por favor, introduce tu nombre para el pedido.');
      return;
    }

    setStatus('loading');

    // 1. Crear la cabecera del pedido
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ buyer_name: buyerName, scout_unit: scoutUnit, total_amount: total }])
      .select('id')
      .single();

    if (orderError || !orderData) {
      alert('Hubo un error al crear el pedido: ' + orderError?.message);
      setStatus('idle');
      return;
    }

    // 2. Crear las líneas de los productos
    const itemsToInsert = cart.map(item => ({
      order_id: orderData.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: item.price
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);

    if (itemsError) {
      alert('Hubo un error al guardar los productos: ' + itemsError.message);
      setStatus('idle');
      return;
    }

    // 3. Descontar el stock de Supabase (VERSIÓN MEJORADA)
    for (const item of cart) {
      const { data: variantInfo, error: selectError } = await supabase
        .from('product_variants')
        .select('stock, size')
        .eq('id', item.variant_id)
        .single();

      if (selectError) {
        alert("¡Aviso! No se pudo leer el stock actual: " + selectError.message);
      }

      if (variantInfo) {
        const stockRestante = variantInfo.stock - item.quantity;

        const { error: updateError } = await supabase
          .from('product_variants')
          .update({ stock: stockRestante })
          .eq('id', item.variant_id);

        if (updateError) {
          alert("¡Aviso! No se pudo restar el stock: " + updateError.message);
        }

        if (stockRestante < 5) {
          const mensajeAlarma = `🚨 ¡Alerta de Almacén Scout!\n\nEl artículo "${item.product_name}" (Talla: ${variantInfo.size}) se está agotando.\n⚠️ Solo quedan: ${stockRestante} unidades.`;
          await avisarPorTelegram(mensajeAlarma);
        }
      }
    }

    // Aviso general del nuevo pedido
    await avisarPorTelegram(`✅ Nuevo pedido de ${buyerName} (${scoutUnit}): ${total} €`);

    // 4. ¡Éxito!
    setStatus('success');
    setCart([]);
    router.refresh();
  };

  if (status === 'success') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 p-12 rounded-xl text-center">
        <h2 className="text-3xl font-bold text-emerald-800 mb-4">¡Pedido completado!</h2>
        <p className="text-emerald-700 mb-6">Hemos registrado tu solicitud correctamente.</p>
        <button onClick={() => setStatus('idle')} className="bg-emerald-600 text-white px-6 py-2 rounded font-bold">
          Hacer otro pedido
        </button>
      </div>
    );
  }

  // Cuando se abra la aplicación a los padres deberé remplazar el if de arriba por lo siguiente:
  //
  // if (status === 'success') {
  //   return (
  //     <div className="bg-emerald-50 border border-emerald-200 p-8 md:p-12 rounded-xl text-center max-w-2xl mx-auto">
  //       <h2 className="text-3xl font-bold text-emerald-800 mb-2">¡Pedido completado!</h2>
  //       <p className="text-emerald-700 mb-8">Hemos registrado tu solicitud correctamente y los responsables ya han sido avisados.</p>
  //       
  //       {/* Recuadro de instrucciones de pago */}
  //       <div className="bg-white p-6 rounded-lg shadow-sm border border-emerald-100 mb-8 text-left">
  //         <h3 className="text-lg font-bold text-slate-800 mb-3">Instrucciones de Pago</h3>
  //         <p className="text-sm text-slate-600 mb-4">Para formalizar el pedido, por favor realiza el pago mediante una de estas opciones:</p>
  //         <ul className="text-sm text-slate-700 space-y-3 mb-4">
  //           <li className="flex items-start gap-2">
  //             <span>📱</span>
  //             <span><strong>Bizum:</strong> Al número <span className="font-mono bg-slate-100 px-1 rounded">600 XX XX XX</span> (Poner en concepto el nombre introducido en el pedido).</span>
  //           </li>
  //           <li className="flex items-start gap-2">
  //             <span>💵</span>
  //             <span><strong>Efectivo:</strong> Entregar el importe exacto al responsable de la sección el próximo sábado.</span>
  //           </li>
  //         </ul>
  //         <p className="text-xs text-amber-700 font-semibold bg-amber-50 p-3 rounded border border-amber-200">
  //           ⚠️ Nota: Los artículos no se entregarán hasta que el equipo de responsables confirme el pago.
  //         </p>
  //       </div>
  //
  //       <button onClick={() => setStatus('idle')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded font-bold transition-colors">
  //         Hacer otro pedido
  //       </button>
  //     </div>
  //   );
  // }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Columna Izquierda: Productos */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white p-6 rounded-xl border shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded">{product.category}</span>
            <h2 className="text-xl font-bold text-slate-800 mt-2">{product.name}</h2>
            {product.description && (
              <details className="mt-2 text-sm text-slate-600 cursor-pointer group">
                <summary className="font-semibold text-emerald-700 hover:text-emerald-800 outline-none list-none flex items-center gap-1 select-none">
                  <span className="text-xs group-open:rotate-90 transition-transform duration-200">▶</span> 
                  Ver descripción
                </summary>
                <p className="mt-2 mb-4 pl-3 border-l-2 border-emerald-300 text-slate-500 leading-relaxed">
                  {product.description}
                </p>
              </details>
)}
            <ul className="mt-4 divide-y divide-slate-100">
              {product.product_variants.map((variant) => (
                <li key={variant.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Talla: <strong className="text-slate-800">{variant.size}</strong></p>
                    <p className="text-xs text-slate-500">{variant.stock} disp.</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className="font-semibold">{Number(variant.price).toFixed(2)} €</span>
                    <button onClick={() => addToCart(product, variant)} disabled={variant.stock === 0} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold py-1 px-4 rounded">
                      Añadir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Columna Derecha: Carrito y Formulario */}
      <div className="w-full md:w-80 bg-white p-6 rounded-xl border shadow-sm h-fit sticky top-6">
        <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Tu Pedido</h3>
        {cart.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">El carrito está vacío.</p>
        ) : (
          <>
            <ul className="space-y-3 mb-6 border-b pb-4">
              {cart.map((item) => (
                <li key={item.variant_id} className="text-sm flex justify-between items-start">
                    <div className="flex flex-col">
                        <span><strong>{item.quantity}x</strong> {item.product_name} ({item.size})</span>
                        <button 
                        onClick={() => removeFromCart(item.variant_id)} 
                        className="text-xs text-red-500 hover:text-red-700 text-left mt-1 underline transition-colors"
                        >
                        Quitar
                        </button>
                    </div>
                    <span className="font-semibold mt-1">{(item.price * item.quantity).toFixed(2)} €</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold">Total:</span>
              <span className="font-bold text-emerald-700 text-2xl">{total.toFixed(2)} €</span>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tu Nombre *</label>
                <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="Ej: David" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sección Scout (Opcional)</label>
                <input type="text" value={scoutUnit} onChange={(e) => setScoutUnit(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="Ej: Tropa" />
              </div>
            </div>

            <button onClick={handleCheckout} disabled={status === 'loading'} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 text-white font-bold py-3 px-4 rounded transition-colors">
              {status === 'loading' ? 'Enviando...' : 'Confirmar Pedido'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}