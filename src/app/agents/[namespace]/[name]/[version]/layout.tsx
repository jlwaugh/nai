'use client';

import { BookOpenText, CodeBlock, Play } from '@phosphor-icons/react';
import { type ReactNode } from 'react';

import { EntryDetailsLayout } from '~/components/EntryDetailsLayout';
import { env } from '~/env';

export default function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <EntryDetailsLayout
      category="agent"
      defaultConsumerModePath="/run"
      tabs={
        !env.NEXT_PUBLIC_CONSUMER_MODE
          ? [
              {
                path: '',
                label: 'Overview',
                icon: <BookOpenText fill="bold" />,
              },
              {
                path: '/source',
                label: 'Source',
                icon: <CodeBlock fill="bold" />,
              },
              {
                path: '/run',
                label: 'Run',
                icon: <Play fill="bold" />,
              },
            ]
          : null
      }
    >
      {children}
    </EntryDetailsLayout>
  );
}
