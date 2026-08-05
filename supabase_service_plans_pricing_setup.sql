ALTER TABLE public.service_plans
ADD COLUMN IF NOT EXISTS initial_price numeric(10,2),
ADD COLUMN IF NOT EXISTS monthly_price numeric(10,2),
ADD COLUMN IF NOT EXISTS minimum_months integer NOT NULL DEFAULT 4;

UPDATE public.service_plans
SET initial_price = CASE
      WHEN lower(name) = 'esencial' THEN 15
      WHEN lower(name) IN ('protección plus', 'proteccion plus') THEN 20
      WHEN lower(name) = 'total' THEN 25
      ELSE initial_price
    END,
    monthly_price = CASE
      WHEN lower(name) = 'esencial' THEN 3.50
      WHEN lower(name) IN ('protección plus', 'proteccion plus') THEN 4.50
      WHEN lower(name) = 'total' THEN 6
      ELSE monthly_price
    END,
    minimum_months = 4
WHERE lower(name) IN ('esencial', 'protección plus', 'proteccion plus', 'total');
