'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface Variant { id: string; size: string; price: number; stock: number; }
interface Product { id: string; name: string; category: string; description?: string; product_variants: Variant[]; }
interface Order { id: string; buyer_name: string; scout_unit: string; total_amount: number; status: string; created_at: string; }

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('new'); 
  const [newProduct, setNewProduct] = useState({ name: '', category: 'Ropa', description: '', size: 'M', price: 15, stock: 10 });

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { if (isLoggedIn) fetchData(); }, [isLoggedIn]);

  async function fetchData() {
    setLoading(true);
    const { data: invData } = await supabase.from('products').select(`id, name, category, description, product_variants (id, size, price, stock)`).order('name');
    if (invData) {
      const productosActivos = (invData as Product[]).filter(p => p.product_variants.length > 0);
      setProducts(productosActivos);
    }
    const { data: ordData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (ordData) setOrders(ordData as Order[]);
    setLoading(false);
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setErrorMessage('');

    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    const rawWhitelist = process.env.NEXT_PUBLIC_ADMIN_WHITELIST || '';

    const allowedUsers = rawWhitelist
      .split(',')
      .map(name => name.trim().toLowerCase())
      .filter(name => name.length > 0);

    const enteredName = adminName.trim().toLowerCase();

    if (passwordInput !== correctPassword) {
      setErrorMessage('Contraseña incorrecta.');
      setPasswordInput('');
      setIsLoggingIn(false);
      return;
    }

    if (allowedUsers.length > 0 && !allowedUsers.includes(enteredName)) {
      setErrorMessage(`El usuario "${adminName.trim()}" no está autorizado en este panel.`);
      setIsLoggingIn(false);
      return;
    }

    const fechaActual = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" });
    await supabase.from('admin_logs').insert([{ admin_name: adminName.trim(), created_at: fechaActual }]);
    
    setIsLoggedIn(true);
    setIsLoggingIn(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  };

  // Modificar stock de 1 en 1
  const handleStockStep = async (variantId: string, currentStock: number, delta: number) => {
    const newStock = Math.max(0, currentStock + delta);
    if (newStock === currentStock) return;
    setProducts(prev => prev.map(p => ({
      ...p,
      product_variants: p.product_variants.map(v => v.id === variantId ? { ...v, stock: newStock } : v)
    })));
    await supabase.from('product_variants').update({ stock: newStock }).eq('id', variantId);
  };

  // Modificar stock por lote
  const handleModifyStock = async (variantId: string, currentStock: number, mode: 'add' | 'remove') => {
    const actionText = mode === 'add' ? 'añadir al' : 'quitar del';
    const input = window.prompt(
      `Stock actual: ${currentStock} uds.\n\n¿Cuántas unidades quieres ${actionText} stock?`
    );
    
    if (!input) return;
    
    const amount = parseInt(input, 10);
    if (isNaN(amount) || amount <= 0) {
      alert("Por favor, introduce un número válido mayor que 0.");
      return;
    }

    const newStock = mode === 'add' 
      ? currentStock + amount 
      : Math.max(0, currentStock - amount);

    setProducts(prev => prev.map(p => ({
      ...p,
      product_variants: p.product_variants.map(v => v.id === variantId ? { ...v, stock: newStock } : v)
    })));

    await supabase.from('product_variants').update({ stock: newStock }).eq('id', variantId);
  };

  // Borrar variante y, si no quedan más tallas, borrar el producto padre
  const handleDeleteVariant = async (variantId: string, productId: string) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta talla?")) return;

    // 1. Borrar la talla
    const { error: variantError } = await supabase.from('product_variants').delete().eq('id', variantId);
    
    if (variantError) {
      alert("⚠️ No se puede eliminar: " + variantError.message);
      return;
    }

    // 2. Comprobar si al producto le queda alguna otra talla
    const { data: remainingVariants } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', productId);

    // Si ya no queda ninguna talla, eliminamos el producto padre en 'products'
    if (!remainingVariants || remainingVariants.length === 0) {
      await supabase.from('products').delete().eq('id', productId);
    }

    // 3. Recargar la tabla
    fetchData(); 
  };

  const handleAddNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let productIdToUse = selectedProductId;
    if (selectedProductId === 'new') {
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .insert([{ 
          name: newProduct.name, 
          category: newProduct.category,
          description: newProduct.description 
        }])
        .select('id')
        .single();

      if (prodErr || !prodData) { alert("Error al crear el producto."); setLoading(false); return; }
      productIdToUse = prodData.id;
    }
    const { error: varErr } = await supabase.from('product_variants').insert([{ product_id: productIdToUse, size: newProduct.size, price: newProduct.price, stock: newProduct.stock }]);
    if (varErr) { alert("Error al añadir la talla."); } else {
      alert("¡Añadido con éxito!");
      setShowAddForm(false);
      setNewProduct({ name: '', category: 'Ropa', description: '', size: 'M', price: 15, stock: 10 });
      setSelectedProductId('new'); 
      fetchData();
    }
  };

  const filteredProducts = products.filter(product => {
    const matchName = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDesc = (product.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchSize = product.product_variants.some(v => v.size.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchName || matchCategory || matchDesc || matchSize;
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-md max-w-sm w-full border border-slate-200 text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-500 text-sm mb-6">Panel exclusivo para monitores autorizados.</p>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Tu Nombre (Autorizado)</label>
              <input 
                type="text" 
                required 
                value={adminName} 
                onChange={(e) => setAdminName(e.target.value)} 
                placeholder="Ej: David" 
                className="w-full p-3 border border-slate-300 rounded focus:border-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Contraseña de la Comisión</label>
              <input 
                type="password" 
                required 
                value={passwordInput} 
                onChange={(e) => setPasswordInput(e.target.value)} 
                placeholder="••••••••" 
                className={`w-full p-3 border rounded tracking-widest outline-none ${errorMessage ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-emerald-500'}`} 
              />
              {errorMessage && <p className="text-red-600 text-xs font-bold mt-2">{errorMessage}</p>}
            </div>
            <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded mt-2">
              {isLoggingIn ? 'Comprobando...' : 'Entrar al Panel'}
            </button>
          </form>
          <div className="mt-6"><Link href="/" className="text-sm text-slate-400 hover:text-slate-600 underline">Volver a la tienda</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center mb-6">
          <div><h1 className="text-3xl font-bold text-slate-900">Panel de Administración</h1><p className="text-slate-500">Gestión de la Tienda Scout (Usuario: <strong className="text-emerald-700">{adminName}</strong>)</p></div>
          <div className="flex gap-4">
            <button onClick={() => {setIsLoggedIn(false); setAdminName(''); setPasswordInput(''); setErrorMessage('');}} className="text-slate-500 hover:text-slate-800 font-bold px-4 py-2">Cerrar sesión</button>
            <Link href="/" className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded font-semibold transition-colors">Volver a la tienda</Link>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex gap-4 mb-6 border-b border-slate-200 pb-2">
          <button onClick={() => setActiveTab('orders')} className={`font-bold px-4 py-2 rounded-t-lg transition-colors ${activeTab === 'orders' ? 'text-emerald-700 border-b-4 border-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>📋 Pedidos</button>
          <button onClick={() => setActiveTab('inventory')} className={`font-bold px-4 py-2 rounded-t-lg transition-colors ${activeTab === 'inventory' ? 'text-emerald-700 border-b-4 border-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>📦 Inventario</button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-semibold">Cargando base de datos...</div>
          ) : (
            <>
              {/* --- PEDIDOS --- */}
              {activeTab === 'orders' && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                    <tr><th className="p-4">Fecha</th><th className="p-4">Comprador</th><th className="p-4">Sección</th><th className="p-4 text-right">Total</th><th className="p-4 text-center">Estado</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">No hay pedidos registrados.</td></tr> : orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="p-4 text-slate-500">{new Date(order.created_at).toLocaleDateString()}</td>
                        <td className="p-4 font-bold">{order.buyer_name}</td>
                        <td className="p-4 text-slate-600">{order.scout_unit || '-'}</td>
                        <td className="p-4 font-semibold text-right">{order.total_amount.toFixed(2)} €</td>
                        <td className="p-4 text-center">
                          <select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 cursor-pointer outline-none transition-colors ${order.status === 'Pendiente' ? 'bg-amber-50 text-amber-700 border-amber-200' : order.status === 'Pagado' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`} >
                            <option value="Pendiente">⏳ Pendiente</option><option value="Pagado">💸 Pagado</option><option value="Entregado">✅ Entregado</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* --- INVENTARIO --- */}
              {activeTab === 'inventory' && (
                <div>
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-slate-700 w-full sm:w-auto text-lg">Control de Stock</h3>
                    
                    <div className="relative w-full sm:w-64">
                      <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                      <input 
                        type="text" 
                        placeholder="Buscar nombre, talla o detalle..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500 shadow-sm transition-colors"
                      />
                    </div>

                    <button onClick={() => setShowAddForm(!showAddForm)} className="w-full sm:w-auto bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
                      {showAddForm ? '❌ Cancelar' : '➕ Añadir Artículo/Talla'}
                    </button>
                  </div>

                  {showAddForm && (
                    <form onSubmit={handleAddNewProduct} className="p-6 bg-slate-100 border-b border-slate-200 flex flex-col gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">¿A qué producto pertenece?</label>
                        <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="w-full p-3 bg-white border-2 border-slate-300 rounded-lg font-bold text-base outline-none focus:border-emerald-500 shadow-sm cursor-pointer transition-colors">
                          <option value="new">✨ Crear producto completamente nuevo...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                          ))}
                        </select>
                      </div>

                      {selectedProductId === 'new' && (
                        <>
                          <div className="flex gap-4">
                            <div className="w-1/2"><label className="block text-xs font-bold text-slate-600 mb-1">Nombre del producto</label><input type="text" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Ej: Polo Scout" className="w-full p-2 border rounded text-sm" /></div>
                            <div className="w-1/2"><label className="block text-xs font-bold text-slate-600 mb-1">Categoría</label><input type="text" required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} placeholder="Ej: Ropa" className="w-full p-2 border rounded text-sm" /></div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Descripción corta (opcional)</label>
                            <input 
                              type="text" 
                              value={newProduct.description} 
                              onChange={e => setNewProduct({...newProduct, description: e.target.value})} 
                              placeholder="Ej: 100% algodón, logo bordado en el pecho" 
                              className="w-full p-2 border rounded text-sm" 
                            />
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div><label className="block text-xs font-bold text-slate-600 mb-1">Talla / Variante</label><input type="text" required value={newProduct.size} onChange={e => setNewProduct({...newProduct, size: e.target.value})} placeholder="Ej: XL, Única..." className="w-full p-2 border rounded text-sm" /></div>
                        <div><label className="block text-xs font-bold text-slate-600 mb-1">Precio (€)</label><input type="number" step="0.50" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm" /></div>
                        <div><label className="block text-xs font-bold text-slate-600 mb-1">Stock Inicial</label><input type="number" required value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})} className="w-full p-2 border rounded text-sm" /></div>
                      </div>
                      
                      <button type="submit" className="bg-emerald-600 text-white px-4 py-3 rounded font-bold hover:bg-emerald-700 transition-colors mt-2">
                        {selectedProductId === 'new' ? 'Guardar Nuevo Producto' : 'Añadir Talla al Producto'}
                      </button>
                    </form>
                  )}

                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                      <tr><th className="p-4">Producto</th><th className="p-4">Categoría</th><th className="p-4 text-center">Talla</th><th className="p-4 text-right">Precio</th><th className="p-4 text-right">Stock</th><th className="p-4"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map((product) => (
                        product.product_variants.map((variant) => (
                          <tr key={variant.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-4">
                              <div className="font-medium text-slate-900">{product.name}</div>
                              {product.description && (
                                <div className="text-xs text-slate-400 font-normal mt-0.5">{product.description}</div>
                              )}
                            </td>
                            <td className="p-4"><span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded">{product.category}</span></td>
                            <td className="p-4 font-bold text-center text-slate-700">{variant.size}</td>
                            <td className="p-4 text-right text-slate-600">{variant.price.toFixed(2)} €</td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={() => handleModifyStock(variant.id, variant.stock, 'remove')} 
                                  className="bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 border border-slate-200 px-2.5 py-1 rounded text-xs font-bold transition-colors"
                                  title="Quitar varias unidades"
                                >
                                  ➖ Quitar
                                </button>

                                <button 
                                  onClick={() => handleStockStep(variant.id, variant.stock, -1)} 
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 w-7 h-7 rounded-full font-bold flex items-center justify-center transition-colors text-sm"
                                  title="Restar 1 unidad"
                                >
                                  -
                                </button>
                                
                                <span className={`font-bold min-w-[32px] text-center text-sm ${variant.stock < 5 ? 'text-red-600' : 'text-emerald-700'}`}>
                                  {variant.stock}
                                </span>

                                <button 
                                  onClick={() => handleStockStep(variant.id, variant.stock, 1)} 
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 w-7 h-7 rounded-full font-bold flex items-center justify-center transition-colors text-sm"
                                  title="Añadir 1 unidad"
                                >
                                  +
                                </button>

                                <button 
                                  onClick={() => handleModifyStock(variant.id, variant.stock, 'add')} 
                                  className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 px-2.5 py-1 rounded text-xs font-bold transition-colors"
                                  title="Añadir varias unidades"
                                >
                                  ➕ Añadir
                                </button>
                              </div>
                            </td>
                            <td className="p-4 text-center w-10">
                              <button 
                                onClick={() => handleDeleteVariant(variant.id, product.id)} 
                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all text-base cursor-pointer" 
                                title="Eliminar talla"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))
                      ))}
                      {filteredProducts.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay productos que coincidan con la búsqueda.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}