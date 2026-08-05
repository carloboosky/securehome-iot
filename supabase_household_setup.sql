-- Residentes y mascotas vinculados a cada solicitud de SecureHome.
CREATE TABLE IF NOT EXISTS public.residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 80),
  role text NOT NULL DEFAULT 'Familiar' CHECK (char_length(trim(role)) BETWEEN 2 AND 40),
  is_at_home boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  type text NOT NULL CHECK (type IN ('Perro', 'Gato', 'Ave', 'Otro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS residents_request_id_idx ON public.residents(request_id);
CREATE INDEX IF NOT EXISTS pets_request_id_idx ON public.pets(request_id);

ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clientes gestionan sus residentes" ON public.residents;
CREATE POLICY "Clientes gestionan sus residentes" ON public.residents
FOR ALL TO authenticated
USING (client_id = auth.uid())
WITH CHECK (
  client_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.service_requests request WHERE request.id = request_id AND request.client_id = auth.uid())
);

DROP POLICY IF EXISTS "Administradores consultan residentes" ON public.residents;
CREATE POLICY "Administradores consultan residentes" ON public.residents
FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Clientes gestionan sus mascotas" ON public.pets;
CREATE POLICY "Clientes gestionan sus mascotas" ON public.pets
FOR ALL TO authenticated
USING (client_id = auth.uid())
WITH CHECK (
  client_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.service_requests request WHERE request.id = request_id AND request.client_id = auth.uid())
);

DROP POLICY IF EXISTS "Administradores consultan mascotas" ON public.pets;
CREATE POLICY "Administradores consultan mascotas" ON public.pets
FOR SELECT TO authenticated USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.residents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pets TO authenticated;

NOTIFY pgrst, 'reload schema';
