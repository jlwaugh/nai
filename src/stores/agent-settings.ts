import { type z } from 'zod';
import { create, type StateCreator } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { idForAgent } from '~/lib/agents';
import { type agentModel } from '~/lib/models';

type AgentSettings = Partial<{
  allowRemoteRunCallsToOtherAgents: boolean;
  allowWalletTransactionRequests: boolean;
}>;

type AgentSettingsStore = {
  agentSettingsById: Record<string, AgentSettings>;
  getAgentSettings: (agent: z.infer<typeof agentModel>) => AgentSettings;
  setAgentSettings: (
    agent: z.infer<typeof agentModel>,
    settings: AgentSettings,
  ) => void;
};

const createStore: StateCreator<AgentSettingsStore> = (set, get) => ({
  agentSettingsById: {},

  getAgentSettings: (agent: z.infer<typeof agentModel>) => {
    const id = idForAgent(agent);
    return get().agentSettingsById[id] ?? {};
  },

  setAgentSettings: (
    agent: z.infer<typeof agentModel>,
    settings: AgentSettings,
  ) => {
    const agentSettingsById = {
      ...get().agentSettingsById,
    };

    const id = idForAgent(agent);

    agentSettingsById[id] = {
      ...agentSettingsById[id],
      ...settings,
    };

    set({ agentSettingsById });
  },
});

const name = 'AgentSettingsStore';

export const useAgentSettingsStore = create<AgentSettingsStore>()(
  devtools(persist(createStore, { name, skipHydration: true }), {
    name,
  }),
);
