# AgenticDB

AgenticDB lets teams publish read queries as typed tools for agents. Each tool has a name, description, input schema, data source, and versioned query. An agent discovers and calls authorized tools through MCP. The backend validates arguments, runs the query with the credentials configured for the data source, and returns a bounded result.

## First delivery

Start with an end-to-end PostgreSQL workflow. An operator registers a data source, creates and tests a draft, publishes a revision, and issues a token scoped to the tool. The agent discovers and calls the published revision over MCP Streamable HTTP. SQLite stores local metadata.

Add MongoDB and Cassandra as adapters. Add AI-assisted editing once validation, preview, and publishing are available so the assistant can use the same review workflow. If the first external release requires all three databases, include both adapter tasks in the release milestone.

See the [project architecture](architecture.md) for the proposed workspace, build sequence, and distribution.

## Product components

| Component | Responsibility |
| --- | --- |
| MCP server | Load the published snapshot at startup, authenticate the token, list authorized tools, validate arguments, and execute the published revision. |
| Admin server | Manage data sources, tools, revisions, publications, and tokens. Authenticate and authorize administrative operations, including previews. |
| Management frontend | Edit tools and parameters, test drafts, compare revisions, publish or restore a revision, compare and deploy to destination environments, and manage access. |
| Editor assistant | Propose structured draft changes based on the operator's request and authorized schema metadata. The operator reviews the diff before applying it, then uses the standard workflow to test and publish. |

The [separate MCP server](mcp-runtime.md) runs from a startup snapshot of the published catalog. Its endpoint uses Streamable HTTP without requiring in-memory sessions across requests. The backend can start as a conventional HTTP service. A later serverless deployment would require testing connectivity and connection pooling for each database. See the [MCP notes](mcp.md).

## Tool contract

See [data sources and tool definitions](tool-definitions.md) for the Admin source registry, operators, and native argument binding.

A tool has a stable identifier and a unique MCP name. Each revision records a description, JSON Schema input definition, data source reference, native adapter command, argument bindings, and execution limits. The MCP catalog exposes the published revision's name, description, and input schema. Commands and credentials stay on the backend.

Example PostgreSQL revision

```yaml
name: get_customer_address
description: Looks up a customer's address by customer code.
inputSchema:
  type: object
  properties:
    customer_code:
      type: string
  required: [customer_code]
  additionalProperties: false
sourceRef: customer_test
command:
  sql: SELECT address FROM public.customers WHERE code = $1
  bindings: [customer_code]
limits:
  maxRows: 50
  timeoutMs: 2000
```

The driver receives `customer_code` as a bound parameter. The revision defines table, column, and collection names and operators. MongoDB uses a structured read configuration with argument values inserted as data at declared positions. Cassandra uses a prepared CQL query. Each adapter defines its accepted commands and validates the configuration before publication. The example query runs against the [PostgreSQL test fixture](../tests/postgres/README.md).

The first version returns JSON records and indicates truncation. The backend limits query duration, rows or documents, and response bytes. It normalizes driver-specific types. Errors returned to agents omit queries, credentials, and internal connection details.

## Publishing and persistence

- Each tool has a working draft and immutable revisions. Each environment stores its own active revision pointer. Publishing and rollback update the pointer atomically and record deployment history. Exports preserve tool and revision IDs so environments can compare and promote the same versions. The [deployment design](deployments.md) covers Admin and CI workflows.
- Each execution resolves a revision and keeps that identifier for the duration of the call, including when a publication happens concurrently. Input schema changes may require the MCP client to refresh its catalog. Publish incompatible changes under a new name when both contracts need to coexist.
- Execution tokens support per-tool grants, expiration, and revocation. A grant follows the published pointer by default, including after restoration. The history records who published each revision.
- SQLite stores data sources, tools, revisions, grants, and administrative events. Data source credentials use secret references. The management interface displays an execution token at issuance and the backend stores its hash.
- Version migrations and keep persistence operations behind the backend's storage interfaces. When moving the catalog to PostgreSQL, run the same persistence tests and verify the transfer of identifiers, revisions, pointers, and grants.

## Access model

Admin users authenticate against accounts stored in the local metadata catalog. The first release ships with an administrator role. The server checks granular permissions to support viewer, editor, and deployment roles as they are introduced. See the [Admin access design](admin-access.md).

An MCP token identifies a consumer and scopes the tools it can discover and call. Queries run under the identity configured for the data source. The database enforces the permissions, views, and policies that apply to that identity. A shared credential gives all consumers of that data source the same database access context.

Execution relies on database read permissions and adapter-specific validation. PostgreSQL uses a least-privilege credential and a read-only transaction, with access scoped to approved resources. Review the functions and extensions available to that credential. For MongoDB and Cassandra, restrict adapter operations and grant only the required read permissions.

For per-user database identity, OAuth identifies and authorizes the consumer in AgenticDB. A separate mapping propagates that identity to each database through mechanisms such as individual credentials or roles with verified user context. Before releasing that feature, verify with two users that the same command respects the database's access policies, including when the connection pool reuses a connection.

## Open decisions

- Which MCP clients the first release must support and which accept a manually configured bearer token.
- Which schema metadata the assistant may inspect and share with the AI provider. The initial proposal gives the assistant authorized schema metadata and excludes production rows and secrets.
- Which data sources and tools will be used in the pilot and whether the first external release requires all three connectors.
