import { supabase } from '../lib/supabase';
import StoreClient from '../components/StoreClient';

export const dynamic = 'force-dynamic'; 

interface Variant { id: string; size: string; price: number; stock: number; }
// NUEVO: Añadida la descripción
interface Product { id: string; name: string; description: string; category: string; product_variants: Variant[]; }

async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    // NUEVO: Pedimos la descripción a Supabase
    .select('id, name, description, category, product_variants(id, size, price, stock)');

  if (error) { console.error('Error al cargar productos:', error.message); return []; }
  const productosConTallas = (data as Product[]).filter(producto => producto.product_variants.length > 0);
  return productosConTallas;
}

export default async function HomePage() {
  const products = await getProducts();
  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-emerald-800">Tienda de Material Scout</h1>
          <p className="text-slate-600 mt-1">Selecciona los productos y las tallas para hacer tu pedido.</p>
        </header>
        <StoreClient products={products} />
      </div>
    </main>
  );
}