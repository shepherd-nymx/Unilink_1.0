import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Bike, Check, RefreshCw, Star, User } from 'lucide-react-native';
import { ThemePalette } from './types';
import { MessengerOption, formatDistance } from '@/lib/messenger-selection';
import { fetchMessengersByDistance } from '@/lib/messenger-service';

type Props = {
  palette: ThemePalette;
  shopId: string;
  shopName: string;
  customerLatitude: number | null;
  customerLongitude: number | null;
  selectedMessengerId: string | null;
  onSelect: (messengerId: string | null) => void;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; options: MessengerOption[] }
  | { status: 'error'; message: string };

export function MessengerPicker({
  palette, shopId, shopName, customerLatitude, customerLongitude, selectedMessengerId, onSelect,
}: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestIdRef = useRef(0);
  const selectionRef = useRef({ selectedMessengerId, onSelect });
  selectionRef.current = { selectedMessengerId, onSelect };
  const hasCoordinates = customerLatitude != null && customerLongitude != null;

  const load = useCallback(async () => {
    if (customerLatitude == null || customerLongitude == null) return;
    const requestId = ++requestIdRef.current;
    setState({ status: 'loading' });
    try {
      const options = await fetchMessengersByDistance(shopId, customerLatitude, customerLongitude);
      if (requestId !== requestIdRef.current) return;
      setState({ status: 'ready', options });
      const { selectedMessengerId: current, onSelect: select } = selectionRef.current;
      if (current && !options.some(o => o.id === current)) {
        select(null);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not load messengers. Please try again.',
      });
    }
  }, [shopId, customerLatitude, customerLongitude]);

  useEffect(() => {
    if (hasCoordinates) load();
  }, [hasCoordinates, load]);

  const header = (
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>Choose a messenger</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{shopName} - optional</Text>
      </View>
      {hasCoordinates ? (
        <TouchableOpacity
          onPress={load}
          disabled={state.status === 'loading'}
          style={[styles.refreshButton, { borderColor: palette.cardBorder }]}
          accessibilityLabel="Refresh messengers"
        >
          <RefreshCw size={16} color={palette.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (!hasCoordinates) {
    return (
      <View style={[styles.container, { backgroundColor: palette.inputBg, borderColor: palette.cardBorder }]}>
        {header}
        <Text style={[styles.message, { color: palette.textSecondary }]}>
          Messenger distances need a GPS-pinned delivery location. Use your current location or a saved address to see messengers near you. Otherwise the shop will assign one.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.inputBg, borderColor: palette.cardBorder }]}>
      {header}

      {state.status === 'loading' ? (
        <View style={styles.centerRow}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={[styles.message, { color: palette.textSecondary }]}>Finding messengers near you...</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={[styles.errorBox, { borderColor: palette.error, backgroundColor: `${palette.error}10` }]}>
          <Text style={[styles.message, { color: palette.error }]}>{state.message}</Text>
          <TouchableOpacity onPress={load} accessibilityLabel="Try again">
            <Text style={[styles.retryText, { color: palette.primary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {state.status === 'ready' && state.options.length === 0 ? (
        <View style={styles.centerRow}>
          <Bike size={18} color={palette.textSecondary} />
          <Text style={[styles.message, { color: palette.textSecondary }]}>
            No messengers are available for this shop right now. The shop will assign one.
          </Text>
        </View>
      ) : null}

      {state.status === 'ready' && state.options.length > 0 ? (
        <View style={{ gap: 8 }}>
          {state.options.map((option, index) => {
            const selected = option.id === selectedMessengerId;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => onSelect(selected ? null : option.id)}
                style={[
                  styles.option,
                  { backgroundColor: palette.cardBg, borderColor: selected ? palette.primary : palette.cardBorder },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                {option.profilePictureUrl ? (
                  <Image source={{ uri: option.profilePictureUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: palette.inputBorder }]}>
                    <User size={18} color={palette.textSecondary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: palette.textPrimary }]} numberOfLines={1}>{option.fullName}</Text>
                    {index === 0 ? (
                      <View style={[styles.nearestBadge, { backgroundColor: `${palette.success}20` }]}>
                        <Text style={[styles.nearestText, { color: palette.success }]}>Nearest</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={[styles.meta, { color: palette.textSecondary }]}>{formatDistance(option.distanceKm)}</Text>
                    {option.averageRating > 0 ? (
                      <View style={styles.ratingRow}>
                        <Star size={12} color={palette.warning} fill={palette.warning} />
                        <Text style={[styles.meta, { color: palette.textSecondary }]}>{option.averageRating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                    {option.vehicleType ? (
                      <Text style={[styles.meta, { color: palette.textSecondary }]}>{option.vehicleType}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.checkCircle, { borderColor: selected ? palette.primary : palette.cardBorder, backgroundColor: selected ? palette.primary : 'transparent' }]}>
                  {selected ? <Check size={14} color={palette.cardBg} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            Distances are calculated from your delivery location. Your exact location is not shared with messengers.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  refreshButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  message: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 6 },
  retryText: { fontSize: 12, fontWeight: '600' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 10, padding: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  nearestBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  nearestText: { fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  meta: { fontSize: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  hint: { fontSize: 11, lineHeight: 16 },
});
