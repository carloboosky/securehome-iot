-- VALIDACIÓN DE CÓDIGO TEMPORAL DE CÁMARA
-- Ejecutar completo en Supabase SQL Editor con Role postgres.

CREATE OR REPLACE FUNCTION public.request_camera_access(target_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $request_code$
DECLARE
  generated_code text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.camera_access_codes
    WHERE request_id = target_request_id
      AND used_at IS NULL
      AND display_code IS NOT NULL
      AND expires_at > now()
  ) THEN
    UPDATE public.camera_access_codes
    SET expires_at = now() + interval '5 minutes',
        created_at = now()
    WHERE id = (
      SELECT id
      FROM public.camera_access_codes
      WHERE request_id = target_request_id
        AND used_at IS NULL
        AND display_code IS NOT NULL
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
    );
    RETURN true;
  END IF;

  generated_code := lpad(floor(random() * 1000000)::int::text, 6, '0');

  UPDATE public.camera_access_codes
  SET used_at = now(), display_code = NULL
  WHERE request_id = target_request_id
    AND used_at IS NULL;

  INSERT INTO public.camera_access_codes (request_id, code_hash, display_code, expires_at)
  VALUES (
    target_request_id,
    encode(extensions.digest(generated_code, 'sha256'), 'hex'),
    generated_code,
    now() + interval '5 minutes'
  );

  RETURN true;
END;
$request_code$;

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
REVOKE ALL ON FUNCTION public.request_camera_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_camera_access_code(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_camera_access(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
