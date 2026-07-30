-- Ejecuta este archivo en Supabase > SQL Editor.
-- Devuelve al administrador la ficha del cliente sin datos de contraseña.

CREATE OR REPLACE FUNCTION public.get_client_registration_details(
  target_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  client_details jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'request_id', sr.id,
    'client_id', sr.client_id,
    'full_name', p.full_name,
    'phone', p.phone,
    'email', u.email,
    'plan_name', sp.name,
    'property_type', sr.property_type,
    'installation_address', sr.installation_address,
    'status', sr.status,
    'notes', sr.notes,
    'created_at', sr.created_at
  )
  INTO client_details
  FROM public.service_requests sr
  LEFT JOIN public.profiles p ON p.id = sr.client_id
  LEFT JOIN auth.users u ON u.id = sr.client_id
  LEFT JOIN public.service_plans sp ON sp.id = sr.plan_id
  WHERE sr.id = target_request_id;

  IF client_details IS NULL THEN
    RAISE EXCEPTION 'La solicitud no existe';
  END IF;

  RETURN client_details;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_client_registration_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_registration_details(uuid) TO authenticated;
