# PostgreSQL test fixture

Start the local database from the repository root.

```sh
docker compose -f tests/postgres/compose.yaml up -d --wait
```

Use the local read-only connection string `postgresql://agenticdb_reader:agenticdb_test@127.0.0.1:15432/agenticdb_test`.

Run the sample query with the client inside the container.

```sh
docker compose -f tests/postgres/compose.yaml exec -T -e PGPASSWORD=agenticdb_test postgres psql -h 127.0.0.1 -U agenticdb_reader -d agenticdb_test -c "SELECT address FROM public.customers WHERE code = 'C001';"
```

The expected result is `101 Acacia Street`. In AgenticDB, bind the customer code to the `$1` parameter.

The official image runs the initialization script when the data volume is empty. The volume retains data across restarts. If you initialized the fixture before the schema was translated, recreate the local test volume to load the English schema and sample data. Running the stop command below with `--volumes` deletes that volume and its data. Start the service again afterward.

Stop the service with the following command.

```sh
docker compose -f tests/postgres/compose.yaml down
```
