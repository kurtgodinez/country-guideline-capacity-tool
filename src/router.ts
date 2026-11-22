import { useSyncExternalStore } from 'react';

export type AssessmentScreen = 'workspace' | 'profile' | 'strategy' | 'reconcile' | 'report';
export const ASSESSMENT_SCREENS: AssessmentScreen[] = ['workspace', 'profile', 'strategy', 'reconcile', 'report'];

export type Route =
  | { name: 'home' }
  | { name: 'framework' }
  | { name: 'compare' }
  | { name: 'assessment'; screen: AssessmentScreen; id: string }
  | { name: 'notfound'; path: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\?.*$/, '') || '/';
  if (path === '/' || path === '') return { name: 'home' };
  if (path === '/framework') return { name: 'framework' };
  if (path === '/compare') return { name: 'compare' };
  const m = /^\/a\/([^/]+)\/([a-z]+)$/.exec(path);
  if (m && (ASSESSMENT_SCREENS as string[]).includes(m[2]))
    return { name: 'assessment', screen: m[2] as AssessmentScreen, id: decodeURIComponent(m[1]) };
  return { name: 'notfound', path };
}

/** Hash paths for links: href={paths.workspace(id)} gives "#/a/<id>/workspace". */
export const paths = {
  home: () => '#/',
  framework: () => '#/framework',
  compare: () => '#/compare',
  assessment: (id: string, screen: AssessmentScreen) => `#/a/${encodeURIComponent(id)}/${screen}`,
};

/** navigate('/compare') or navigate(paths.compare()); both forms are accepted. */
export function navigate(path: string): void {
  const hash = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return parseHash(hash);
}
