export interface Source {
  id: string;
  kind: string;
  connectionEnv: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  sourceId: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
  command: unknown;
}

export interface PublishedTool extends ToolDefinition {
  toolId: string;
  revisionId: string;
}

export interface Grant {
  hash: string;
  toolId: string;
  expiresAt: number;
}

export interface Snapshot {
  version: 1;
  generation: string;
  sources: Source[];
  tools: PublishedTool[];
  grants: Grant[];
}

export interface Adapter {
  validate(command: unknown, properties: Record<string, unknown>, required: string[]): void;
  execute(connection: string, command: unknown, args: Record<string, unknown>): Promise<unknown[]>;
}
