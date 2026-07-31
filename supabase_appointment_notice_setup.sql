-- Ejecuta este archivo en Supabase > SQL Editor.
-- Impide crear o reprogramar citas con menos de 2 horas de anticipación.

CREATE OR REPLACE FUNCTION public.enforce_appointment_minimum_notice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  appointment_moment timestamptz;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.appointment_date IS NOT DISTINCT FROM OLD.appointment_date
    AND NEW.appointment_time IS NOT DISTINCT FROM OLD.appointment_time THEN
    RETURN NEW;
  END IF;

  appointment_moment :=
    (NEW.appointment_date + NEW.appointment_time)
    AT TIME ZONE 'America/Guayaquil';

  IF appointment_moment < now() + interval '2 hours' THEN
    RAISE EXCEPTION 'La instalación requiere al menos 2 horas de anticipación';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS installation_appointment_minimum_notice
ON public.installation_appointments;

CREATE TRIGGER installation_appointment_minimum_notice
BEFORE INSERT OR UPDATE OF appointment_date, appointment_time
ON public.installation_appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_appointment_minimum_notice();
