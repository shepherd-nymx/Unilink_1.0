import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { nativeIdentityReturnUrl } from '@/lib/identity-links';

export default function NativeIdentityReturn() {
  const [destination] = useState(() => nativeIdentityReturnUrl(window.location.href));
  const [message, setMessage] = useState('');
  const openApp = () => {
    if (!destination) return;
    try {
      window.location.assign(destination);
    } catch {
      setMessage('Tap the button below to open UniLink.');
    }
  };

  useEffect(() => {
    if (!destination || !/Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)) return;
    // Chrome may require a user gesture; keep the same handoff available below.
    const timer = setTimeout(() => {
      try { window.location.assign(destination); } catch { /* Use the button. */ }
    }, 100);
    return () => clearTimeout(timer);
  }, [destination]);

  return <View style={{ flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#f0f4ff', gap: 20 }}>
    <Text style={{ color: '#0a1628', fontSize: 28, fontWeight: '800' }}>UNILINK</Text>
    <Text style={{ color: '#334155', fontSize: 17 }}>
      {destination ? 'Return to the UniLink app to finish signing in.' : 'This sign-in link is incomplete. Please start sign-in again from the UniLink app.'}
    </Text>
    {!!message && <Text accessibilityRole="alert" style={{ color: '#334155' }}>{message}</Text>}
    {destination && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Return to UniLink app" onPress={openApp}
      style={{ backgroundColor: '#1A73E8', minHeight: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', padding: 14 }}>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Open UniLink app</Text>
    </TouchableOpacity>}
  </View>;
}
