# MCP in AgenticDB

Research verified on November 14, 2026.

## Transport and compatibility

- The current MCP revision at the time of verification was `2026-07-28`. Streamable HTTP accepts one JSON-RPC message per POST to a single endpoint such as `/mcp`. It can return JSON or a request-scoped SSE stream. This revision removed transport sessions, `Mcp-Session-Id`, and the GET stream. JSON responses are sufficient for the synchronous queries in the first version. [Versioning](https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning) · [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- Implement `server/discover`, which is required for servers and optional for clients. Each request specifies the version in `_meta` and `MCP-Protocol-Version`. Verify the `Mcp-Method` and `Mcp-Name` headers where applicable, `Origin` validation, and responses to unsupported versions. Validate the chosen SDK and client before finalizing scope. Clients using revisions through `2025-11-25` may depend on the `initialize` handshake. Evaluate explicit stateless support for the older revision if clients require it. [Versioning](https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning) · [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- Expose published definitions through `tools/list` with a name, description, and JSON Schema `inputSchema`. Filter the list using the request's authorization and check access again in `tools/call`. Omit the change notification capability if the first version supports on-demand discovery only. [MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

## Authentication

- For the first pilot, use `Authorization: Bearer <token>` on each request from clients configured to send a token provisioned by AgenticDB. Test the configuration with the selected client and record the verified combinations. Clients that rely on OAuth discovery and sign-in require the corresponding server integration. [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- With MCP OAuth, AgenticDB acts as a resource server. It publishes protected resource metadata, identifies the authorization server, and checks that the token was issued for AgenticDB and permits the operation. Each database uses its own credentials or a compatible delegation mechanism. [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
