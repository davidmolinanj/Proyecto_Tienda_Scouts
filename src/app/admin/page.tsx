'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface Variant { id: string; size: string; price: number; stock: number; }
// NUEVO: Añadimos min_stock_alert a la interfaz
interface Product { id: string; name: string; description: string; image_url: string; category: string; min_stock_alert: number; product_variants: Variant[]; }
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
  // NUEVO: Añadido min_stock_alert por defecto a 5
  const [newProduct, setNewProduct] = useState({ name: '', description: '', image_url: '', category: 'Ropa', min_stock_alert: 5, size: 'M', price: 15, stock: 10 });
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchInput, setProductSearchInput] = useState('');

  // NUEVO: Añadido min_stock_alert al estado de edición
  const [editingItem, setEditingItem] = useState<{ productId: string; variantId: string; name: string; category: string; description: string; image_url: string; min_stock_alert: number; size: string; price: number; } | null>(null);

  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  useEffect(() => { if (isLoggedIn) fetchData(); }, [isLoggedIn]);

  async function fetchData() {
    setLoading(true);
    // NUEVO: Pedimos min_stock_alert a Supabase
    const { data: invData } = await supabase.from('products').select(`id, name, description, image_url, category, min_stock_alert, product_variants (id, size, price, stock)`).order('name');
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
    
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();

      if (res.ok && data.success && adminName.trim() !== '') {
        const fechaActual = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" });
        await supabase.from('admin_logs').insert([{ admin_name: adminName, created_at: fechaActual }]);
        setIsLoggedIn(true);
        setLoginError(false);
      } else {
        setLoginError(true);
        setPasswordInput('');
      }
    } catch (err) {
      setLoginError(true);
      setPasswordInput('');
    }

    setIsLoggingIn(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  };

  const toggleOrderSelection = (orderId: string) => { setSelectedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]); };
  const toggleSelectAllOrders = () => { if (selectedOrders.length === orders.length) setSelectedOrders([]); else setSelectedOrders(orders.map(o => o.id)); };
  
  const handleDeleteOrders = async (orderIds: string[]) => {
    if (!window.confirm(orderIds.length === 1 ? "¿Seguro que quieres eliminar este pedido?" : `¿Seguro que quieres eliminar estos ${orderIds.length} pedidos?`)) return;
    const { error } = await supabase.from('orders').delete().in('id', orderIds);
    if (!error) { setSelectedOrders([]); fetchData(); }
  };

  const handleDeleteAllOrders = async () => {
    const confirmation = window.prompt("⚠️ ATENCIÓN: Vas a borrar todo el historial de pedidos. ¿Estás seguro de ello?\n\nEscribe la palabra 'BORRAR' en mayúsculas para confirmar:");
    if (confirmation === 'BORRAR') {
      const allIds = orders.map(o => o.id);
      if(allIds.length === 0) return;
      const { error } = await supabase.from('orders').delete().in('id', allIds);
      if (!error) { setSelectedOrders([]); fetchData(); alert("¡Historial limpiado con éxito!"); }
    }
  };

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
    if (error) alert("⚠️ No puedes borrar este artículo porque hay pedidos asociados. Pon el stock a 0.");
    else fetchData(); 
  };

  const handleAddNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let productIdToUse = selectedProductId;
    if (selectedProductId === 'new') {
      const { data: prodData, error: prodErr } = await supabase.from('products').insert([{ name: newProduct.name, category: newProduct.category, description: newProduct.description, image_url: newProduct.image_url, min_stock_alert: newProduct.min_stock_alert }]).select('id').single();
      if (prodErr || !prodData) { alert("Error al crear el producto."); setLoading(false); return; }
      productIdToUse = prodData.id;
    } else {
      // Si se añade una talla a un producto existente, actualizamos por si cambió el aviso mínimo
      await supabase.from('products').update({ min_stock_alert: newProduct.min_stock_alert }).eq('id', productIdToUse);
    }
    const { error: varErr } = await supabase.from('product_variants').insert([{ product_id: productIdToUse, size: newProduct.size, price: newProduct.price, stock: newProduct.stock }]);
    if (varErr) { alert("Error al añadir la talla."); } else {
      alert("¡Añadido con éxito!");
      setShowAddForm(false);
      setNewProduct({ name: '', description: '', image_url: '', category: 'Ropa', min_stock_alert: 5, size: 'M', price: 15, stock: 10 });
      setSelectedProductId('new');
      setProductSearchInput('');
      fetchData();
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    await supabase.from('products').update({ name: editingItem.name, category: editingItem.category, description: editingItem.description, image_url: editingItem.image_url, min_stock_alert: editingItem.min_stock_alert }).eq('id', editingItem.productId);
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

  const filteredProductsForSelect = products.filter(p => 
    p.name.toLowerCase().includes(productSearchInput.toLowerCase()) || 
    p.category.toLowerCase().includes(productSearchInput.toLowerCase())
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-100 text-center">
          <div className="w-12 h-12 bg-purple-100 text-purple-700 font-bold rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl">🔐</div>
          <h2 className="text-xl font-black text-slate-900 mb-1">Panel de Control</h2>
          <p className="text-xs text-slate-500 mb-6">Acceso exclusivo para responsables</p>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Tu Nombre</label>
              <input type="text" required value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-600 transition-colors font-semibold" placeholder="Ej: Akela" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Contraseña</label>
              <input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className={`w-full p-3 bg-slate-50 border rounded-xl text-sm tracking-widest outline-none transition-colors font-semibold ${loginError ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-purple-600'}`} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl mt-2 transition-transform active:scale-95 shadow-md">
              Entrar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      
      {/* BARRA SUPERIOR DECORATIVA */}
      <div className="w-full h-1.5 bg-gradient-to-r from-green-600 via-purple-600 to-slate-300"></div>

      <div className="max-w-[1400px] mx-auto p-6 md:p-8">
        
        {/* ENCABEZADO DE ADMIN */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/70">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
              Gestión Interna
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
              Panel de Administración
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Responsable conectado: <strong className="text-purple-700 font-bold">{adminName}</strong>
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/" className="flex-1 sm:flex-none text-center bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors">
              Ver Tienda Pública ↗
            </Link>
            <button onClick={() => {setIsLoggedIn(false); setAdminName(''); setPasswordInput('');}} className="flex-1 sm:flex-none text-center bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors">
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* PESTAÑAS MODERNAS */}
        <div className="flex gap-3 mb-6">
          <button 
            onClick={() => setActiveTab('orders')} 
            className={`font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-xs flex items-center gap-2 ${activeTab === 'orders' ? 'bg-purple-700 text-white shadow-purple-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <span>📋</span> Registro de Pedidos ({orders.length})
          </button>
          <button 
            onClick={() => setActiveTab('inventory')} 
            className={`font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-xs flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-purple-700 text-white shadow-purple-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <span>📦</span> Control de Inventario ({products.length})
          </button>
        </div>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400 font-semibold text-sm">Cargando información del sistema...</div>
          ) : (
            <>
              {/* --- TABLA DE PEDIDOS --- */}
              {activeTab === 'orders' && (
                <div>
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones masivas:</span>
                      {selectedOrders.length > 0 && (
                        <button onClick={() => handleDeleteOrders(selectedOrders)} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3.5 py-2 rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5">
                          <span>🗑️</span> Borrar seleccionados ({selectedOrders.length})
                        </button>
                      )}
                    </div>
                    {orders.length > 0 && (
                      <button onClick={handleDeleteAllOrders} className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                        ⚠️ Borrar todo el historial de pedidos
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="p-4 w-10 text-center">
                            <input type="checkbox" className="w-4 h-4 cursor-pointer accent-purple-600" checked={orders.length > 0 && selectedOrders.length === orders.length} onChange={toggleSelectAllOrders} />
                          </th>
                          <th className="p-4 font-bold">Fecha</th>
                          <th className="p-4 font-bold">Comprador</th>
                          <th className="p-4 font-bold">Sección</th>
                          <th className="p-4 font-bold text-right">Total</th>
                          <th className="p-4 font-bold text-center">Estado del Pago / Entrega</th>
                          <th className="p-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.length === 0 ? (
                          <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-medium">No hay pedidos registrados actualmente.</td></tr>
                        ) : (
                          orders.map((order) => (
                            <tr key={order.id} className={`hover:bg-slate-50/60 transition-colors group ${selectedOrders.includes(order.id) ? 'bg-purple-50/30' : ''}`}>
                              <td className="p-4 text-center">
                                <input type="checkbox" className="w-4 h-4 cursor-pointer accent-purple-600" checked={selectedOrders.includes(order.id)} onChange={() => toggleOrderSelection(order.id)} />
                              </td>
                              <td className="p-4 text-slate-500 font-medium">{new Date(order.created_at).toLocaleDateString()}</td>
                              <td className="p-4 font-bold text-slate-900">{order.buyer_name}</td>
                              <td className="p-4 text-slate-600"><span className="bg-slate-100 px-2 py-0.5 rounded font-semibold">{order.scout_unit || 'General'}</span></td>
                              <td className="p-4 font-extrabold text-right text-slate-900">{order.total_amount.toFixed(2)} €</td>
                              <td className="p-4 text-center">
                                <select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer outline-none transition-colors ${order.status === 'Pendiente' ? 'bg-amber-50 text-amber-700 border-amber-200' : order.status === 'Pagado' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`} >
                                  <option value="Pendiente">⏳ Pendiente</option>
                                  <option value="Pagado">💸 Pagado</option>
                                  <option value="Entregado">✅ Entregado</option>
                                </select>
                              </td>
                              <td className="p-4 text-center w-10">
                                <button onClick={() => handleDeleteOrders([order.id])} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-all text-sm" title="Eliminar pedido">🗑️</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- TABLA DE INVENTARIO --- */}
              {activeTab === 'inventory' && (
                <div>
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-72">
                      <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                      <input type="text" placeholder="Filtrar por nombre, talla..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-purple-600 transition-colors font-medium"/>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs">
                      {showAddForm ? '❌ Cancelar' : '➕ Añadir Artículo'}
                    </button>
                  </div>

                  {showAddForm && (
                    <form onSubmit={handleAddNewProduct} className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">¿A qué producto pertenece?</label>
                        <div className="relative mb-2">
                          <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                          <input type="text" placeholder="Escribe para buscar un producto existente..." value={productSearchInput} onChange={(e) => setProductSearchInput(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-purple-600 transition-colors font-medium" />
                        </div>
                        <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-semibold text-xs outline-none focus:border-purple-600 shadow-xs cursor-pointer">
                          <option value="new">✨ Crear producto completamente nuevo...</option>
                          {filteredProductsForSelect.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.category})</option>))}
                        </select>
                      </div>

                      {selectedProductId === 'new' && (
                        <>
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1"><label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Nombre</label><input type="text" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" /></div>
                            <div className="flex-1"><label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Categoría</label><input type="text" required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" /></div>
                          </div>
                          <div><label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Descripción</label><textarea value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" rows={2} /></div>
                          <div><label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">URL de la Imagen</label><input type="url" value={newProduct.image_url} onChange={e => setNewProduct({...newProduct, image_url: e.target.value})} placeholder="https://..." className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" /></div>
                        </>
                      )}

                      {/* NUEVO: Campo para configurar el aviso de stock mínimo */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Avisar a Telegram si quedan menos de: (Stock mínimo)</label>
                        <input type="number" required value={newProduct.min_stock_alert} onChange={e => setNewProduct({...newProduct, min_stock_alert: parseInt(e.target.value) || 5})} className="w-full sm:w-1/3 p-2.5 bg-white border border-slate-200 rounded-xl text-xs" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-2">
                        <div><label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Talla / Variante</label><input type="text" required value={newProduct.size} onChange={e => setNewProduct({...newProduct, size: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" /></div>
                        <div><label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Precio (€)</label><input type="number" step="0.50" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" /></div>
                        <div><label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Stock Inicial</label><input type="number" required value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" /></div>
                      </div>

                      <button type="submit" className="bg-purple-700 hover:bg-purple-800 text-white px-5 py-3 rounded-xl font-bold text-xs transition-colors mt-2 shadow-xs">
                        Guardar Artículo
                      </button>
                    </form>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="p-4 font-bold">Producto</th>
                          <th className="p-4 font-bold">Categoría</th>
                          <th className="p-4 font-bold text-center">Talla</th>
                          <th className="p-4 font-bold text-right">Precio</th>
                          <th className="p-4 font-bold text-right">Stock</th>
                          <th className="p-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map((product) => (
                          product.product_variants.map((variant) => (
                            <tr key={variant.id} className="hover:bg-slate-50/60 transition-colors group">
                              <td className="p-4 font-bold text-slate-900">{product.name}</td>
                              <td className="p-4"><span className="bg-purple-50 text-purple-700 font-semibold px-2.5 py-1 rounded-md">{product.category}</span></td>
                              <td className="p-4 font-bold text-center text-slate-700">{variant.size}</td>
                              <td className="p-4 font-semibold text-right text-slate-600">{variant.price.toFixed(2)} €</td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => handleStockChange(variant.id, variant.stock, -1)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 w-6 h-6 rounded-lg font-bold flex items-center justify-center transition-colors">-</button>
                                  {/* Nota: Cambia el color si baja del umbral personalizado de ese producto */}
                                  <button onClick={() => handleBulkStock(variant.id, variant.stock)} className={`font-bold min-w-[32px] py-1 px-2 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-center ${variant.stock < (product.min_stock_alert || 5) ? 'text-red-600 bg-red-50' : 'text-slate-800 bg-slate-50'}`}>{variant.stock}</button>
                                  <button onClick={() => handleStockChange(variant.id, variant.stock, 1)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 w-6 h-6 rounded-lg font-bold flex items-center justify-center transition-colors">+</button>
                                </div>
                              </td>
                              <td className="p-4 text-center w-24 whitespace-nowrap">
                                <button onClick={() => setEditingItem({ productId: product.id, variantId: variant.id, name: product.name, category: product.category, description: product.description || '', image_url: product.image_url || '', min_stock_alert: product.min_stock_alert ?? 5, size: variant.size, price: variant.price })} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-purple-600 transition-all mr-3 text-sm" title="Editar">✏️</button>
                                <button onClick={() => handleDeleteVariant(variant.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-all text-sm" title="Eliminar">🗑️</button>
                              </td>
                            </tr>
                          ))
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL DE EDICIÓN FLOTANTE */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base">✏️ Editar Artículo</h3>
              <button onClick={() => setEditingItem(null)} className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 flex flex-col gap-4 text-xs">
              <div className="flex gap-4">
                <div className="w-2/3"><label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Nombre</label><input type="text" required value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-purple-600" /></div>
                <div className="w-1/3"><label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Categoría</label><input type="text" required value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-purple-600" /></div>
              </div>
              <div><label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Descripción</label><textarea value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-purple-600" rows={2} /></div>
              <div><label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">URL de la Imagen</label><input type="url" value={editingItem.image_url} onChange={e => setEditingItem({...editingItem, image_url: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-purple-600" /></div>
              <div><label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Avisar si stock baja de:</label><input type="number" required value={editingItem.min_stock_alert} onChange={e => setEditingItem({...editingItem, min_stock_alert: parseInt(e.target.value) || 5})} className="w-1/2 p-2.5 border border-slate-200 rounded-xl outline-none focus:border-purple-600" /></div>
              <div className="flex gap-4">
                <div className="w-1/2"><label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Talla</label><input type="text" required value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-purple-600" /></div>
                <div className="w-1/2"><label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Precio (€)</label><input type="number" step="0.50" required value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value)}
                )} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-purple-600" /></div>
              </div>
              <div className="mt-4 flex gap-3 justify-end">
                <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">Cancelar</button>
                <button type="submit" className="px-4 py-2 font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}