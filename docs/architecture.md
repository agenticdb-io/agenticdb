# AgenticDB project structure

## Repository layout

This repository contains the AgenticDB product source, shared packages, test fixtures, and technical documentation tied to the code. The public website lives in a dedicated repository with its own deployment. Use a pnpm workspace at the product repository root so the applications and shared packages have one lockfile and can build together. [pnpm workspaces](https://pnpm.io/workspaces/)

```text
agenticdb/
├── apps/
│   ├── admin-server/    # Management HTTP, catalog, roles, and deployments
│   ├── mcp-server/      # MCP transport, snapshot loader, and token checks
│   └── admin/           # React and Vite management application
├── packages/
│   └── execution/       # Query validation, limits, and adapter registry
│       └── src/adapters/
├── tests/                # Database fixtures and cross-app integration tests
│   ├── postgres/
│   ├── mongodb/
│   └── cassandra/
├── docs/
├── Dockerfile            # Build and package the self-hosted product
├── package.json
└── pnpm-workspace.yaml
```

## Stack and application boundaries

- **Admin server.** TypeScript on Node.js with Fastify. Owns the SQLite catalog, management routes, role checks, and runtime snapshot publication. Serves the compiled React application under `/admin/`.
- **MCP server.** A separate Node.js process serving `/mcp` over Streamable HTTP. It loads the published catalog snapshot at startup and checks MCP credentials locally. Verify SDK support for the target protocol revision and client. [MCP notes](mcp.md) · [Runtime design](mcp-runtime.md)
- **Admin app.** React, TypeScript, and Vite. During development, Vite proxies management requests to Admin. In the release build, the browser app and `/api/admin/` share the Admin origin.
- **API contracts.** Start with runtime validation for management requests and tool arguments. Add a shared TypeScript package only if the apps need to import the same public contracts. Browser imports may include request and response schemas. Drivers, credentials, and query execution stay on the server.
- **Metadata storage.** Store tools, revisions, publications, and token grants in SQLite on a persistent volume for a single-instance install. Use versioned migrations and define storage methods around the required operations, especially atomic publication and restoration. Add a PostgreSQL metadata adapter and a migration command when operators need a shared catalog across replicas.
- **Query targets.** The PostgreSQL customer database is the first data source. Target databases hold the customer's data and have their own credentials. The metadata catalog tracks how to reach those databases and which tools are published. Add MongoDB and Cassandra executors after the PostgreSQL path works end to end.

## Database adapter contributions

The server resolves a registered adapter by the data source's kind. Each driver lives in its own folder under `packages/execution/src/adapters/`. Contributors add an implementation, register it once, and supply database-specific tests. The adapter provides the source and command schemas used by the admin editor. MCP, publishing, and authorization use the shared execution flow. See the [adapter interface and SQL Server contribution walkthrough](database-adapters.md).

## Admin access

Local Admin users, role assignments, and sessions live in the metadata catalog. Management operations check permissions on the server. The first release ships with an administrator role and an operation-level permission model for later roles. See the [Admin access design](admin-access.md).

## Environment deployments

Each AgenticDB installation owns its catalog and active revision pointers. The deployment module exports immutable revisions, compares them with a configured destination, and activates approved versions through the destination management API. The Admin UI and CI use the same operations. See the [deployment design](deployments.md).

## Release and installation

| Channel | Role | First release requirements |
| --- | --- | --- |
| Container image | Primary self-hosted distribution | Publish a version-tagged image to GHCR for Linux AMD64 and ARM64. Package Admin and MCP as separate commands in one image with a two-container Compose example. Run as a non-root user and document persistent storage, secret references, and network configuration. Use semantic version tags and test starting and upgrading a release with an existing catalog. |
| npm CLI | Later option for Node.js users and local demos | Package a CLI that starts either server and bundles the Admin assets. Confirm package name availability and supported Node.js versions. Test the packed tarball in a clean directory before publishing, including asset loading, migrations, and clean shutdown. |
| Source checkout | Contributor workflow | Document installation and local commands to run both servers, the admin app, and PostgreSQL fixture. CI runs type checks, the production build, and PostgreSQL integration checks. |

Docker builds can publish both architectures under the same version tag. [Docker multi-platform builds](https://docs.docker.com/build/building/multi-platform/)

The product image connects to an external target database. For a local demo, use the [PostgreSQL fixture](../tests/postgres/README.md) and wire the two containers to a shared network. The fixture publishes a loopback port for host-based development. From another container, use the database service name and its internal port on the shared network.

Before the first public tag, select and add the project's license, document initial admin setup and backups, and verify installation from the published image. For upgrades, document how to back up the catalog before running migrations.

## Build sequence

1. **Bootstrap the workspace.** Add the Admin server, MCP server, and React packages, a pinned Node.js and pnpm toolchain, scripts for development and build, and a server health endpoint. Confirm that a clean install starts both apps locally and that the production server serves the admin bundle.
2. **Prove one vertical workflow.** Use `get_customer_address` with the existing fixture. Implement the SQLite catalog, read-only PostgreSQL execution, publication, and one scoped bearer token. Verify discovery and a successful call for `C001` through the selected MCP client. Cover denied writes, invalid arguments, and revoked tokens.
3. **Expose the workflow in React.** Add the tool editor, preview, revision history, publication, and token management. Run the same customer lookup through the admin workflow and MCP.
4. **Prove environment promotion.** Run two installations and promote the customer lookup revision through the management API and the Admin deployment screen. Verify the same promotion from CI.
5. **Release a self-hosted build.** Add the Docker build and release workflow, then verify persistence across container replacement and upgrade. Document a quickstart that takes a new operator from first launch to the sample MCP call.
6. **Expand the product.** Deliver MongoDB and Cassandra, AI-assisted editing, PostgreSQL metadata storage, or npm distribution according to operator demand. The [backlog](backlog.md) tracks adapter, editor, and metadata work.
