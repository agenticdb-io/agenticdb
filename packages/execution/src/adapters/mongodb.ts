import { MongoClient } from 'mongodb';
import type { Adapter } from '../types.ts';

interface FindCommand {
  operation: 'find' | 'findOne';
  collection: string;
  filter: Record<string, { argument: string }>;
}

export const mongodb: Adapter = {
  validate(command, properties, required) {
    const find = command as Partial<FindCommand> | null;
    if (!find || !['find', 'findOne'].includes(find.operation ?? '') ||
      typeof find.collection !== 'string' || !/^[a-zA-Z0-9_]+$/.test(find.collection) ||
      !find.filter || typeof find.filter !== 'object' || Array.isArray(find.filter) ||
      !Object.keys(find.filter).length) {
      throw new Error('Provide a find or findOne command with an equality filter.');
    }
    for (const [field, binding] of Object.entries(find.filter)) {
      const schema = properties[binding?.argument] as { type?: string } | undefined;
      if (!/^[a-zA-Z0-9_]+$/.test(field) || !binding || typeof binding.argument !== 'string' ||
        !required.includes(binding.argument) || !['string', 'number', 'integer', 'boolean'].includes(schema?.type ?? '')) {
        throw new Error('MongoDB filter bindings require scalar arguments.');
      }
    }
  },
  async execute(connection, command, args) {
    const { operation, collection, filter } = command as FindCommand;
    const query = Object.fromEntries(Object.entries(filter).map(([key, binding]) => [key, { $eq: args[binding.argument] }]));
    const client = new MongoClient(connection, { serverSelectionTimeoutMS: 3000, timeoutMS: 5000 });
    try {
      const documents = client.db().collection(collection);
      if (operation === 'findOne') {
        const document = await documents.findOne(query);
        return document ? [document] : [];
      }
      return await documents.find(query).limit(51).toArray();
    } finally {
      await client.close();
    }
  },
};
