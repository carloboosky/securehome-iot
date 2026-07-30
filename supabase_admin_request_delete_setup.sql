-- Ejecuta este archivo en Supabase > SQL Editor.
-- Permite al administrador eliminar solicitudes seleccionadas.
-- Las relaciones ON DELETE CASCADE eliminan citas, chats y cámaras asociadas.
-- La cuenta y el perfil del usuario NO se eliminan.

CREATE OR REPLACE FUNCTION public.delete_service_requests(
  selected_request_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF selected_request_ids IS NULL
    OR cardinality(selected_request_ids) = 0
    OR cardinality(selected_request_ids) > 100 THEN
    RAISE EXCEPTION 'Selecciona entre 1 y 100 solicitudes';
  END IF;

  DELETE FROM public.service_requests
  WHERE id = ANY(selected_request_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_service_requests(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_service_requests(uuid[]) TO authenticated;
