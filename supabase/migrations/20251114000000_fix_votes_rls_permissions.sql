-- Corregir políticas RLS para permitir que cualquiera pueda insertar votos sin autenticación
-- Esto es necesario porque el sistema no requiere autenticación de usuarios para votar

-- Eliminar todas las políticas existentes de votes
DROP POLICY IF EXISTS "Anyone can insert votes" ON public.votes;
DROP POLICY IF EXISTS "Admins can view all votes" ON public.votes;
DROP POLICY IF EXISTS "Anyone can view their own votes" ON public.votes;
DROP POLICY IF EXISTS "Allow public vote insertion" ON public.votes;
DROP POLICY IF EXISTS "Allow public vote viewing" ON public.votes;

-- Crear política que permite a CUALQUIERA insertar votos (sin requerir autenticación)
-- Usar 'anon' role que es el rol por defecto para usuarios no autenticados
CREATE POLICY "Allow public vote insertion"
  ON public.votes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Crear política que permite a CUALQUIERA ver todos los votos (para estadísticas)
CREATE POLICY "Allow public vote viewing"
  ON public.votes FOR SELECT
  TO anon, authenticated
  USING (true);

-- Asegurar que RLS esté habilitado
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

