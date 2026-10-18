import { supabase } from '../lib/supabase';
import StoreClient from '../components/StoreClient';
import WelcomeModal from '../components/WelcomeModal'; // IMPORTAMOS EL POPUP

export const dynamic = 'force-dynamic'; 

interface Variant { id: string; size: string; price: number; stock: number; }
interface Product { id: string; name: string; description: string; image_url: string; category: string; product_variants: Variant[]; }

async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, image_url, category, product_variants(id, size, price, stock)');

  if (error) { console.error('Error al cargar productos:', error.message); return []; }
  
  const filteredData = (data as Product[]).filter(producto => producto.product_variants.length > 0);

  // Orden jerárquico actualizado con las palabras exactas (en singular para que abarque más)
  const categoryOrder = ['ropa', 'cuaderno', 'material', 'accesorio'];

  const sortedData = filteredData.sort((a, b) => {
    const catA = a.category.toLowerCase();
    const catB = b.category.toLowerCase();

    const indexA = categoryOrder.findIndex(cat => catA.includes(cat));
    const indexB = categoryOrder.findIndex(cat => catB.includes(cat));

    const posA = indexA === -1 ? 999 : indexA;
    const posB = indexB === -1 ? 999 : indexB;

    // 1º: Ordenamos por la jerarquía que hemos marcado arriba
    if (posA !== posB) {
      return posA - posB;
    }
    // 2º: Si están en la misma posición (o ambos son de otras categorías), los agrupamos por nombre de categoría para que no se mezclen
    return catA.localeCompare(catB);
  });

  return sortedData;
}

export default async function HomePage() {
  const products = await getProducts();
  
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      
      {/* AQUÍ INYECTAMOS LA VENTANA EMERGENTE */}
      <WelcomeModal />
      
      {/* BARRA SUPERIOR MINIMALISTA CON DETALLE DE COLOR SCOUT */}
      <div className="w-full h-1.5 bg-gradient-to-r from-green-600 via-purple-600 to-slate-300"></div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        
        {/* Cabecera sutil integrada */}
        <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-200/60 pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-purple-700 bg-purple-100/60 px-3 py-1 rounded-full">
              Tienda Oficial
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-2">
              Grupo Scout San Pío X
            </h1>
          </div>
          <p className="text-sm font-medium text-slate-500">
            Reserva tu material y equipación scout
          </p>
        </header>

        {/* CONTENEDOR DE TIENDA */}
        <StoreClient products={products} />
        
      </div>
    </main>
  );
}