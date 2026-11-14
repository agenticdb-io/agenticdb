# Data sources and tool definitions

## Data sources in Admin

The metadata catalog stores data sources separately from tools. A source record has a local ID, a logical source key, a display name, an adapter kind, adapter-validated connection settings, and secret references. The **Data Sources** section lets authorized operators create, edit, and test these records. Connection tests use the configured database identity and return sanitized diagnostics. Store secret references in the catalog and resolve credentials on the server.

A tool revision references a logical source key. Each environment binds that key to its own source record. The Admin editor shows the selected source and uses its adapter to present command configuration. An environment must resolve the source and match the expected adapter kind before activating a revision. Changes to published source settings reach MCP through the next runtime snapshot.

## Public inputs and native bindings

The tool's MCP input schema defines argument names, descriptions, types, and validation constraints. The command configuration defines which arguments feed which native placeholders or structured filter operands. Operators and identifiers are authored in the tool revision. Bindings resolve values from caller arguments, source variables, or runtime expressions.

For example, this PostgreSQL tool uses the customer fixture:

```yaml
name: get_customer_address
description: Looks up a customer's address by customer code.
sourceRef: customer_test
inputSchema:
  type: object
  properties:
    customer_code:
      type: string
      description: Customer code, such as C001.
  required: [customer_code]
  additionalProperties: false
command:
  sql: SELECT address FROM public.customers WHERE code = $1
  bindings: [customer_code]
```

The SQL defines the equality operator. When called with `{"customer_code":"C001"}`, the adapter binds `C001` to `$1` through the PostgreSQL driver. A range can use `>= $1` and `< $2` with separate bindings. An adapter may support arrays for membership checks when the command and driver support a typed array. MongoDB uses structured filters with fixed operator keys and bound values. Cassandra uses prepared CQL placeholders.

The editor shows each binding alongside the parameter it references. Preview accepts sample arguments and executes through the same validation and binding logic used by MCP. Before sealing a revision, validate the input schema, native command, placeholder coverage, and binding references. The adapter checks argument shape compatibility where it can determine the expected shape. For optional arguments, the command must define how omission is handled. Reject a missing value for a required binding rather than silently rewriting the query.

At execution, validate the arguments against the published input schema and bind their values as data. Use the source's restricted database identity and adapter read controls. Credentials and native commands stay on the server. The MCP tool definition exposes the name, description, and input schema.

## Data source environments and query variables

A logical data source such as `system_a` can have multiple target environments, such as `development` and `production`. Each target environment has its own adapter connection settings, secret references, and typed query variable values. These target environments belong to the data source. Each AgenticDB installation explicitly maps a logical source to one of its configured target environments for published execution.

In Admin, operators with source management permissions manage target environments and their values. A tool revision declares the variable names and types it requires and binds them explicitly. For example, a PostgreSQL command can combine a caller argument and a target environment variable:

```yaml
requiredVariables:
  region_code:
    type: string
command:
  sql: SELECT address FROM public.customers WHERE code = $1 AND region_code = $2
  bindings:
    - argument: customer_code
    - sourceVariable: region_code
```

This illustrative query assumes the target table has a `region_code` column. The caller supplies `customer_code`. The selected target environment supplies `region_code`, for example `test-east` in development and `east` in production. The adapter passes both values as driver parameters. The revision defines identifiers and operators. The caller cannot select the target environment or override its variables through MCP.

A preview shows the selected target environment and requires permission to preview against it. Changing a target environment mapping or variable value is an audited catalog change. Activation validates that the target binding exists and every required variable is present and correctly typed. A runtime snapshot carries the selected source settings and variable values or secret references needed by the published tools. Changes to those settings reach MCP when the new generation is loaded.

Tool export preserves variable declarations and bindings. The destination supplies its own values and credentials. Deployment comparison reports the resolved target environment and missing or incompatible variables without exposing values. Keep variable values out of tool telemetry and use secret references if a query variable is sensitive.

## MongoDB commands

Each adapter defines its own command schema. A MongoDB command specifies an operation (`findOne` or `find`), a collection, a structured filter, and optional projection and sort. The configured target connection selects the database. The revision controls the operation, collection, field names, and permitted operators.

For a MongoDB source with documents containing `code`, `region_code`, and `address`, the following command uses the same `customer_code` input and `region_code` environment variable declared above:

```yaml
command:
  operation: findOne
  collection: customers
  filter:
    code:
      $eq:
        argument: customer_code
    region_code:
      $eq:
        sourceVariable: region_code
  projection:
    _id: 0
    address: 1
```

The adapter validates the filter structure and binding types before publication. At execution it resolves references only at declared value positions. Values are encoded as MongoDB operands. The adapter never merges caller-supplied documents into the filter structure or interprets values as operators. It rejects unsupported operations and filter operators.

Dispatch `findOne` to the driver's single-document method and normalize the result to zero or one record. Dispatch `find` to the cursor method, read within the tool's time, record, and byte budgets, and close the cursor when finished or cancelled. Both return the shared result format. If a `findOne` filter can match several records and the tool promises a specific record, define a sort with a unique tie-breaker or use a unique filter. [MongoDB find operations](https://www.mongodb.com/docs/drivers/node/current/crud/query/retrieve/) · [MongoDB cursors](https://www.mongodb.com/docs/drivers/node/current/crud/query/cursor/)

### MongoDB aggregation

An aggregation command declares `operation: aggregate`, a collection, and an ordered pipeline. The following example groups a customer's orders by status within the configured target region.

```yaml
name: count_customer_orders_by_status
description: Counts a customer's orders by status in the configured region.
sourceRef: orders_mongodb
inputSchema:
  type: object
  properties:
    customer_code:
      type: string
  required: [customer_code]
  additionalProperties: false
requiredVariables:
  region_code:
    type: string
command:
  operation: aggregate
  collection: orders
  pipeline:
    - $match:
        customer_code:
          $eq:
            argument: customer_code
        region_code:
          $eq:
            sourceVariable: region_code
    - $group:
        _id: "$status"
        order_count:
          $sum: 1
    - $project:
        _id: 0
        status: "$_id"
        order_count: 1
    - $sort:
        status: 1
limits:
  maxRows: 20
  timeoutMs: 2000
```

The first implementation accepts argument and source-variable references in validated operand positions within `$match`. The adapter resolves those references before calling `collection.aggregate(pipeline)`. The revision fixes stage names, operators, field paths, and collection names. Stage and expression validation uses an allowlist, including checks inside any supported nested pipelines. Reject `$out` and `$merge` because they write to collections. Execute with a read-only database identity and apply the shared time, record, and byte budgets when consuming the aggregation cursor. [MongoDB aggregation pipelines](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/)

## Required, optional, and computed values

Use JSON Schema `required` to identify public arguments that callers must provide. Optional arguments can be omitted. Omission and explicit `null` are distinct. Accept `null` only when the schema permits it. A binding that uses an optional argument declares an omission policy, such as a typed default or a validation error if the command requires a value. Apply defaults explicitly during execution. Missing values never implicitly remove filters or broaden a query.

Each binding selects a value source. Use `argument` for a validated MCP argument, `sourceVariable` for a value from the configured target environment, or `expression` for a typed value computed at execution time. Only caller-facing parameters appear in the MCP input schema.

For example, the following PostgreSQL command uses an optional caller argument, a required source variable, and a computed timestamp. The example assumes the orders table has the corresponding columns.

```yaml
inputSchema:
  type: object
  properties:
    status:
      type: string
  additionalProperties: false
requiredVariables:
  region_code:
    type: string
command:
  sql: |
    SELECT id, status FROM public.orders
    WHERE status = $1 AND region_code = $2 AND created_at <= $3
  bindings:
    - argument: status
      onMissing:
        default: open
    - sourceVariable: region_code
    - expression:
        language: javascript
        source: "dateTimeNow()"
```

The expression source is JavaScript syntax restricted to a versioned subset. Parse it as exactly one expression and validate its abstract syntax tree when sealing or importing a revision and when loading a runtime snapshot. The shared execution package interprets only supported nodes. It never passes the source to `eval`, `Function`, or a general JavaScript runtime.

The initial subset supports primitive literals, parentheses, arithmetic and comparisons on compatible types, short-circuit logic, conditional expressions, and direct calls to approved functions such as `dateTimeNow()`. Resolve approved functions from a fixed registry. Disallow global variables, property and indexed access, method calls, assignments, declarations, loops, callbacks, object literals, constructors, imports, and asynchronous operations. Helper functions are implemented in the shared package and expose no filesystem, network, process, or secret-store access. Limit source length, syntax tree depth, and evaluation steps. Reject unsupported syntax and unknown functions before execution.

`dateTimeNow()` returns a typed UTC instant from the clock captured once at invocation start. Multiple calls within an invocation return the same instant. The shared evaluator runs for Admin previews and MCP calls. Check the final value against the binding's expected type before passing it to the adapter.

Adapters receive the resolved value in a declared operand position. A PostgreSQL adapter can bind the instant as a timestamp and a MongoDB adapter can encode it as a BSON date in a supported filter operand. The revision export preserves the expression declaration. Each execution computes its own result.
