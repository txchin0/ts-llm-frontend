import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Message } from './Message.tsx';
import { makeAssistantMessage } from '../test/fixtures/chat.ts';

describe('Message', () => {
  it('renders user bubble text', () => {
    render(
      <Message
        message={{ id: 'u1', role: 'user', content: 'Hello there', createdAt: 0 }}
        showThinking
      />,
    );

    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('shows streaming dots while assistant content is empty', () => {
    render(<Message message={makeAssistantMessage({ status: 'streaming' })} showThinking />);

    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.queryByText('Generation stopped.')).not.toBeInTheDocument();
  });

  it('renders assistant markdown content', () => {
    render(
      <Message
        message={makeAssistantMessage({
          status: 'complete',
          content: 'Answer text',
        })}
        showThinking
      />,
    );

    expect(screen.getByText('Answer text')).toBeInTheDocument();
  });

  it('shows thinking panel when enabled and thinking text exists', () => {
    render(
      <Message
        message={makeAssistantMessage({
          thinking: 'Reasoning steps',
          status: 'streaming',
        })}
        showThinking
      />,
    );

    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByText('Reasoning steps')).toBeInTheDocument();
  });

  it('hides thinking content when showThinking is false', () => {
    render(
      <Message
        message={makeAssistantMessage({
          thinking: 'Reasoning steps',
          status: 'complete',
        })}
        showThinking={false}
      />,
    );

    expect(screen.queryByText('Reasoning steps')).not.toBeInTheDocument();
  });

  it('renders error alert with technical details for non-client errors', () => {
    render(
      <Message
        message={makeAssistantMessage({
          status: 'error',
          error: { code: 'provider_error', message: 'Provider unavailable' },
        })}
        showThinking
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Provider unavailable');
    expect(screen.getByText('Technical details')).toBeInTheDocument();
    expect(screen.getByText('provider_error')).toBeInTheDocument();
  });
});
