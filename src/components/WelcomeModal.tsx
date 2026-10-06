'use client';

import { useState, useEffect } from 'react';

export default function WelcomeModal() {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    // Detectamos si es la primera vez que entra
    const hasSeenModal = localStorage.getItem('scout_aviso_leido');
    if (!hasSeenModal) {
      setShowWelcomeModal(true);
    }
  }, []);

  const handleCloseModal = () => {
    localStorage.setItem('scout_aviso_leido', 'true');
    setShowWelcomeModal(false);
  };

  if (!showWelcomeModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-300">
        
        <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
          ⚠️
        </div>
        
        <h2 className="text-xl font-black text-slate-800 text-center uppercase tracking-wider mb-2">
          ¡Hola! Antes de empezar...
        </h2>
        
        <div className="text-sm text-slate-600 space-y-4 mb-8 text-center font-medium">
          <p>
            Esta plataforma sirve <strong>exclusivamente para reservar</strong> tu material de forma cómoda. En ningún momento se te va a pedir dinero ni tarjetas por internet.
          </p>
          <p>
            El pago se realizará en <strong>efectivo</strong> directamente en el local cuando vayas a recoger tu pedido.
          </p>
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-amber-800 text-xs">
            <strong>🗓️ Política de reservas:</strong> Dada la alta demanda, si tu pedido no es recogido y pagado en un plazo máximo de <strong>15 días</strong>, el sistema lo descartará automáticamente para cederle el turno a otro miembro del grupo.
          </div>
        </div>

        <button 
          onClick={handleCloseModal} 
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl transition-transform active:scale-95 shadow-md uppercase tracking-wider text-sm"
        >
          ¡Entendido, vamos a la tienda!
        </button>
        
      </div>
    </div>
  );
}