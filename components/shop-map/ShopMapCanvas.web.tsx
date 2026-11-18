import { useEffect, useMemo, useRef } from 'react';
import { shopMapDocument } from '@/lib/shop-map-document';
import type { ShopMapCanvasProps } from './types';

export default function ShopMapCanvas({ shops, location, onSelect, onError }: ShopMapCanvasProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const callbacks = useRef({ onSelect, onError });
  callbacks.current = { onSelect, onError };
  const html = useMemo(() => shopMapDocument(shops, location), [shops, location]);
  useEffect(() => {
    let ready = false;
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ready') ready = true;
        if (data.type === 'select' && shops.some(shop => shop.id === data.id)) callbacks.current.onSelect(data.id);
        if (data.type === 'error' && typeof data.message === 'string') callbacks.current.onError(data.message);
      } catch { /* Ignore unrelated browser messages. */ }
    };
    window.addEventListener('message', listener);
    const timeout = setTimeout(() => { if (!ready) callbacks.current.onError('The map is taking too long to load. Use the shop list or try again.'); }, 15000);
    return () => { window.removeEventListener('message', listener); clearTimeout(timeout); };
  }, [html, shops]);
  return <iframe ref={frame} title="Map of registered UniLink shops" srcDoc={html}
    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />;
}
