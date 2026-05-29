import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './IconButton.module.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name; rendered as the tooltip/title too. */
  label: string;
  children: ReactNode;
  /** Render the visible text label alongside the icon. */
  showLabel?: boolean;
}

export function IconButton({
  label,
  children,
  showLabel = false,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={[styles.button, showLabel ? styles.label : '', className ?? ''].join(' ')}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}
