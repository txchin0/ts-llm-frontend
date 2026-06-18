import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ThinkingPanel } from './ThinkingPanel.tsx';

describe('ThinkingPanel', () => {
  it('shows thinking text', () => {
    render(<ThinkingPanel text="Step one" streaming={false} />);

    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByText('Step one')).toBeInTheDocument();
  });

  it('shows a live indicator while streaming', () => {
    render(<ThinkingPanel text="Working" streaming />);

    expect(screen.getByText('Reasoning…')).toBeInTheDocument();
  });

  it('can be collapsed after streaming completes', async () => {
    const user = userEvent.setup();

    const { getByRole } = render(<ThinkingPanel text="Done thinking" streaming={false} />);

    await user.click(getByRole('button', { name: /thinking/i }));

    expect(screen.queryByText('Done thinking')).not.toBeInTheDocument();
  });
});
