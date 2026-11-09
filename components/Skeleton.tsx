import { AccessibilityInfo, Animated, DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const PulseContext = createContext<Animated.Value | null>(null);
const ColorContext = createContext<string | undefined>(undefined);

function usePulse(enabled: boolean) {
  const opacity = useRef(new Animated.Value(0.7)).current;
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReducedMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; listener.remove(); };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || reducedMotion) { opacity.setValue(0.7); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 850, useNativeDriver: true, isInteraction: false }),
      Animated.timing(opacity, { toValue: 0.55, duration: 850, useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [enabled, reducedMotion, opacity]);
  return opacity;
}

// All blocks on one page share a single pulse instead of running dozens of loops.
export function SkeletonGroup({ children, color }: { children: ReactNode; color?: string }) {
  const pulse = usePulse(true);
  return <PulseContext.Provider value={pulse}><ColorContext.Provider value={color}>{children}</ColorContext.Provider></PulseContext.Provider>;
}

export function SkeletonBlock({ width = '100%', height = 16, borderRadius = 6, style }: {
  width?: DimensionValue; height?: DimensionValue; borderRadius?: number; style?: StyleProp<ViewStyle>;
}) {
  const shared = useContext(PulseContext);
  const sharedColor = useContext(ColorContext);
  const local = usePulse(!shared);
  const { isDark } = useTheme();
  return <Animated.View accessible={false} importantForAccessibility="no" style={[
    { width, height, borderRadius, backgroundColor: sharedColor || (isDark ? '#24364d' : '#e2e9f3'), opacity: shared || local }, style,
  ]}/>;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { isDark } = useTheme();
  return <View style={[styles.card, { backgroundColor: isDark ? '#0d1b2e' : '#fff', borderColor: isDark ? '#24364d' : '#e2e8f0' }]}>
    <View style={styles.row}><SkeletonBlock width={48} height={48} borderRadius={24}/><View style={{ flex: 1, gap: 7 }}><SkeletonBlock width="60%" height={14}/><SkeletonBlock width="40%" height={12}/></View></View>
    <View style={{ gap: 8, marginTop: 12 }}>{Array.from({ length: lines }, (_, i) => <SkeletonBlock key={i} width={i === lines - 1 ? '70%' : '100%'} height={12}/>)}</View>
  </View>;
}

export function SkeletonList({ count = 5, lines = 3 }: { count?: number; lines?: number }) {
  return <SkeletonGroup><View style={{ gap: 12, padding: 16 }}>{Array.from({ length: count }, (_, i) => <SkeletonCard key={i} lines={lines}/>)}</View></SkeletonGroup>;
}
const styles = StyleSheet.create({ card: { borderRadius: 14, padding: 16, borderWidth: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 } });

export function SkeletonField({ dark = false, label = 'Loading choices' }: { dark?: boolean; label?: string }) {
  const { isDark } = useTheme();
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
    <SkeletonGroup color={dark || isDark ? '#24364d' : '#e2e9f3'}><SkeletonBlock height={48} borderRadius={12}/></SkeletonGroup>
  </View>;
}
