-- VALIDACIÓN DE CÓDIGO TEMPORAL DE CÁMARA
-- Ejecutar completo en Supabase SQL Editor con Role postgres.

CREATE OR REPLACE FUNCTION public.redeem_camera_access_code(
  target_request_id uuid,
  plain_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $redeem_code$
DECLARE
  matched_id bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF trim(COALESCE(plain_code, '')) !~ '^[0-9]{6}$' THEN
    RETURN false;
  END IF;

  SELECT code.id
  INTO matched_id
  FROM public.camera_access_codes AS code
  WHERE code.request_id = target_request_id
    AND code.display_code = trim(plain_code)
    AND code.used_at IS NULL
    AND code.expires_at > now()
  ORDER BY code.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF matched_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.camera_access_codes
  SET used_at = now(), display_code = NULL
  WHERE id = matched_id;

  DELETE FROM public.camera_access_grants
  WHERE request_id = target_request_id
    AND admin_id = auth.uid();

  INSERT INTO public.camera_access_grants (request_id, admin_id, expires_at)
  VALUES (target_request_id, auth.uid(), now() + interval '5 minutes');

  RETURN true;
END;
$redeem_code$;

REVOKE ALL ON FUNCTION public.redeem_camera_access_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_camera_access_code(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
