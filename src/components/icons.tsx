import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" />
    </Icon>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Icon>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 4a2.5 2.5 0 0 0-2.5 2.5A2.5 2.5 0 0 0 5 9a2.5 2.5 0 0 0 1 4 2.5 2.5 0 0 0 2.5 3.5A2 2 0 0 0 12 18.5V5.5A1.5 1.5 0 0 0 10.5 4Z" />
      <path d="M14.5 4A2.5 2.5 0 0 1 17 6.5 2.5 2.5 0 0 1 19 9a2.5 2.5 0 0 1-1 4 2.5 2.5 0 0 1-2.5 3.5A2 2 0 0 1 12 18.5" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
    </Icon>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}

export function WrenchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.5 7a3.5 3.5 0 0 1-4.6 4.3L5 17.2 6.8 19l5.9-5.9A3.5 3.5 0 0 0 17 8.5a3.5 3.5 0 0 0-1-2.5l-2 2-1.8-.2-.2-1.8 2-2A3.5 3.5 0 0 0 15.5 7Z" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9.5v4.5M12 17.2v.2" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5 10 17l9-10" />
    </Icon>
  );
}
