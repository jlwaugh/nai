import { useParams } from 'next/navigation';

export function useAgentParams(overrides?: {
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