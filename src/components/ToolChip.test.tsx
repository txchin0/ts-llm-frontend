import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ToolChip } from './ToolChip.tsx';
import { makeToolActivity } from '../test/fixtures/chat.ts';

describe('ToolChip', () => {
  it('shows the tool name and status label', () => {
    render(<ToolChip tool={makeToolActivity({ toolName: 'web_search', status: 'running' })} />);

    expect(screen.getByText('web_search')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('expands to reveal input and output payloads', async () => {
    const user = userEvent.setup();

    const { getByRole } = render(
      <ToolChip
        tool={makeToolActivity({
          toolName: 'web_search',
          status: 'done',
          input: { query: 'weather' },
          output: { result: 'sunny' },
        })}
      />,
    );

    await user.click(getByRole('button', { name: /web_search/i }));

    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText(/"query": "weather"/)).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText(/"result": "sunny"/)).toBeInTheDocument();
  });

  it('shows error details when a tool failed', async () => {
    const user = userEvent.setup();

    const { getByRole } = render(
      <ToolChip
        tool={makeToolActivity({
          toolName: 'lookup',
          status: 'error',
          errorMessage: 'Rate limited',
          errorCode: 'rate_limit',
        })}
      />,
    );

    await user.click(getByRole('button', { name: /lookup/i }));

    expect(screen.getByText('What went wrong')).toBeInTheDocument();
    expect(screen.getByText('Rate limited')).toBeInTheDocument();
    expect(screen.getByText('rate_limit')).toBeInTheDocument();
  });
});
