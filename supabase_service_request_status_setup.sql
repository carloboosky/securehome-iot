-- Ejecuta este archivo en Supabase > SQL Editor.
-- Sincroniza la restricción de la base de datos con las opciones del dashboard.

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_status_check;

-- Convierte el nombre anterior, si existe, al nombre utilizado por el frontend.
UPDATE public.service_requests
SET status = 'installed'
WHERE status = 'completed';

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_status_check
  CHECK (
    status IN (
      'pending',
      'contacted',
      'scheduled',
      'installed',
      'cancelled'
    )
  );
