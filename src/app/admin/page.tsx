'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

// Tipos de datos básicos
interface Variant { id: string; size: string; price: number; stock: number; }
interface Product { id: string; name: string; category: string; product_variants: Variant[]; }

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar los productos al entrar a la página
  useEffect(() => {
    async function fetchInventory() {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, category,
          product_variants (id, size, price, stock)
        `)
        .order('category');

      if (error) {
        console.error("Error cargando inventario:", error);
      } else if (data) {
        setProducts(data as Product[]);
      }
      setLoading(false);
    }

    fetchInventory();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Cabecera del Panel */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Panel de Administración</h1>
            <p className="text-slate-500">Gestión de inventario del Grupo Scout</p>
          </div>
          <Link href="/" className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded font-semibold transition-colors">
            Volver a la tienda
          </Link>
        </div>

        {/* Tabla de Inventario */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando inventario...</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-semibold">Producto</th>
                  <th className="p-4 font-semibold">Categoría</th>
                  <th className="p-4 font-semibold">Talla</th>
                  <th className="p-4 font-semibold">Precio</th>
                  <th className="p-4 font-semibold text-right">Stock Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  product.product_variants.map((variant) => (
                    <tr key={variant.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{product.name}</td>
                      <td className="p-4"><span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">{product.category}</span></td>
                      <td className="p-4 font-bold text-slate-700">{variant.size}</td>
                      <td className="p-4">{variant.price.toFixed(2)} €</td>
                      <td className="p-4 text-right">
                        <span className={`font-bold px-3 py-1 rounded ${variant.stock < 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {variant.stock} uds.
                        </span>
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}