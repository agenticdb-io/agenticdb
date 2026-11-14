BEGIN;

CREATE TABLE public.customers (
    code text PRIMARY KEY,
    address text NOT NULL
);

INSERT INTO public.customers (code, address) VALUES
    ('C001', '101 Acacia Street'),
    ('C002', '202 Maple Avenue'),
    ('C003', '303 Palm Street');

CREATE ROLE agenticdb_reader LOGIN PASSWORD 'agenticdb_test';
GRANT CONNECT ON DATABASE agenticdb_test TO agenticdb_reader;
GRANT USAGE ON SCHEMA public TO agenticdb_reader;
GRANT SELECT ON public.customers TO agenticdb_reader;

COMMIT;
