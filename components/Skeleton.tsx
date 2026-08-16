import { View, StyleSheet, Platform } from 'react-native';
import { Animated } from 'react-native';
import { useEffect, useRef } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

export function SkeletonBlock({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#E2E8F0' },
        { opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonBlock width={48} height={48} borderRadius={24} />
        <View style={{ flex: 1, gap: 6, marginLeft: 12 }}>
          <SkeletonBlock width="60%" height={14} />
          <SkeletonBlock width="40%" height={12} />
        </View>
      </View>
      <View style={{ gap: 8, marginTop: 12 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} width={i === lines - 1 ? '70%' : '100%'} height={12} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonList({ count = 5, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } : { elevation: 2 }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
