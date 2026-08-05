-- Permisos mínimos para el servidor MCP de solo lectura.
-- Ejecutar con el rol postgres desde Supabase SQL Editor.

GRANT USAGE ON SCHEMA public TO service_role;

DO $permissions$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'service_requests',
    'profiles',
    'service_plans',
    'camera_devices',
    'residents',
    'pets',
    'camera_design_selections'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', table_name);
    END IF;
  END LOOP;
END;
$permissions$;

NOTIFY pgrst, 'reload schema';
