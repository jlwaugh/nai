'use client';

import { AgentRunner } from '~/components/AgentRunner';
import { env } from '~/env';
import { parseAgentId } from '~/lib/agents';

export default function ChatPage() {
  const { namespace, name, version } = parseAgentId(
    env.NEXT_PUBLIC_CHAT_AGENT_ID,
  );

  return (
    <AgentRunner
      namespace={namespace}
      name={name}
      version={version}
      showLoadingPlaceholder={true}
    />
  );
}
