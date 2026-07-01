import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Transcript } from './Transcript.tsx';
import { makeAssistantMessage } from '../test/fixtures/chat.ts';

describe('Transcript', () => {
  it('renders the empty state', () => {
    render(<Transcript messages={[]} showThinking showToolCalls userId="demo-user" />);

    expect(screen.getByText('Good to see you.')).toBeInTheDocument();
    expect(screen.getByText(/thinking steps/i)).toBeInTheDocument();
    expect(screen.getByText('demo-user')).toBeInTheDocument();
  });

  it('hides thinking cues in the empty state when showThinking is false', () => {
    render(<Transcript messages={[]} showThinking={false} showToolCalls userId="demo-user" />);

    expect(screen.getByText('Good to see you.')).toBeInTheDocument();
    expect(screen.queryByText(/thinking steps/i)).not.toBeInTheDocument();
  });

  it('renders one row per message', () => {
    render(
      <Transcript
        messages={[
          { id: 'u1', role: 'user', content: 'Hi', createdAt: 0 },
          makeAssistantMessage({
            id: 'a1',
            status: 'complete',
            content: 'Hello',
          }),
        ]}
        showThinking
        showToolCalls
        userId="demo-user"
      />,
    );

    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
