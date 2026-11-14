# Database adapters

A query-target adapter owns a database driver's connection lifecycle, native commands, parameter binding, and result conversion. The execution module selects an adapter by the type stored on the data source. The Admin and MCP servers import the same execution package into their respective processes. The catalog retains its own storage interface.

## Adapter interface

Keep the first interface in `packages/execution/src/adapter.ts`. The following sketch describes the operations exposed to callers.

```ts
interface DatabaseAdapter {
  readonly kind: string;
  readonly displayName: string;
  readonly sourceSchema: JsonSchema;
  readonly commandSchema: JsonSchema;

  validateCommand(command: unknown, inputSchema: JsonSchema): void;
  connect(source: ResolvedSource, signal: AbortSignal): Promise<ReadConnection>;
}

interface ReadConnection {
  execute(request: ReadRequest): Promise<ReadResult>;
  close(): Promise<void>;
}
```

- A registry maps stable adapter kinds to implementations and rejects duplicate kinds at startup. A source stores its kind, validated configuration, and secret references. A revision stores the source ID and the adapter's native command configuration. Reject a source kind change while revisions reference it.
- The registry supplies JSON Schemas for the source and command forms. The admin application renders common fields and an editor for the native command. The server validates source settings and command configuration and checks argument bindings before publication. The browser receives secret references or field metadata appropriate to the operator's permissions.
- Each server authorizes the operation and resolves its revision before calling the shared execution module. The shared module validates input values, resolves secrets, and applies shared limits. Only the adapter receives resolved credentials. The same path applies to draft previews after administrative authorization.
- `ReadRequest` carries the validated command and arguments, row or document limits, a byte budget, and a deadline with a cancellation signal. The adapter enforces database-specific read restrictions, binds values through the driver, and fetches a bounded result. Cancel or stop fetching when a deadline or limit is reached. The execution module also enforces the final serialized response budget.
- `ReadResult` contains JSON-compatible records and a truncation flag. Return shared error categories such as invalid command, connection failure, and timeout. Keep driver diagnostics internal and exclude secrets and raw query text from client errors.
- `connect` returns a closable handle that an adapter can back with a pool. The server owns handle reuse and shutdown. Drain or invalidate handles when source settings or credentials change so later calls use the updated configuration.

Preserve native commands in each adapter. PostgreSQL can use a parameterized SQL query, MongoDB a [structured `find` or `findOne` operation](tool-definitions.md#mongodb-commands), and Cassandra a prepared CQL query. Each implementation documents its permitted operations and the database privileges needed to enforce read-only access.

## Contribute SQL Server support

1. Add `packages/execution/src/adapters/sql-server/` and implement the interface with a SQL Server driver. Define the source and command schemas locally and map declared arguments to typed driver parameters. Keep connection options, timeouts, cancellation, and SQL Server type conversion in that folder.
2. Register the adapter once in `packages/execution/src/adapters/index.ts` and declare its driver dependency in the execution package. The management editor gets its fields from the registered schema. The MCP route resolves tools through the same execution module.
3. Add a SQL Server fixture under `tests/sql-server/` and run the shared adapter contract tests against it. Document the source settings and database grants needed for a read-only account.
4. Verify that the operator can configure a source and publish a read tool and that an MCP client can invoke it using a scoped token.

The shared tests cover command validation, argument binding, denied writes with restricted database credentials, cancellation, bounded results, and cleanup. PostgreSQL is the reference implementation. Use MongoDB to test that the interface works for structured commands before treating it as stable for contributors.

The first release registers reviewed adapters at build time. If downstream maintainers need independent releases, a later milestone can extract and version the interface as an npm package and define how operators install trusted adapters.
