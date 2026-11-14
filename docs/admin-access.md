# Admin authentication and authorization

Each AgenticDB installation stores its local Admin users, role assignments, and sessions in the metadata catalog. The first implementation uses SQLite. A user account has a stable local ID, a unique login, a password hash, and an enabled status. The initial administrator is created through a local bootstrap command. Database migrations and container images carry no default account or password.

## Authentication

Hash passwords with Argon2id and a unique salt. On successful login, issue an opaque session cookie with HttpOnly, SameSite, and Secure settings for HTTPS deployments. Store the session token as a hash in the catalog with its user ID and expiration. Apply CSRF protection to state-changing browser requests and rate-limit login attempts. Logout revokes the session. Disabling an account or resetting its password revokes its sessions. Resolve current role assignments on each request so permission changes apply to the next request.

Provide a local administrator command for account recovery and prevent role changes or account disabling that would remove the last enabled administrator.

## Roles and permissions

Ship with the built-in `admin` role. Define operation-level permissions in the backend from the first release so additional built-in roles can use them later.

| Future role | Permissions |
| --- | --- |
| Viewer | View tools, revisions, active versions, and deployment history. Query definitions are visible to authorized users. Resolved credentials and token values are excluded. |
| Tool editor | Viewer permissions plus create and edit drafts and run authorized previews. Preview permission covers access to query output. |
| Deployment operator | Viewer permissions plus seal, export, compare, import, activate, and roll back revisions within the authorized environment. |
| Admin | All administrative operations, including users and roles, data sources, destination registration, and issuance and revocation of tokens. Available in the first release. |

Users can receive multiple roles. Their permissions are the union of those roles within the installation. Check authorization on the server for every management operation. The UI uses granted permissions to show available actions. Keep separate permissions for preview, export, compare, import, and activation so the access model can evolve independently of the initial role presets.

## Deployment and credential scopes

An operator needs local permission to select and export a revision and permission at the destination to compare, import, or activate it. When the Admin server contacts a configured destination, the destination authenticates the stored deployment credential and checks its scope. The local server checks the signed-in user's permission for each requested action before using that credential. Audit records capture both the authenticated deployment credential at the destination and the initiating user on the source installation. Any initiator metadata forwarded to the destination is additional audit context.

The separate [MCP runtime](mcp-runtime.md) reads consumer grants from its startup snapshot. CI uses its own destination-scoped automation credential with explicit deployment permissions. MCP execution tokens authorize tool discovery and invocation. The management API accepts authenticated Admin sessions or automation credentials scoped to the requested management operation.

Record administrative changes such as user creation, role assignment, disabling an account, and issuing or revoking credentials, with actor and timestamp. Store credential hashes or secret references and keep passwords, session values, and tokens out of audit logs.
