-- Habilita en un solo paso las actualizaciones en tiempo real utilizadas por
-- el panel del cliente. Ejecutar en Supabase SQL Editor con rol postgres.

ALTER TABLE public.service_requests REPLICA IDENTITY FULL;
ALTER TABLE public.installation_appointments REPLICA IDENTITY FULL;
ALTER TABLE public.service_messages REPLICA IDENTITY FULL;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'service_requests',
    'installation_appointments',
    'service_messages'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target_table
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        target_table
      );
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
