import { useEffect, useState } from 'react';

function computeCanPoll(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.visibilityState === 'visible' && document.hasFocus();
}

/** True when the page tab is visible and the window has focus. */
export function usePollGate(): boolean {
  const [canPoll, setCanPoll] = useState(computeCanPoll);

  useEffect(() => {
    const update = () => setCanPoll(computeCanPoll());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
    };
  }, []);

  return canPoll;
}
