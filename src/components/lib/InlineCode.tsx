'use client';

import { Tooltip } from '@near-pagoda/ui';
import React, { type ReactNode } from 'react';

import { copyTextToClipboard } from '~/utils/clipboard';

import s from './InlineCode.module.scss';

type Props = {
  children?: ReactNode;
};

export const InlineCode = ({ children }: Props) => {
  return (
    <Tooltip asChild content="Copy to clipboard">
      <button
        type="button"
        className={s.inlineCode}
        onClick={() => copyTextToClipboard(String(children))}
      >
        {children}
      </button>
    </Tooltip>
  );
};