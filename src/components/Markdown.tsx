import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import './markdown.css';

interface MarkdownProps {
  children: string;
}

export const Markdown = memo(function Markdown({ children }: MarkdownProps) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
