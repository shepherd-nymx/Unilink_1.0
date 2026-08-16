import { View, Text, StyleSheet } from 'react-native';
import { Wifi, WifiOff, Loader } from 'lucide-react-native';

interface ConnectionBadgeProps {
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export function ConnectionBadge({ state }: ConnectionBadgeProps) {
  const config = {
    connecting: { color: '#F59E0B', label: 'Connecting...', icon: Loader },
    connected: { color: '#22C55E', label: 'Live', icon: Wifi },
    disconnected: { color: '#EF4444', label: 'Reconnecting...', icon: WifiOff },
    error: { color: '#EF4444', label: 'Connection error', icon: WifiOff },
  };
  const { color, label, icon: Icon } = config[state] || config.connecting;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}15`, borderColor: `${color}40` }]}>
      <Icon size={11} color={color} strokeWidth={2.5} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
