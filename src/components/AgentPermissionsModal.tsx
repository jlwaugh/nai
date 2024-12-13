import {
  Button,
  Dialog,
  Flex,
  SvgIcon,
  Text,
} from '@near-pagoda/ui';
import {
  Check,
  Prohibit,
} from '@phosphor-icons/react';
import { useEffect } from 'react';
import { type z } from 'zod';

import {
  idForAgent,
  idMatchesAgent,
} from '~/lib/agents';
import {
  type agentAddSecretsRequestModel,
  type agentNearSendTransactionsRequestModel,
  type chatWithAgentModel,
  type agentModel,
} from '~/lib/models';
import { useAgentSettingsStore } from '~/stores/agent-settings';
import { useAuthStore } from '~/stores/auth';

import { SignInPrompt } from './SignInPrompt';

export type AgentRequestWithPermissions =
  | {
      action: 'add_secrets';
      input: z.infer<typeof agentAddSecretsRequestModel>;
    }
  | {
      action: 'remote_agent_run';
      input: z.infer<typeof chatWithAgentModel>;
    }
  | {
      action: 'near_send_transactions';
      input: z.infer<typeof agentNearSendTransactionsRequestModel>;
    };

type Props = {
  agent: z.infer<typeof agentModel>;
  requests: AgentRequestWithPermissions[] | null;
  clearRequests: () => unknown;
  onAllow: (requests: AgentRequestWithPermissions[]) => unknown;
};

export function checkAgentPermissions(
  agent: z.infer<typeof agentModel>,
  requests: AgentRequestWithPermissions[],
) {
  const settings = useAgentSettingsStore.getState().getAgentSettings(agent);
  let allowAddSecrets = true;
  let allowRemoteRunCallsToOtherAgents = true;
  let allowWalletTransactionRequests = true;

  requests.forEach(({ action, input }) => {
    if (action === 'add_secrets') {
      // Always prompt a user for permission to add secrets
      allowAddSecrets = false;
    } else if (action === 'remote_agent_run') {
      allowRemoteRunCallsToOtherAgents =
        idMatchesAgent(input.agent_id, agent) ||
        !!settings.allowRemoteRunCallsToOtherAgents;
    } else if (action === 'near_send_transactions') {
      allowWalletTransactionRequests =
        !!settings.allowWalletTransactionRequests;
    }
  });

  const allowed =
    allowAddSecrets &&
    allowRemoteRunCallsToOtherAgents &&
    allowWalletTransactionRequests;

  return {
    allowed,
    permissions: {
      allowAddSecrets,
      allowRemoteRunCallsToOtherAgents,
      allowWalletTransactionRequests,
    },
  };
}

export const AgentPermissionsModal = ({
  agent,
  requests,
  clearRequests,
  onAllow,
}: Props) => {
  const auth = useAuthStore((store) => store.auth);
  const isAuthenticated = useAuthStore((store) => store.isAuthenticated);
  const agentId = idForAgent(agent);
  const setAgentSettings = useAgentSettingsStore(
    (store) => store.setAgentSettings,
  );
  const check = requests ? checkAgentPermissions(agent, requests) : undefined;
  const otherAgentId = requests?.find(
    (request) => request.action === 'remote_agent_run',
  )?.input.agent_id;

  const decline = () => {
    clearRequests();
  };

  const allow = () => {
    if (!requests) return;
    clearRequests();
    onAllow(requests);
  };

  const alwaysAllow = () => {
    if (!requests) return;

    if (!check?.permissions.allowRemoteRunCallsToOtherAgents) {
      setAgentSettings(agent, {
        allowRemoteRunCallsToOtherAgents: true,
      });
    }

    if (!check?.permissions.allowWalletTransactionRequests) {
      setAgentSettings(agent, {
        allowWalletTransactionRequests: true,
      });
    }

    clearRequests();
    onAllow(requests);
  };

  useEffect(() => {
    /*
      This logic handles the edge case of closing the modal automatically 
      if the passed request is already permitted.
    */

    if (check?.allowed) {
      clearRequests();
      requests && onAllow(requests);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestsThatCanBeAlwaysAllowed =
    requests?.filter(({ action }) => action !== 'add_secrets') ?? [];

  return (
    <Dialog.Root open={requests !== null} onOpenChange={() => clearRequests()}>
      <Dialog.Content title="Agent Request" size="s">
        {check && requests && (
          <>
            {isAuthenticated ? (
              <Flex direction="column" gap="l">
                {!check.permissions.allowRemoteRunCallsToOtherAgents && (
                  <>
                    <Text>
                      The current agent{' '}
                      <Text href={`/agents/${agentId}`} target="_blank">
                        {agentId}
                      </Text>{' '}
                      wants to send an additional request to a different agent{' '}
                      <Text href={`/agents/${otherAgentId}`} target="_blank">
                        {otherAgentId}
                      </Text>{' '}
                      using your {`account's`} signature{' '}
                      <Text as="span" color="sand-12" weight={500}>
                        {auth?.account_id}
                      </Text>
                    </Text>

                    <Flex direction="column" gap="m">
                      <Flex align="baseline" gap="s">
                        <SvgIcon
                          size="xs"
                          icon={<Check weight="bold" />}
                          color="green-10"
                        />
                        <Text size="text-s">
                          Allow the agent to execute actions within the Near AI
                          Hub.
                        </Text>
                      </Flex>

                      <Flex align="baseline" gap="s">
                        <SvgIcon
                          size="xs"
                          icon={<Prohibit weight="bold" />}
                          color="red-10"
                        />
                        <Text size="text-s">
                          Will NOT allow the agent to perform actions on your
                          NEAR blockchain account.
                        </Text>
                      </Flex>
                    </Flex>
                  </>
                )}

                {!check.permissions.allowWalletTransactionRequests && (
                  <>
                    <Text>
                      The current agent{' '}
                      <Text href={`/agents/${agentId}`} target="_blank">
                        {agentId}
                      </Text>{' '}
                      wants to request a wallet transaction. If allowed, you
                      will be prompted to review the transaction within your
                      connected wallet.
                    </Text>

                    <Flex direction="column" gap="m">
                      <Flex align="baseline" gap="s">
                        <SvgIcon
                          size="xs"
                          icon={<Check weight="bold" />}
                          color="green-10"
                        />
                        <Text size="text-s">
                          Allow the agent to request wallet transactions. You
                          will review each request within your connected wallet
                          before deciding to approve or deny it.
                        </Text>
                      </Flex>

                      <Flex align="baseline" gap="s">
                        <SvgIcon
                          size="xs"
                          icon={<Prohibit weight="bold" />}
                          color="red-10"
                        />
                        <Text size="text-s">
                          Will NOT allow the agent to perform wallet
                          transactions on your behalf without your consent.
                        </Text>
                      </Flex>
                    </Flex>
                  </>
                )}

                <Flex gap="s">
                  <Button
                    label="Decline"
                    variant="secondary"
                    style={{ marginRight: 'auto' }}
                    size="small"
                    onClick={decline}
                  />

                  {requestsThatCanBeAlwaysAllowed.length > 0 ? (
                    <>
                      <Button
                        label="Allow Once"
                        variant="affirmative"
                        fill="outline"
                        size="small"
                        onClick={allow}
                      />
                      <Button
                        label="Always Allow"
                        variant="affirmative"
                        size="small"
                        onClick={alwaysAllow}
                      />
                    </>
                  ) : (
                    <Button
                      label="Allow"
                      variant="affirmative"
                      size="small"
                      onClick={allow}
                    />
                  )}
                </Flex>
              </Flex>
            ) : (
              <SignInPrompt />
            )}
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};
