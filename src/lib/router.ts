// Minimal hash router.
import { useSyncExternalStore } from 'react';

function current() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return h.startsWith('/') ? h : `/${h}`;
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute() {
  const path = useSyncExternalStore(subscribe, current);
  const parts = path.split('?')[0].split('/').filter(Boolean);
  const query = new URLSearchParams(path.split('?')[1] ?? '');
  return { path, parts, query };
}

export function navigate(path: string) {
  if (current() === path) return;
  window.location.hash = path;
}

export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}
