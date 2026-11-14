import pg from 'pg';
import type { Adapter } from '../types.ts';

interface Select {
  sql: string;
  bindings: string[];
}

export const postgres: Adapter = {
  validate(command, properties, required) {
    const select = command as Partial<Select> | null;
    if (!select || typeof select.sql !== 'string' || !/^\s*SELECT\b/i.test(select.sql) ||
      select.sql.includes(';') || !Array.isArray(select.bindings)) {
      throw new Error('Provide a single SELECT and its parameter bindings.');
    }
    for (const name of select.bindings) {
      if (typeof name !== 'string' || !Object.hasOwn(properties, name) || !required.includes(name)) {
        throw new Error('Each SQL binding must reference a required argument.');
      }
    }
    const positions = new Set(Array.from(select.sql.matchAll(/\$(\d+)/g), match => Number(match[1])));
    if (positions.size !== select.bindings.length || select.bindings.some((_, index) => !positions.has(index + 1))) {
      throw new Error('SQL placeholders must match the bindings in order.');
    }
  },
  async execute(connection, command, args) {
    const { sql, bindings } = command as Select;
    const client = new pg.Client({ connectionString: connection, connectionTimeoutMillis: 3000, query_timeout: 5000 });
    try {
      await client.connect();
      await client.query('BEGIN READ ONLY');
      await client.query('SET LOCAL statement_timeout = 2000');
      const result = await client.query(
        `SELECT * FROM (${sql}\n) AS agenticdb_result LIMIT 51`,
        bindings.map(name => args[name]),
      );
      return result.rows;
    } finally {
      await client.end();
    }
  },
};
