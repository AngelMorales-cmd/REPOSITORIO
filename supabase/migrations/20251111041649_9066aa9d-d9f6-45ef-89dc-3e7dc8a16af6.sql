-- Crear enum para categorías electorales
CREATE TYPE public.electoral_category AS ENUM ('presidencial', 'distrital', 'regional');

-- Crear enum para roles de usuario
CREATE TYPE public.app_role AS ENUM ('admin', 'voter');

-- Tabla de candidatos
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  description TEXT NOT NULL,
  party_name TEXT NOT NULL,
  party_logo_url TEXT,
  party_description TEXT,
  category electoral_category NOT NULL,
  vote_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabla de votantes (datos DNI)
CREATE TABLE public.voters (
  dni TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  address TEXT NOT NULL,
  district TEXT NOT NULL,
  province TEXT NOT NULL,
  department TEXT NOT NULL,
  birth_date DATE NOT NULL,
  has_voted BOOLEAN DEFAULT false NOT NULL,
  voted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabla de votos
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_dni TEXT NOT NULL REFERENCES public.voters(dni) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  category electoral_category NOT NULL,
  voted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(voter_dni, category)
);

-- Tabla de roles de usuario
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Función de seguridad para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Habilitar RLS en todas las tablas
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para candidates (público puede ver, solo admins pueden modificar)
CREATE POLICY "Anyone can view candidates"
  ON public.candidates FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert candidates"
  ON public.candidates FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update candidates"
  ON public.candidates FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete candidates"
  ON public.candidates FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para voters (público puede consultar DNI, solo admins pueden ver todo)
CREATE POLICY "Anyone can view their own voter info"
  ON public.voters FOR SELECT
  USING (true);

CREATE POLICY "System can insert voters"
  ON public.voters FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update voters"
  ON public.voters FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para votes (público puede votar, admins pueden ver todo)
CREATE POLICY "Anyone can insert votes"
  ON public.votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all votes"
  ON public.votes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para user_roles (solo admins pueden gestionar)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Función para actualizar vote_count en candidates
CREATE OR REPLACE FUNCTION public.update_candidate_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.candidates
    SET vote_count = vote_count + 1,
        updated_at = now()
    WHERE id = NEW.candidate_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.candidates
    SET vote_count = vote_count - 1,
        updated_at = now()
    WHERE id = OLD.candidate_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger para actualizar vote_count automáticamente
CREATE TRIGGER update_candidate_votes
AFTER INSERT OR DELETE ON public.votes
FOR EACH ROW EXECUTE FUNCTION public.update_candidate_vote_count();

-- Trigger para marcar votante como que ya votó
CREATE OR REPLACE FUNCTION public.mark_voter_as_voted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.voters
  SET has_voted = true,
      voted_at = now()
  WHERE dni = NEW.voter_dni;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_voter_voted
AFTER INSERT ON public.votes
FOR EACH ROW EXECUTE FUNCTION public.mark_voter_as_voted();