import { useEffect, useRef } from 'react';

export function useEnterKey(callback) {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Enter') return;
      if (e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      ref.current();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}
