import { useEffect, useMemo, useRef } from 'react';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { shopMapDocument } from '@/lib/shop-map-document';
import type { ShopMapCanvasProps } from './types';

export default function ShopMapCanvas({ shops, location, onSelect, onError }: ShopMapCanvasProps) {
  const ready = useRef(false);
  const html = useMemo(() => { ready.current = false; return shopMapDocument(shops, location); }, [shops, location]);
  useEffect(() => {
    const timeout = setTimeout(() => { if (!ready.current) onError('The map is taking too long to load. Use the shop list.'); }, 15000);
    return () => clearTimeout(timeout);
  }, [html, onError]);
  return <WebView source={{ html, baseUrl: 'https://unilinkbase.com' }} style={{ flex: 1 }}
    originWhitelist={['*']} javaScriptEnabled domStorageEnabled
    userAgent="UniLinkShopMap/1.0 (+https://unilinkbase.com)"
    onShouldStartLoadWithRequest={request => {
      if (request.url === 'about:blank' || request.url === 'https://unilinkbase.com/' || request.url === 'https://unilinkbase.com') return true;
      if (request.url.startsWith('https://www.openstreetmap.org/')) void Linking.openURL(request.url);
      return false;
    }}
    onMessage={event => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'ready') ready.current = true;
        if (data.type === 'select' && shops.some(shop => shop.id === data.id)) onSelect(data.id);
        if (data.type === 'error' && typeof data.message === 'string') onError(data.message);
      } catch { /* Ignore malformed map messages. */ }
    }}
    onError={() => onError('The map could not load. Use the shop list or try again.')} />;
}
