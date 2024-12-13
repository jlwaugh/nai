import {
  Lightbulb,
  TerminalWindow,
} from '@phosphor-icons/react';
import { type ReactElement } from 'react';
import { type z } from 'zod';

import { type EntryCategory, type entryModel, optionalVersion } from './models';

export const ENTRY_CATEGORY_LABELS: Record<
  // eslint-disable-next-line @typescript-eslint/ban-types
  EntryCategory | (string & {}),
  {
    icon: ReactElement;
    label: string;
  }
> = {
  agent: {
    icon: <Lightbulb />,
    label: 'Agent',
  },
  environment: {
    icon: <TerminalWindow />,
    label: 'Environment',
  }
};

export function primaryUrlForEntry(entry: z.infer<typeof entryModel>) {
  let url: string | undefined;

  switch (entry.category as EntryCategory) {
    case 'agent':
      url = `https://app.near.ai/agents/${entry.namespace}/${entry.name}/latest`;
      break;
  }

  return url;
}

export function sourceUrlForEntry(entry: z.infer<typeof entryModel>) {
  let url: string | undefined;

  switch (entry.category as EntryCategory) {
    case 'agent':
      url = `${primaryUrlForEntry(entry)}/source`;
      break;
  }

  return url;
}

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
