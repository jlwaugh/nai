import { type z } from 'zod';

import { type agentModel, optionalVersion } from './models';

export function idForAgent(agent: z.infer<typeof agentModel>) {
return `${agent.namespace}/${agent.name}/${agent.version}`;
}

export function idMatchesAgent(id: string, agent: z.infer<typeof agentModel>) {
return (
    id.startsWith(`${agent.namespace}/${agent.name}/`) ||
    id === `${agent.namespace}/${agent.name}`
);
}

export function parseAgentId(id: string) {
const segments = id.split('/');
const namespace = segments[0];
const name = segments[1];

let version = segments[2] || 'latest';
if (version === '*') version = 'latest';

if (!namespace || !name) {
    throw new Error(
    `Attempted to parse invalid agent ID: ${id} (expected format is "namespace/name" or "namespace/name/version")`,
    );
}

return { namespace, name, version };
}

export function parseAgentIdWithOptionalVersion(id: string) {
const segments = parseAgentId(id);
const version = optionalVersion.parse(segments.version);
return { ...segments, version };
}