import { useParams } from 'next/navigation';

import { api } from '~/trpc/react';

export function useEntryParams(overrides?: {
  namespace?: string;
  name?: string;
  version?: string;
}) {
  const params = useParams();
  const namespace = overrides?.namespace ?? params.namespace;
  const name = overrides?.name ?? params.name;
  const version = overrides?.version ?? params.version;
  const id = `${namespace as string}/${name as string}/${version as string}`;

  return {
    id,
    namespace: namespace as string,
    name: name as string,
    version: version as string,
  };
}

export function useCurrentEntry(
  category: 'agent',
  overrides?: {
    namespace?: string;
    name?: string;
    version?: string;
  },
) {
  const { id, namespace, name, version } = useEntryParams(overrides);

  const entriesQuery = api.hub.entries.useQuery({
    category,
    namespace,
    showLatestVersion: false,
  });

  const currentVersions = entriesQuery.data?.filter(
    (item) => item.name === name,
  );

  currentVersions?.sort((a, b) => b.id - a.id);

  const currentEntry =
    version === 'latest'
      ? currentVersions?.[0]
      : currentVersions?.find((item) => item.version === version);

  return {
    currentEntry,
    currentEntryId: id,
    currentEntryIsHidden: !!entriesQuery.data && !currentEntry,
    currentVersions,
  };
}
