# AgenticDB backlog

Tasks are listed in delivery order. Dependencies indicate which contracts or features must be available before integration. The [proposal](proposal.md) describes product behavior, and the [MCP notes](mcp.md) record transport and authentication decisions.

## Milestone 1 · Serve the first PostgreSQL tool

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| ADB-01 | Define the tool and execution contract | — | Document JSON Schema, logical data source references, native commands and operators, argument bindings, limits, and the response format. See [tool definitions](tool-definitions.md). Validate a sample revision and reject arguments that violate its schema. |
| ADB-02 | Build the SQLite catalog | ADB-01 | Migrations create data sources, tools, revisions, publications, grants, users, role assignments, sessions, and events. The catalog survives process restarts. Tool and revision IDs are globally unique. Active pointers are scoped by environment and tool. Activation and restoration update pointers and history atomically. |
| ADB-03 | Implement the adapter interface and reference PostgreSQL adapter | ADB-01 | Register PostgreSQL through the [adapter interface](database-adapters.md). A real query uses driver-bound parameters and a restricted credential. PostgreSQL tests cover injection payloads, denied writes, denied access to unapproved resources, timeouts, and row and byte limits. |
| ADB-23 | Implement local Admin authentication | ADB-02 | Bootstrap the initial administrator into SQLite, hash passwords, and support login, logout, session expiration, user disabling, and account recovery. Permission changes and account disabling take effect on the next request. See the [Admin access design](admin-access.md). |
| ADB-28 | Model target environments and query variables | ADB-01, ADB-02, ADB-03 | Configure development and production targets for one logical source. Bind a caller argument and a typed source variable in one query. Verify environment-specific results, rejection of missing or wrongly typed variables, and caller isolation from target selection. See [data source environments](tool-definitions.md#data-source-environments-and-query-variables). |
| ADB-29 | Resolve optional arguments and evaluate restricted JavaScript expressions | ADB-01, ADB-28 | Required arguments reject omission. Optional arguments distinguish omission from null and use the configured omission policy. Combine caller arguments, source variables, and `dateTimeNow()` in one tool. With an injected clock, verify the same UTC instant is used across bindings within one invocation and verify native timestamp binding. Parse and interpret the allowed JavaScript syntax. Test rejection of arbitrary code, global and property access, unsupported calls, incompatible types, and expressions over the complexity limits. See [computed values](tool-definitions.md#required-optional-and-computed-values). |
| ADB-04 | Implement the management API and publishing workflow | ADB-02, ADB-03, ADB-23 | An authenticated administrator can register data sources using secret references, create drafts, run previews, publish revisions, and restore earlier revisions. Preview uses the same execution controls. Calls concurrent with publication resolve one complete revision. |
| ADB-05 | Issue and revoke execution tokens | ADB-02, ADB-04 | An administrator can issue tool-scoped tokens, set expiration, and revoke access. The API reveals each token once and stores its hash. Expiration is checked on each MCP request. Revocation takes effect when the updated snapshot is loaded. Execution tokens are denied access to the management API. |
| ADB-25 | Publish and load MCP runtime snapshots | ADB-02, ADB-05 | Admin publishes an environment-scoped snapshot. MCP starts with the snapshot mounted read-only and serves discovery and execution with Admin and the catalog offline. Restart loads a new generation. Invalid snapshots fail readiness, and an integration test verifies token revocation after rollout. See the [runtime design](mcp-runtime.md). |
| ADB-06 | Expose tools over MCP Streamable HTTP | ADB-01, ADB-03, ADB-25 | Confirm library support for the selected revision. The target client completes discovery and invocation using a bearer token. Listing and direct invocation enforce the same grants even when the clients switch between instances serving the same generation. Two instances handle requests without session affinity. |
| ADB-26 | Trace MCP tool calls and correlate structured logs | ADB-06 | Each tool call creates an OpenTelemetry span and a completion log with trace and span IDs, optional caller session ID, tool and revision, duration, outcome, and sanitized arguments. Test a successful call, an execution error, a call without a session ID, and configured argument capture with a sensitive argument excluded. |
| ADB-27 | Export MCP metrics and traces over OTLP | ADB-26 | A configured external Collector or compatible backend receives invocation counts, latency, and traces. Metrics group by bounded attributes and exclude session IDs and arguments. Test export disabled, successful export, and receiver unavailable while tool calls continue. |
| ADB-07 | Complete the end-to-end pilot | ADB-06, ADB-26, ADB-27, ADB-29 | A script reproduces registration, preview, publication, discovery, invocation, restoration, and revocation using a PostgreSQL test source. Verify structured execution logs and received telemetry as defined in ADB-26 and ADB-27. |

**Deliverable** · A working management API and an MCP client that invokes a published PostgreSQL tool.

## Milestone 2 · Operate through the frontend

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| ADB-08 | Build the tool editor and data source management | ADB-04, ADB-29 | An authorized operator can create, edit, and test catalog data sources with secret references, target environments, and query variables. The tool editor selects a logical source, defines typed arguments and a native command with explicit bindings, saves a draft, and previews it with sample data. Errors identify the fields that need correction. |
| ADB-09 | Build the history and publishing screens | ADB-08 | An operator can compare revisions, identify the draft and active revision, and confirm publication or restoration. The history shows the author and date of each operation. |
| ADB-10 | Build the access management screen | ADB-05 | An operator can associate tools with a token, set its expiration, copy the issued token, and revoke access. The screen explains how to connect the client verified in the pilot. |

**Deliverable** · An operator can complete the pilot workflow through the web interface.

## Milestone 3 · Add database adapters and AI-assisted editing

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| ADB-11 | Implement the MongoDB adapter | ADB-03, ADB-08 | Register MongoDB and pass the shared adapter contract tests. `find`, `findOne`, and read-only `aggregate` use structured filters with argument and environment-variable bindings through MCP and the schema-driven editor. Verify empty and single-document results for `findOne` and bounded cursor reads for `find` and `aggregate`. Verify grouping with bound values and reject `$out` and `$merge`. See [MongoDB commands](tool-definitions.md#mongodb-commands). The runtime validates filter structure, prevents arguments from injecting operators, and rejects write operations. Tests use a MongoDB read-only user and verify timeouts and limits. |
| ADB-12 | Implement the Cassandra adapter | ADB-03, ADB-08 | Register Cassandra and pass the shared adapter contract tests. A tool using a prepared CQL SELECT works through MCP and the schema-driven editor. Cassandra tests use a read-only role and verify denied writes, bounded pagination, and queries that follow the pilot table's key. |
| ADB-13 | Add the assistant to the editor | ADB-08, ADB-09 | An operator describes a tool and sees a validated suggestion with a reviewable diff. Applying it requires confirmation and updates the draft. Preview and publication use the existing management workflow. The provider receives only configured schema metadata. |

ADB-11, ADB-12, and ADB-13 can proceed in parallel once their dependencies are ready.

## Release milestone · Promote tools between environments

See the [deployment design](deployments.md).

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| ADB-19 | Export and import immutable revisions | ADB-02, ADB-04 | A versioned bundle round-trips selected revisions between two installations with IDs and digests preserved. Reimport is idempotent, conflicting IDs fail, and active pointers and destination access grants are preserved. |
| ADB-20 | Compare and deploy revisions through the management API | ADB-19, ADB-28 | Compare by tool ID against active destination revisions and report field changes, name collisions, missing bindings, and variable validation failures. Apply the reviewed plan atomically, reject stale state, audit activation, and roll back to an earlier revision. |
| ADB-21 | Add the Admin deployment module | ADB-09, ADB-20 | An administrator can configure a destination, choose revisions, review the diff, apply deployment, and inspect destination history. File export and import work for disconnected installations. |
| ADB-22 | Automate deployment from CI | ADB-20 | A pipeline exports a versioned artifact, produces a machine-readable destination plan, applies it with a scoped automation credential, and verifies the active MCP revision. Invalid, unauthorized, and stale plans fail the job. |

## Contributor extension check

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| ADB-18 | Verify the contributor path for a new database | ADB-11 | Follow the adapter guide and verify that a new database kind can be integrated through its adapter folder, one registry entry, a driver dependency, and a fixture. The same admin and MCP routes discover and execute the new tool. Document any gaps found in the interface. |

## After the pilot

| ID | Task | Acceptance criteria |
| --- | --- | --- |
| ADB-24 | Add viewer, tool editor, and deployment operator roles | Assign roles to local users. Verify through direct API calls that a viewer cannot edit, an editor cannot activate revisions, and a deployment operator cannot manage users or credentials. Verify authorization independently at the destination. |
| ADB-14 | Move the catalog to PostgreSQL | The persistence suite passes against both databases. A migration rehearsal preserves tools, revisions, execution grants, revocation status, publications, and history. |
| ADB-15 | Adopt OAuth for MCP clients | Validate authorization discovery and the OAuth flow in the selected clients. Test token audience, expiration, and scopes for discovery and execution. |
| ADB-16 | Propagate per-user identity to the database | Define the approach for each adapter. In PostgreSQL, show that two users see different results under database policy and that a reused connection applies the correct identity to each call. |
| ADB-17 | Validate serverless or replicated deployment | With the catalog and secrets accessible to the runtime, validate concurrency, connection reuse, database limits, observability, and revocation under load. |

## Next step

Select the PostgreSQL source and MCP client for the pilot and start ADB-01. Use a query that takes at least one argument and returns a small set of approved records.
