# Administration and MCP runtime

Run the Admin server and MCP server as separate processes. Each can use its own port, network exposure, and credentials. The Admin server serves the React application and management API. It owns the SQLite catalog, user accounts, sessions, roles, drafts, deployments, and credential issuance. The MCP server serves Streamable HTTP, authenticates MCP consumers, and executes published read-only tools.

## Startup and execution

The Admin server exports a runtime snapshot from the committed catalog state for one environment. At startup, the MCP server loads this published view of the catalog from a read-only local path. The snapshot carries its format version, generation, environment ID, active tool and revision IDs, schemas, commands, execution limits, data source settings, resolved target environment variable values or secret references, and MCP token hashes, scopes, and expiration. It contains only the data needed by MCP. Admin accounts, sessions, roles, deployment credentials, and drafts remain in the Admin catalog.

The MCP server validates the snapshot and builds an in-memory tool and access index before becoming ready. Missing, invalid, or incompatible snapshots keep a new instance out of readiness. An explicitly empty snapshot can represent an environment with zero published tools. The MCP process can operate after startup while the Admin server and SQLite catalog are offline. It resolves source credentials using the runtime's own secret access and connects directly to target databases.

Both servers use the shared execution library and adapter registry. The Admin server uses them for authorized draft previews. The MCP server uses them for published tools and applies the runtime's token grants for discovery and invocation. Expiration is checked at request time. Each instance serves a specific snapshot generation and reports that generation through internal readiness or deployment telemetry.

## Publication and rollout

1. The Admin server commits the active pointers, MCP access changes, or source changes to the catalog and records the pending snapshot generation in the same transaction.
2. A manifest writer produces the corresponding immutable snapshot from consistent catalog state and publishes it atomically to the environment's runtime path. If publication fails, the previous artifact stays available and the pending generation can be retried. On a single host, use an atomic file replacement on a shared volume mounted read-only by MCP.
3. In the first release, restart or roll the MCP instances to load the new generation. Existing instances continue serving their loaded generation until replaced. The Admin UI and CI can distinguish catalog commit, snapshot publication, and runtime rollout. Verify the expected generation on all serving instances before reporting rollout complete.
4. Rollback creates a new generation containing the restored tool revision and current access configuration.

Token revocation and scope changes take effect on each MCP instance when it loads the updated generation. To enforce an urgent revocation, replace or stop every instance still serving the old generation. Token expiration continues to work locally while the Admin server is offline.

The first Docker release can use one versioned image with separate Admin and MCP commands and a Compose example that runs both containers. Mount the catalog only into Admin, and share only the snapshot location with MCP. Configure target database access for MCP and separately for Admin where draft previews are enabled.

## Observability

Create an OpenTelemetry span for each MCP tool invocation. Record the tool and revision identifiers when known, duration, and a bounded outcome such as success, validation failure, timeout, or execution error. Continue valid incoming W3C trace context when present. Emit a structured completion log with the span's trace and span IDs so operators can find the log for the execution.

Accept an optional caller correlation ID in the proposed `X-AgenticDB-Session-Id` HTTP header. Validate its length and format and attach it to the execution log and span. Use it only for correlation. Authentication and tool execution remain independent of this header and the runtime keeps no MCP transport session.

Record supplied argument names subject to redaction. For each deployment, allow explicit opt-in to capture selected argument values in logs and sampled spans. Capture only validated values, apply size limits, and omit secrets, credentials, and returned records. Keep argument values and session IDs out of metric attributes. Record invocation counts by outcome and adapter kind, plus a duration histogram using bounded attributes. [OpenTelemetry metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)

Configure OTLP trace and metric export independently on the MCP process. When enabled, send telemetry asynchronously to the configured OpenTelemetry Collector or compatible OTLP receiver. Use bounded buffering and export timeouts so a slow or unavailable receiver leaves query execution available. Verify the configuration with a test receiver before the first pilot. [OpenTelemetry JavaScript exporters](https://opentelemetry.io/docs/languages/js/exporters/)
