-- REPARACIÓN DE ACCESO A CÁMARAS
-- Copia este archivo COMPLETO en Supabase > SQL Editor y pulsa Run.
-- No agregues instrucciones de RLS dentro de los bloques AS $$ ... $$.

CREATE OR REPLACE FUNCTION public.has_active_camera_access(target_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.camera_access_grants
    WHERE request_id = target_request_id
      AND admin_id = auth.uid()
      AND expires_at > now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.configure_camera_device(
  target_request_id uuid,
  target_stream_url text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF target_stream_url IS NULL OR trim(target_stream_url) !~ '^https://' THEN
    RAISE EXCEPTION 'La transmisión debe utilizar HTTPS';
  END IF;

  INSERT INTO public.camera_devices (
    request_id,
    stream_url,
    configured_by,
    updated_at
  )
  VALUES (
    target_request_id,
    trim(target_stream_url),
    auth.uid(),
    now()
  )
  ON CONFLICT (request_id) DO UPDATE
  SET stream_url = EXCLUDED.stream_url,
      configured_by = auth.uid(),
      updated_at = now();

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_camera_access_code(
  target_request_id uuid,
  plain_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  matched_id bigint;
  matched_used_at timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT id, used_at
  INTO matched_id, matched_used_at
  FROM public.camera_access_codes
  WHERE request_id = target_request_id
    AND (
      display_code = trim(plain_code)
      OR code_hash = encode(
        extensions.digest(trim(plain_code), 'sha256'),
        'hex'
      )
    )
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF matched_id IS NULL THEN
    RETURN false;
  END IF;

  IF matched_used_at IS NOT NULL THEN
    RETURN public.has_active_camera_access(target_request_id);
  END IF;

  UPDATE public.camera_access_codes
  SET used_at = now(),
      display_code = NULL
  WHERE id = matched_id;

  DELETE FROM public.camera_access_grants
  WHERE request_id = target_request_id
    AND admin_id = auth.uid();

  INSERT INTO public.camera_access_grants (
    request_id,
    admin_id,
    expires_at
  )
  VALUES (
    target_request_id,
    auth.uid(),
    now() + interval '5 minutes'
  );

  RETURN true;
END;
$function$;

DROP POLICY IF EXISTS "Propietario o admin autorizado consulta cámara"
ON public.camera_devices;

CREATE POLICY "Propietario o admin autorizado consulta cámara"
ON public.camera_devices
FOR SELECT
TO authenticated
USING (
  public.owns_service_request(request_id)
  OR public.has_active_camera_access(request_id)
);

REVOKE ALL ON FUNCTION public.has_active_camera_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.configure_camera_device(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_camera_access_code(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_active_camera_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.configure_camera_device(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_camera_access_code(uuid, text) TO authenticated;
