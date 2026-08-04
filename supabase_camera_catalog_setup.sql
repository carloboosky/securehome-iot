-- CATÁLOGO GLOBAL DE CÁMARAS
-- Ejecutar completo en Supabase SQL Editor con Role postgres.

CREATE TABLE IF NOT EXISTS public.camera_catalog (
  stream_url text PRIMARY KEY,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.camera_catalog ENABLE ROW LEVEL SECURITY;

INSERT INTO public.camera_catalog (stream_url, name)
SELECT DISTINCT stream_url, 'Cámara disponible'
FROM public.camera_devices
WHERE stream_url IS NOT NULL
ON CONFLICT (stream_url) DO NOTHING;

INSERT INTO public.camera_catalog (stream_url, name)
VALUES
  ('https://iot-security.pro/api/camera/stream', 'Cámara principal AWS'),
  ('https://iot-security.pro/api/camera/stream2', 'Cámara AWS 2'),
  ('https://192.168.1.101:8080/stream', 'Cámara IP 3'),
  ('https://192.168.1.102:8080/stream', 'Cámara IP 4'),
  ('https://10.0.0.25:8081/video', 'Cámara IP 5')
ON CONFLICT (stream_url) DO UPDATE SET name = EXCLUDED.name;

DROP FUNCTION IF EXISTS public.list_configured_cameras(uuid);

CREATE FUNCTION public.list_configured_cameras(target_request_id uuid)
RETURNS TABLE(stream_url text, name text, updated_at timestamptz, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $list_cameras$
  SELECT catalog.stream_url,
         COALESCE(catalog.name, 'Cámara disponible'),
         device.updated_at,
         COALESCE(device.is_active, false)
  FROM public.camera_catalog AS catalog
  LEFT JOIN public.camera_devices AS device
    ON device.stream_url = catalog.stream_url
   AND device.request_id = target_request_id
  WHERE public.is_admin()
  ORDER BY COALESCE(device.is_active, false) DESC,
           device.updated_at DESC NULLS LAST,
           catalog.created_at,
           catalog.stream_url;
$list_cameras$;

CREATE OR REPLACE FUNCTION public.save_camera_assignments(
  target_request_id uuid,
  active_stream_urls text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $save_cameras$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.camera_catalog (stream_url, name, created_by)
  SELECT DISTINCT trim(selected_url), 'Cámara disponible', auth.uid()
  FROM unnest(COALESCE(active_stream_urls, ARRAY[]::text[])) AS selected_url
  WHERE trim(selected_url) ~* '^https?://[^[:space:]]+$'
  ON CONFLICT (stream_url) DO NOTHING;

  UPDATE public.camera_devices
  SET is_active = false, configured_by = auth.uid(), updated_at = now()
  WHERE request_id = target_request_id;

  INSERT INTO public.camera_devices (request_id, stream_url, is_active, configured_by, updated_at)
  SELECT target_request_id, trim(selected_url), true, auth.uid(), now()
  FROM unnest(COALESCE(active_stream_urls, ARRAY[]::text[])) AS selected_url
  WHERE trim(selected_url) ~* '^https?://[^[:space:]]+$'
  ON CONFLICT (request_id, stream_url) DO UPDATE
  SET is_active = true, configured_by = auth.uid(), updated_at = now();

  RETURN true;
END;
$save_cameras$;

CREATE OR REPLACE FUNCTION public.delete_camera_from_catalog(target_stream_url text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $delete_camera$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.camera_devices WHERE stream_url = target_stream_url;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  DELETE FROM public.camera_catalog WHERE stream_url = target_stream_url;
  IF NOT FOUND AND deleted_count = 0 THEN
    RAISE EXCEPTION 'Dirección no encontrada';
  END IF;

  RETURN true;
END;
$delete_camera$;

REVOKE ALL ON FUNCTION public.list_configured_cameras(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_camera_assignments(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_camera_from_catalog(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_configured_cameras(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_camera_assignments(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_camera_from_catalog(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
