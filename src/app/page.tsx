import { supabase } from '../lib/supabase';
import StoreClient from '../components/StoreClient';

// ---> ESTA ES LA LÍNEA MÁGICA QUE APAGA LA CACHÉ <---
export const dynamic = 'force-dynamic'; 

// Definición de tipos
interface Variant {
  id: string;
  size: string;
  price: number;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  category: string;
  product_variants: Variant[];
}

// Consultamos la base de datos desde el servidor
async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, product_variants(id, size, price, stock)');

  if (error) {
    console.error('Error al cargar productos:', error.message);
    return [];
  }

  // NUEVO: Filtramos para que NO salgan los productos que no tienen tallas
  const productosConTallas = (data as Product[]).filter(producto => producto.product_variants.length > 0);

  return productosConTallas;
}

export default async function HomePage() {
  // Conseguimos los productos...
  const products = await getProducts();

  // ...y se los pasamos a la interfaz interactiva
  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-emerald-800">
            Tienda de Material Scout
          </h1>
          <p className="text-slate-600 mt-1">
            Selecciona los productos y las tallas para hacer tu pedido.
          </p>
        </header>

        {/* Aquí insertamos nuestro nuevo componente interactivo */}
        <StoreClient products={products} />
      </div>
    </main>
  );
}