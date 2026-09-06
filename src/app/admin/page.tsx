'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface Variant { id: string; size: string; price: number; stock: number; }
interface Product { id: string; name: string; description: string; category: string; product_variants: Variant[]; }
interface Order { id: string; buyer_name: string; scout_unit: string; total_amount: number; status: string; created_at: string; }

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('new'); 
  const [newProduct, setNewProduct] = useState({ name: '', description: '', category: 'Ropa', size: 'M', price: 15, stock: 10 });
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState<{ productId: string; variantId: string; name: string; category: string; description: string; size: string; price: number; } | null>(null);

  // --- NUEVO: ESTADOS PARA BORRAR PEDIDOS ---
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  useEffect(() => { if (isLoggedIn) fetchData(); }, [isLoggedIn]);

  async function fetchData() {
    setLoading(true);
    const { data: invData } = await supabase.from('products').select(`id, name, description, category, product_variants (id, size, price, stock)`).order('name');
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
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (passwordInput === correctPassword && adminName.trim() !== '') {
      const fechaActual = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" });
      await supabase.from('admin_logs').insert([{ admin_name: adminName, created_at: fechaActual }]);
      setIsLoggedIn(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setPasswordInput('');
    }
    setIsLoggingIn(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  };

  // --- NUEVAS FUNCIONES PARA BORRAR PEDIDOS ---
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  };

  const toggleSelectAllOrders = () => {
    if (selectedOrders.length === orders.length) setSelectedOrders([]);
    else setSelectedOrders(orders.map(o => o.id));
  };

  const handleDeleteOrders = async (orderIds: string[]) => {
    if (!window.confirm(orderIds.length === 1 ? "¿Seguro que quieres eliminar este pedido?" : `¿Seguro que quieres eliminar estos ${orderIds.length} pedidos?`)) return;
    
    const { error } = await supabase.from('orders').delete().in('id', orderIds);
    if (error) {
      alert("Error al eliminar los pedidos.");
    } else {
      setSelectedOrders([]);
      fetchData();
    }
  };

  const handleDeleteAllOrders = async () => {
    const confirmation = window.prompt("⚠️ ATENCIÓN: Vas a borrar TODOS los pedidos para empezar un nuevo año.\n\nEscribe la palabra 'BORRAR' en mayúsculas para confirmar:");
    if (confirmation === 'BORRAR') {
      const allIds = orders.map(o => o.id);
      if(allIds.length === 0) return;
      const { error } = await supabase.from('orders').delete().in('id', allIds);
      if (error) alert("Error al vaciar el historial.");
      else {
        setSelectedOrders([]);
        fetchData();
        alert("¡Historial limpiado con éxito! Listo para la nueva Ronda Solar.");
      }
    } else if (confirmation !== null) {
      alert("Operación cancelada. No has escrito 'BORRAR' correctamente.");
    }
  };
  // ---------------------------------------------

  const handleStockChange = async (variantId: string, currentStock: number, increment: number) => {
    const newStock = Math.max(0, currentStock + increment);
    if (newStock === currentStock) return;
    setProducts(prev => prev.map(p => ({ ...p, product_variants: p.product_variants.map(v => v.id === variantId ? { ...v, stock: newStock } : v) })));
    await supabase.from('product_variants').update({ stock: newStock }).eq('id', variantId);
  };

  const handleBulkStock = async (variantId: string, currentStock: number) => {
    const input = window.prompt(`Stock actual: ${currentStock} uds.\n\n¿Cuántas unidades quieres AÑADIR? \n(Si quieres quitar, escribe un número negativo, ej: -5):`);
    if (!input) return;
    const increment = parseInt(input, 10);
    if (isNaN(increment) || increment === 0) return;
    const newStock = Math.max(0, currentStock + increment); 
    setProducts(prev => prev.map(p => ({ ...p, product_variants: p.product_variants.map(v => v.id === variantId ? { ...v, stock: newStock } : v) })));
    await supabase.from('product_variants').update({ stock: newStock }).eq('id', variantId);
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta talla/producto?")) return;
    const { error } = await supabase.from('product_variants').delete().eq('id', variantId);
    if (error) alert("⚠️ No puedes borrar este artículo porque ya hay pedidos registrados con él (rompería el historial). ¡Pon su stock a 0 en su lugar para ocultarlo!");
    else fetchData(); 
  };

  const handleAddNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let productIdToUse = selectedProductId;
    if (selectedProductId === 'new') {
      const { data: prodData, error: prodErr } = await supabase.from('products').insert([{ name: newProduct.name, category: newProduct.category, description: newProduct.description }]).select('id').single();
      if (prodErr || !prodData) { alert("Error al crear el producto."); setLoading(false); return; }
      productIdToUse = prodData.id;
    }
    const { error: varErr } = await supabase.from('product_variants').insert([{ product_id: productIdToUse, size: newProduct.size, price: newProduct.price, stock: newProduct.stock }]);
    if (varErr) { alert("Error al añadir la talla."); } else {
      alert("¡Añadido con éxito!");
      setShowAddForm(false);
      setNewProduct({ name: '', description: '', category: 'Ropa', size: 'M', price: 15, stock: 10 });
      setSelectedProductId('new'); 
      fetchData();
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    await supabase.from('products').update({ name: editingItem.name, category: editingItem.category, description: editingItem.description }).eq('id', editingItem.productId);
    await supabase.from('product_variants').update({ size: editingItem.size, price: editingItem.price }).eq('id', editingItem.variantId);
    setEditingItem(null);
    fetchData(); 
  };

  const filteredProducts = products.filter(product => {
    const matchName = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSize = product.product_variants.some(v => v.size.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchName || matchCategory || matchSize;
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-md max-w-sm w-full border border-slate-200 text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
          <form onSubmit={handleLogin} className="space-y-4 text-left mt-6">
            <div><label className="block text-xs font-bold text-slate-600 mb-1">Tu Nombre</label><input type="text" required value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full p-3 border border-slate-300 rounded outline-none" /></div>
            <div><label className="block text-xs font-bold text-slate-600 mb-1">Contraseña</label><input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className={`w-full p-3 border rounded tracking-widest outline-none ${loginError ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} /></div>
            <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 text-white font-bold py-3 px-4 rounded mt-2">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex justify-between items-center mb-6">
          <div><h1 className="text-3xl font-bold text-slate-900">Panel de Administración</h1><p className="text-slate-500">Usuario: <strong className="text-emerald-700">{adminName}</strong></p></div>
          <div className="flex gap-4">
            <button onClick={() => {setIsLoggedIn(false); setAdminName(''); setPasswordInput('');}} className="text-slate-500 font-bold px-4 py-2">Cerrar sesión</button>
            <Link href="/" className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded font-semibold">Tienda</Link>
          </div>
        </div>

        <div className="flex gap-4 mb-6 border-b border-slate-200 pb-2">
          <button onClick={() => setActiveTab('orders')} className={`font-bold px-4 py-2 rounded-t-lg transition-colors ${activeTab === 'orders' ? 'text-emerald-700 border-b-4 border-emerald-600' : 'text-slate-500'}`}>📋 Pedidos</button>
          <button onClick={() => setActiveTab('inventory')} className={`font-bold px-4 py-2 rounded-t-lg transition-colors ${activeTab === 'inventory' ? 'text-emerald-700 border-b-4 border-emerald-600' : 'text-slate-500'}`}>📦 Inventario</button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-semibold">Cargando datos...</div>
          ) : (
            <>
              {/* --- PEDIDOS --- */}
              {activeTab === 'orders' && (
                <div>
                  {/* BARRA DE HERRAMIENTAS DE PEDIDOS */}
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                      <h3 className="font-bold text-slate-700 text-lg">Registro de Pedidos</h3>
                      {selectedOrders.length > 0 && (
                        <button onClick={() => handleDeleteOrders(selectedOrders)} className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded font-bold shadow-sm transition-colors flex items-center gap-1">
                          <span>🗑️</span> Borrar seleccionados ({selectedOrders.length})
                        </button>
                      )}
                    </div>
                    {orders.length > 0 && (
                      <button onClick={handleDeleteAllOrders} className="bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors">
                        ⚠️ Eliminar todos los pedidos
                      </button>
                    )}
                  </div>

                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-4 w-10 text-center">
                          <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={orders.length > 0 && selectedOrders.length === orders.length} onChange={toggleSelectAllOrders} />
                        </th>
                        <th className="p-4">Fecha</th><th className="p-4">Comprador</th><th className="p-4">Sección</th><th className="p-4 text-right">Total</th><th className="p-4 text-center">Estado</th><th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">No hay pedidos registrados.</td></tr> : orders.map((order) => (
                        <tr key={order.id} className={`hover:bg-slate-50 group transition-colors ${selectedOrders.includes(order.id) ? 'bg-blue-50/50' : ''}`}>
                          <td className="p-4 text-center">
                            <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={selectedOrders.includes(order.id)} onChange={() => toggleOrderSelection(order.id)} />
                          </td>
                          <td className="p-4 text-slate-500">{new Date(order.created_at).toLocaleDateString()}</td>
                          <td className="p-4 font-bold">{order.buyer_name}</td>
                          <td className="p-4 text-slate-600">{order.scout_unit || '-'}</td>
                          <td className="p-4 font-semibold text-right">{order.total_amount.toFixed(2)} €</td>
                          <td className="p-4 text-center">
                            <select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 cursor-pointer outline-none transition-colors ${order.status === 'Pendiente' ? 'bg-amber-50 text-amber-700 border-amber-200' : order.status === 'Pagado' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`} >
                              <option value="Pendiente">⏳ Pendiente</option><option value="Pagado">💸 Pagado</option><option value="Entregado">✅ Entregado</option>
                            </select>
                          </td>
                          <td className="p-4 text-center w-10">
                            <button onClick={() => handleDeleteOrders([order.id])} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all" title="Eliminar pedido">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* --- INVENTARIO --- */}
              {activeTab === 'inventory' && (
                <div>
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-slate-700 text-lg">Control de Stock</h3>
                    <div className="relative w-full sm:w-64">
                      <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                      <input type="text" placeholder="Buscar nombre o talla..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500"/>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
                      {showAddForm ? '❌ Cancelar' : '➕ Añadir Artículo'}
                    </button>
                  </div>

                  {showAddForm && (
                     <form onSubmit={handleAddNewProduct} className="p-6 bg-slate-100 border-b border-slate-200 flex flex-col gap-4">
                     <div><label className="block text-xs font-bold text-slate-600 mb-1">¿A qué producto pertenece?</label><select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="w-full p-3 bg-white border-2 border-slate-300 rounded-lg font-bold text-base outline-none focus:border-emerald-500 shadow-sm cursor-pointer transition-colors"><option value="new">✨ Crear producto completamente nuevo...</option>{products.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.category})</option>))}</select></div>
                     {selectedProductId === 'new' && (
                       <><div className="flex gap-4"><div className="w-1/2"><label className="block text-xs font-bold text-slate-600 mb-1">Nombre del producto</label><input type="text" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-2 border rounded text-sm" /></div><div className="w-1/2"><label className="block text-xs font-bold text-slate-600 mb-1">Categoría</label><input type="text" required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-2 border rounded text-sm" /></div></div><div><label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label><textarea value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="w-full p-2 border rounded text-sm" rows={2} /></div></>
                     )}
                     <div className="grid grid-cols-3 gap-4 items-end"><div><label className="block text-xs font-bold text-slate-600 mb-1">Talla / Variante</label><input type="text" required value={newProduct.size} onChange={e => setNewProduct({...newProduct, size: e.target.value})} className="w-full p-2 border rounded text-sm" /></div><div><label className="block text-xs font-bold text-slate-600 mb-1">Precio (€)</label><input type="number" step="0.50" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm" /></div><div><label className="block text-xs font-bold text-slate-600 mb-1">Stock Inicial</label><input type="number" required value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})} className="w-full p-2 border rounded text-sm" /></div></div>
                     <button type="submit" className="bg-emerald-600 text-white px-4 py-3 rounded font-bold hover:bg-emerald-700 transition-colors mt-2">Guardar</button>
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
                            <td className="p-4 font-medium text-slate-900">{product.name}</td>
                            <td className="p-4"><span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded">{product.category}</span></td>
                            <td className="p-4 font-bold text-center text-slate-700">{variant.size}</td>
                            <td className="p-4 text-right text-slate-600">{variant.price.toFixed(2)} €</td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleStockChange(variant.id, variant.stock, -1)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 w-7 h-7 rounded-full font-bold flex items-center justify-center transition-colors">-</button>
                                <button onClick={() => handleBulkStock(variant.id, variant.stock)} className={`font-bold min-w-[34px] py-1 px-2 rounded cursor-pointer hover:bg-slate-200 transition-colors text-center ${variant.stock < 5 ? 'text-red-600' : 'text-emerald-700'}`}>{variant.stock}</button>
                                <button onClick={() => handleStockChange(variant.id, variant.stock, 1)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 w-7 h-7 rounded-full font-bold flex items-center justify-center transition-colors">+</button>
                              </div>
                            </td>
                            <td className="p-4 text-center w-16 whitespace-nowrap">
                              <button onClick={() => setEditingItem({ productId: product.id, variantId: variant.id, name: product.name, category: product.category, description: product.description || '', size: variant.size, price: variant.price })} className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 transition-all mr-3" title="Editar producto">✏️</button>
                              <button onClick={() => handleDeleteVariant(variant.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all" title="Eliminar talla">🗑️</button>
                            </td>
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL DE EDICIÓN */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">✏️ Editar Artículo</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="w-2/3"><label className="block text-xs font-bold text-slate-600 mb-1">Nombre</label><input type="text" required value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2 border rounded outline-none focus:border-emerald-500" /></div>
                <div className="w-1/3"><label className="block text-xs font-bold text-slate-600 mb-1">Categoría</label><input type="text" required value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})} className="w-full p-2 border rounded outline-none focus:border-emerald-500" /></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label><textarea value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full p-2 border rounded outline-none focus:border-emerald-500" rows={2} /></div>
              <div className="flex gap-4">
                <div className="w-1/2"><label className="block text-xs font-bold text-slate-600 mb-1">Talla / Variante</label><input type="text" required value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})} className="w-full p-2 border rounded outline-none focus:border-emerald-500" /></div>
                <div className="w-1/2"><label className="block text-xs font-bold text-slate-600 mb-1">Precio (€)</label><input type="number" step="0.50" required value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value)})} className="w-full p-2 border rounded outline-none focus:border-emerald-500" /></div>
              </div>
              <div className="mt-4 flex gap-3 justify-end">
                <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}