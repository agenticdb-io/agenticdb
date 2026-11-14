import { createHash } from 'node:crypto';
import { Ajv } from 'ajv';
import type { Adapter, Source, ToolDefinition } from './types.ts';
import { postgres } from './adapters/postgres.ts';
import { mongodb } from './adapters/mongodb.ts';

export type { Grant, PublishedTool, Snapshot, Source, ToolDefinition } from './types.ts';

const adapters = new Map<string, Adapter>([['postgres', postgres], ['mongodb', mongodb]]);
const validator = new Ajv({ ownProperties: true });

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function validateSource(source: Source) {
  if (!source || typeof source.id !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(source.id) ||
    !adapters.has(source.kind) || typeof source.connectionEnv !== 'string' ||
    !/^AGENTICDB_SOURCE_[A-Z0-9_]+$/.test(source.connectionEnv)) {
    throw new Error('Provide a source ID, a supported adapter, and an AGENTICDB_SOURCE_ environment variable.');
  }
}

export function validateTool(tool: ToolDefinition, source: Source) {
  if (!tool || typeof tool.name !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(tool.name) ||
    typeof tool.description !== 'string' || !tool.description.trim() || tool.sourceId !== source.id ||
    tool.inputSchema?.type !== 'object' || tool.inputSchema.additionalProperties !== false ||
    !tool.inputSchema.properties || !Array.isArray(tool.inputSchema.required)) {
    throw new Error('Provide a name, description, source, and object input schema.');
  }
  validator.compile(tool.inputSchema);
  adapters.get(source.kind)!.validate(tool.command, tool.inputSchema.properties, tool.inputSchema.required);
}

export async function executeTool(tool: ToolDefinition, source: Source, args: unknown) {
  if (!validator.compile(tool.inputSchema)(args)) throw new Error('Invalid tool arguments.');
  const connection = process.env[source.connectionEnv];
  if (!connection) throw new Error('The data source is unavailable.');
  let records: unknown[];
  try {
    records = await adapters.get(source.kind)!.execute(connection, tool.command, args as Record<string, unknown>);
  } catch {
    throw new Error('The database read failed.');
  }
  const bounded: unknown[] = [];
  let bytes = 0;
  for (const row of records.slice(0, 50)) {
    bytes += Buffer.byteLength(JSON.stringify(row)) + 1;
    if (bytes > 250_000) break;
    bounded.push(row);
  }
  return { records: bounded, truncated: bounded.length !== records.length };
}
