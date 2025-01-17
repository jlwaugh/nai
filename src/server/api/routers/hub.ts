import path from 'path';
import { z } from 'zod';

import { env } from '~/env';
import {
  chatWithAgentModel,
  type entriesModel,
  entryCategory,
  entryModel,
  entrySecretModel,
  filesModel,
  modelsModel,
  noncesModel,
  optionalVersion,
  revokeNonceModel,
  threadMessageModel,
  threadMetadataModel,
  threadModel,
  threadRunModel,
  threadsModel,
} from '~/lib/models';
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from '~/server/api/trpc';
import { loadEntriesFromDirectory } from '~/server/utils/data-source';
import { conditionallyIncludeAuthorizationHeader } from '~/server/utils/headers';
import { conditionallyRemoveSecret } from '~/server/utils/secrets';
import { fetchThreadContents } from '~/server/utils/threads';
import { createZodFetcher } from '~/utils/zod-fetch';

const fetchWithZod = createZodFetcher();

export const hubRouter = createTRPCRouter({
  entries: publicProcedure
    .input(
      z.object({
        category: entryCategory.optional(),
        limit: z.number().default(10_000),
        namespace: z.string().optional(),
        showLatestVersion: z.boolean().default(true),
        starredBy: z.string().optional(),
        tags: z.string().array().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const url = new URL(`${env.ROUTER_URL}/registry/list_entries`);

      url.searchParams.append('total', `${input.limit}`);
      url.searchParams.append(
        'show_latest_version',
        `${input.showLatestVersion}`,
      );

      if (input.category) url.searchParams.append('category', input.category);

      if (input.namespace)
        url.searchParams.append('namespace', input.namespace);

      if (input.tags) url.searchParams.append('tags', input.tags.join(','));

      if (input.category == 'agent' && env.DATA_SOURCE == 'local_files') {
        if (!env.HOME)
          throw new Error(
            'Missing required HOME environment variable for serving local files',
          );
        const registryPath = path.join(env.HOME, '.nearai', 'registry');
        return await loadEntriesFromDirectory(registryPath);
      }

      if (input.starredBy) {
        url.searchParams.append('starred_by', input.starredBy);
      }

      if (ctx.signature) {
        url.searchParams.append('star_point_of_view', ctx.signature.account_id);
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
      });

      const data: unknown = await response.json().catch(() => response.text());

      if (!response.ok || !Array.isArray(data)) throw data;

      /*
        Unfortunately, we can't rely on fetchWithZod() for this method. If the endpoint 
        returns a single record that didn't match our expected "entries" schema, 
        all of the data would be thrown out. Instead, we loop over each returned item and 
        parse the entries one at a time - only omitting entries that aren't valid instead 
        of throwing an error for the entire list.
      */

      const list: z.infer<typeof entriesModel> = data
        .map((item) => {
          const parsed = entryModel.safeParse(item);
          return parsed.data;
        })
        .filter((entry) => !!entry);

      return list;
    }),

  filePaths: publicProcedure
    .input(
      z.object({
        namespace: z.string(),
        name: z.string(),
        version: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const files = await fetchWithZod(
        filesModel,
        `${env.ROUTER_URL}/registry/list_files`,
        {
          method: 'POST',
          headers: conditionallyIncludeAuthorizationHeader(ctx.authorization, {
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            entry_location: {
              namespace: input.namespace,
              name: input.name,
              version: input.version,
            },
          }),
        },
      );

      const paths = files.flatMap((file) => file.filename);
      paths.push('metadata.json');
      paths.sort();

      return paths;
    }),

  models: publicProcedure.query(async () => {
    const url = `${env.ROUTER_URL}/models`;

    const response = await fetch(url);
    const data: unknown = await response.json().catch(() => response.text());

    return modelsModel.parse(data);
  }),

  nonces: protectedProcedure.query(async ({ ctx }) => {
    const url = `${env.ROUTER_URL}/nonce/list`;

    const nonces = await fetchWithZod(noncesModel, url, {
      headers: {
        Authorization: ctx.authorization,
      },
    });

    return nonces;
  }),

  revokeNonce: protectedProcedure
    .input(revokeNonceModel)
    .mutation(async ({ input }) => {
      const url = `${env.ROUTER_URL}/nonce/revoke`;

      // We can't use regular auth since we need to use the signed revoke message.
      const response = await fetch(url, {
        headers: {
          Authorization: input.auth,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ nonce: input.nonce }),
      });

      const data: unknown = await response.json().catch(() => response.text());
      if (!response.ok) throw data;

      return data;
    }),

  revokeAllNonces: protectedProcedure
    .input(z.object({ auth: z.string() }))
    .mutation(async ({ input }) => {
      const url = `${env.ROUTER_URL}/nonce/revoke/all`;

      // We can't use regular auth since we need to use the signed revoke message.
      const response = await fetch(url, {
        headers: {
          Authorization: input.auth,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const data: unknown = await response.json().catch(() => response.text());
      if (!response.ok) throw data;

      return data;
    }),

  secrets: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(10_000),
        offset: z.number().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const url = new URL(`${env.ROUTER_URL}/get_user_secrets`);
      url.searchParams.append('limit', `${input.limit}`);

      const secrets = await fetchWithZod(
        entrySecretModel.array(),
        url.toString(),
        {
          headers: {
            Authorization: ctx.authorization,
          },
        },
      );

      return secrets;
    }),

  addSecret: protectedProcedure
    .input(
      z.object({
        category: entryCategory,
        description: z.string().optional().default(''),
        key: z.string(),
        name: z.string(),
        namespace: z.string(),
        value: z.string(),
        version: optionalVersion,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      /*
        If there's an existing secret that would create a conflict, 
        remove it before adding it again to avoid the Hub API throwing 
        an error. We might want to consider adding proper upsert support 
        on the Hub API side when we have time.
      */

      await conditionallyRemoveSecret(ctx.authorization, input);

      const url = `${env.ROUTER_URL}/create_hub_secret`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: ctx.authorization,
        },
        method: 'POST',
        body: JSON.stringify(input),
      });

      const data: unknown = await response.json().catch(() => response.text());
      if (!response.ok) throw data;

      return true;
    }),

  removeSecret: protectedProcedure
    .input(
      z.object({
        category: entryCategory,
        key: z.string(),
        name: z.string(),
        namespace: z.string(),
        version: optionalVersion,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const url = `${env.ROUTER_URL}/remove_hub_secret`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: ctx.authorization,
        },
        method: 'POST',
        body: JSON.stringify(input),
      });

      const data: unknown = await response.json().catch(() => response.text());
      if (!response.ok) throw data;

      return true;
    }),

  starEntry: protectedProcedure
    .input(
      z.object({
        action: z.enum(['add', 'remove']),
        namespace: z.string(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { action, namespace, name } }) => {
      const url =
        env.ROUTER_URL +
        `/stars/${action === 'add' ? 'add_star' : 'remove_star'}`;

      const formData = new FormData();
      formData.append('namespace', namespace);
      formData.append('name', name);

      const response = await fetch(url, {
        headers: {
          Authorization: ctx.authorization,
        },
        method: 'POST',
        body: formData,
      });

      const data: unknown = await response.json().catch(() => response.text());
      if (!response.ok) throw data;

      return true;
    }),

  thread: protectedProcedure
    .input(
      z.object({
        afterMessageId: z.string().optional(),
        runId: z.string().optional(),
        threadId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const contents = await fetchThreadContents({
        ...input,
        authorization: ctx.authorization,
      });

      return contents;
    }),

  chatWithAgent: protectedProcedure
    .input(chatWithAgentModel)
    .mutation(async ({ ctx, input }) => {
      const thread = input.thread_id
        ? await fetchWithZod(
            threadModel,
            `${env.ROUTER_URL}/threads/${input.thread_id}`,
            {
              headers: {
                Authorization: ctx.authorization,
              },
            },
          )
        : await fetchWithZod(threadModel, `${env.ROUTER_URL}/threads`, {
            method: 'POST',
            headers: {
              Authorization: ctx.authorization,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });

      const message = await fetchWithZod(
        threadMessageModel,
        `${env.ROUTER_URL}/threads/${thread.id}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: ctx.authorization,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: input.new_message,
            role: 'user',
          }),
        },
      );

      const run = await fetchWithZod(
        threadRunModel,
        `${env.ROUTER_URL}/threads/${thread.id}/runs`,
        {
          method: 'POST',
          headers: {
            Authorization: ctx.authorization,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_env_vars: input.agent_env_vars,
            assistant_id: input.agent_id,
            max_iterations: input.max_iterations,
            thread_id: thread.id,
            user_env_vars: input.user_env_vars,
          }),
        },
      );

      return {
        thread,
        message,
        run,
      };
    }),

  threadContents: protectedProcedure
    .input(
      z.object({
        afterMessageId: z.string().optional(),
        threadId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const contents = await fetchThreadContents({
        ...input,
        authorization: ctx.authorization,
      });

      return contents;
    }),

  threads: protectedProcedure.query(async ({ ctx }) => {
    const url = `${env.ROUTER_URL}/threads`;

    const threads = await fetchWithZod(threadsModel, url, {
      headers: {
        Authorization: ctx.authorization,
      },
    });

    threads.sort((a, b) => b.created_at - a.created_at);

    return threads;
  }),

  removeThread: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await fetch(`${env.ROUTER_URL}/threads/${input.threadId}`, {
        method: 'DELETE',
        headers: {
          Authorization: ctx.authorization,
        },
      });

      return true;
    }),

  updateThread: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        metadata: threadMetadataModel,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await fetch(`${env.ROUTER_URL}/threads/${input.threadId}`, {
        method: 'POST',
        headers: {
          Authorization: ctx.authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: input.metadata,
        }),
      });

      return true;
    }),

  updateMetadata: protectedProcedure
    .input(
      z.object({
        namespace: z.string(),
        name: z.string(),
        version: z.string(),
        metadata: entryModel.partial(),
      }),
    )
    .mutation(
      async ({ ctx, input: { name, namespace, version, metadata } }) => {
        const response = await fetch(
          `${env.ROUTER_URL}/registry/upload_metadata`,
          {
            headers: {
              Authorization: ctx.authorization,
              'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({
              metadata,
              entry_location: {
                namespace,
                name,
                version,
              },
            }),
          },
        );

        const data: unknown = await response
          .json()
          .catch(() => response.text());
        if (!response.ok) throw data;

        return true;
      },
    ),
});
