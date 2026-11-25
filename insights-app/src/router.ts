import { useEffect, useState } from 'react';
import type { ChannelId } from './types';

export type Route =
  | { name: 'home' }
  | { name: 'about' }
  | { name: 'learn' }
  | { name: 'consent' }
  | { name: 'hub'; id: string }
  | { name: 'channel'; id: string; channel: ChannelId }
  | { name: 'quest'; id: string; which: 'ipip' | 'riasec' }
  | { name: 'analyze'; id: string }
  | { name: 'report'; id: string };

const CHANNEL_IDS: ChannelId[] = ['palmLeft', 'palmRight', 'handwriting', 'drawingTree', 'drawingPerson'];

export function parse(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (p[0] === 'about') return { name: 'about' };
  if (p[0] === 'learn') return { name: 'learn' };
  if (p[0] === 'consent') return { name: 'consent' };
  if (p[0] === 's' && p[1]) {
    const id = p[1];
    if (p[2] === 'c' && CHANNEL_IDS.includes(p[3] as ChannelId)) return { name: 'channel', id, channel: p[3] as ChannelId };
    if (p[2] === 'q' && (p[3] === 'ipip' || p[3] === 'riasec')) return { name: 'quest', id, which: p[3] };
    if (p[2] === 'analyze') return { name: 'analyze', id };
    if (p[2] === 'report') return { name: 'report', id };
    return { name: 'hub', id };
  }
  return { name: 'home' };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'about':
      return '#/about';
    case 'learn':
      return '#/learn';
    case 'consent':
      return '#/consent';
    case 'hub':
      return `#/s/${r.id}`;
    case 'channel':
      return `#/s/${r.id}/c/${r.channel}`;
    case 'quest':
      return `#/s/${r.id}/q/${r.which}`;
    case 'analyze':
      return `#/s/${r.id}/analyze`;
    case 'report':
      return `#/s/${r.id}/report`;
  }
}

export const go = (r: Route) => {
  window.location.hash = href(r);
  window.scrollTo({ top: 0 });
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const h = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}
