CREATE OR REPLACE FUNCTION public.redeem_camera_access_code(
  target_request_id uuid,
  plain_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  matched_id bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT id
  INTO matched_id
  FROM public.camera_access_codes
  WHERE request_id = target_request_id
    AND (
      display_code = trim(plain_code)
      OR code_hash = encode(
        extensions.digest(trim(plain_code), 'sha256'),
        'hex'
      )
    )
    AND used_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF matched_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.camera_access_codes
 