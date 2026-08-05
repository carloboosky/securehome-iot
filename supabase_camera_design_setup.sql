CREATE TABLE IF NOT EXISTS public.camera_design_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.service_requests(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model text NOT NULL CHECK (model IN ('modular', 'house', 'spider', 'outlet', 'desktop')),
  color text NOT NULL CHECK (color IN ('white', 'black', 'gray', 'blue')),
  mount_type text NOT NULL CHECK (mount_type IN ('wall', 'ceiling', 'table', 'corner')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.camera_design_selections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.camera_design_selections
DROP CONSTRAINT IF EXISTS camera_design_selections_model_check;
ALTER TABLE public.camera_design_selections
ADD CONSTRAINT camera_design_selections_model_check
CHECK (model IN ('modular', 'house', 'spider', 'outlet', 'desktop'));

DROP POLICY IF EXISTS "Clientes gestionan su diseño" ON public.camera_design_selections;
CREATE POLICY "Clientes gestionan su diseño" ON public.camera_design_selections
FOR ALL TO authenticated
USING (client_id = auth.uid())
WITH CHECK (
  client_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.service_requests request WHERE request.id = request_id AND request.client_id = auth.uid())
);

DROP POLICY IF EXISTS "Administradores consultan diseños" ON public.camera_design_selections;
CREATE POLICY "Administradores consultan diseños" ON public.camera_design_selections
FOR SELECT TO authenticated
USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.camera_design_selections TO authenticated;
