import { type z } from 'zod';

import { type entryModel, optionalVersion } from './models';

export function idForEntry(entry: z.infer<typeof entryModel>) {
  return `${entry.namespace}/${entry.name}/${entry.version}`;
}

export function idMatchesEntry(id: string, entry: z.infer<typeof entryModel>) {
  return (
    id.startsWith(`${entry.namespace}/${entry.name}/`) ||
    id === `${entry.namespace}/${entry.name}`
  );
}

export function parseEntryId(id: string) {
  const segments = id.split('/');
  const namespace = segments[0];
  const name = segments[1];

  let version = segments[2] || 'latest';
  if (version === '*') version = 'latest';

  if (!namespace || !name) {
    throw new Error(
      `Attempted to parse invalid entry ID: ${id} (expected format is "namespace/name" or "namespace/name/version")`,
    );
  }

  return { namespace, name, version };
}

export function parseEntryIdWithOptionalVersion(id: string) {
  const segments = parseEntryId(id);
  const version = optionalVersion.parse(segments.version);
  return { ...segments, version };
}
