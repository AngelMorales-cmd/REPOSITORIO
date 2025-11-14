import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Limpiar la URL para remover la barra final si existe
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') || '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const errorMsg = `
    ⚠️ ERROR: Variables de entorno de Supabase no configuradas
    
    Por favor, crea un archivo .env en la raíz del proyecto con:
    
    VITE_SUPABASE_URL=https://vwaohhelvhvzwoyrmhve.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YW9oaGVsdmh2endveXJtaHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwODE2NTYsImV4cCI6MjA3ODY1NzY1Nn0.0xxYH1xHnkMxyyKLKfaHalc_En7A03R-lYt44foh9o0
    
    Luego reinicia el servidor con: npm run dev
  `;
  console.error(errorMsg);
  throw new Error('Variables de entorno de Supabase no configuradas. Ver consola para más detalles.');
}

// Log para verificar que las variables están cargadas (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('✅ Supabase configurado:', {
    url: SUPABASE_URL || 'NO CONFIGURADO',
    hasKey: !!SUPABASE_PUBLISHABLE_KEY
  });
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});