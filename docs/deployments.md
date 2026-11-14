# Tool deployments

Run development and production as separate AgenticDB installations, each with its own catalog and target database credentials. An installation is an environment with a stable environment ID. Its catalog is authoritative for the revisions active in that environment. The Admin deployment module can connect to another installation through its authenticated management API.

## Catalog identity and history

| Record | Identity and lifecycle |
| --- | --- |
| Tool | The origin assigns a globally unique tool ID. Export and import preserve it. The MCP name is distinct from the ID. A name collision with a different tool ID is an explicit conflict. |
| Revision | The origin assigns a globally unique revision ID when it seals the draft. Published and imported revisions are immutable. Preserve the revision ID, tool ID, content digest, and parent revision ID when importing. Parent IDs may refer to revisions outside a selected export. Local display numbers are optional and play no part in matching revisions. |
| Source binding | A stable logical source key belongs to the tool definition. Each AgenticDB environment maps that key to a local data source target environment with connection settings, typed query variables, and secret references. Export preserves required variable declarations and bindings. See [data source environments](tool-definitions.md#data-source-environments-and-query-variables). An adapter kind mismatch or missing mapping blocks activation. |
| Active revision | A unique pointer per environment and tool identifies the revision MCP can serve. Drafts and imported revisions become active only through an explicit deployment. An empty pointer means the tool is inactive. |
| Deployment | The destination records the environment, actor, timestamp, previous and new active revisions, and artifact digest. Rollback is a new deployment of a prior revision. |

Editing a deployed tool starts from a draft and creates a new immutable revision when sealed. The digest covers the canonical, versioned revision payload, including input schema, native command, and logical source key. For a repeated revision ID, identical content is an idempotent import. Different content is rejected. Integrity digests detect mismatches. Authorization to import or deploy comes from the destination.

## Export, compare, and deploy

1. **Export.** Select one or more sealed tool revisions and export a versioned JSON bundle with stable tool and revision IDs, parent IDs, content digests, and the required logical source keys and adapter kinds. Exclude credentials, tokens, connection settings, and environment-specific bindings. Treat command definitions as sensitive and keep literals containing secrets out of tool definitions.
2. **Compare.** Choose a configured destination or supply one to CI. Match by tool ID and compare the selected revision with the destination's active revision. Show tools missing from the destination, unchanged definitions, changed definitions with field-level diffs, identity conflicts, and binding or adapter problems. Flag changes to the MCP name or input contract for operator review. A tool outside the selected bundle remains outside the deployment.
3. **Import.** The destination validates the bundle format, digests, IDs, and command definitions, then stores the revisions. This operation can be used independently to stage versions while leaving active pointers in place.
4. **Deploy.** Review the plan and apply it using the same artifact digest and expected destination state used for comparison. The destination rechecks permissions, active pointers, and bindings, then updates all selected pointers and writes deployment history in one transaction. If the destination changed since comparison, return a conflict and require a fresh plan. An idempotency key allows a retry to retrieve the result of the same deployment.
5. **Roll back.** Select a prior revision from the destination's history. Apply it through the deployment path with current permissions and binding validation, preserving the full audit trail.

The catalog records the intended active revisions. The MCP server serves its loaded generation until rollout of the updated runtime snapshot. Deployment status tracks both states. See the [runtime rollout design](mcp-runtime.md).

Existing MCP grants belong to the target tool ID and follow its active revision. A newly imported tool receives access grants only through the destination's own access management. A call already in progress uses the revision it resolved at invocation.

## Admin deployment module

Configure a destination with a display name, environment ID, management endpoint, and reference to a deployment credential. Store the credential on the server. An operator selects a revision and destination, reviews the diff and mapping failures, and deploys when validation passes. History shows what was active before and after each deployment and who applied it. Support file export and import for installations that cannot reach one another.

The destination authenticates operators and automation independently. The source installation authorizes the signed-in user before using a stored destination credential. See the [Admin access design](admin-access.md). Separate permission to compare, import, and activate from MCP tool execution permissions. Scope automation credentials to the target environment and the permitted deployment operations. Use HTTPS for remote destinations and restrict destination registration to administrators.

## CI

Expose export, compare, import, deploy, and rollback through the management API. A thin CLI can wrap this API for developer and CI use. The CLI uses the same validation, authorization, and deployment history as the Admin module.

A CI job exports or downloads a specific bundle, stores it as a release artifact, and runs a destination comparison with machine-readable output. Deployment uses the reviewed plan and the same bundle. The pipeline can place its production approval between compare and apply. Credentials come from the CI secret store. Validation failures, permission failures, and stale plans exit nonzero. Run deployment history and smoke checks against the destination after activation.

## First implementation

Establish tool IDs, immutable revision IDs, per-environment active pointers, and deployment events in the initial SQLite catalog. Verify promotion using two local installations and a single PostgreSQL customer lookup tool with separate source bindings. The integration flow exports a revision, imports it while keeping the destination's active revision, shows the diff, activates it, and rolls back. It also exercises conflicting IDs, missing bindings, and concurrent deployment attempts.
