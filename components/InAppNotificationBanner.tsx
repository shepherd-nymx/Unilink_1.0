import { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MessageSquare, X } from 'lucide-react-native';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  onPress?: () => void;
  onDismiss?: () => void;
};

export default function InAppNotificationBanner({ visible, title, body, onPress, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: false }),
          Animated.timing(shimmer, { toValue: 0, duration: 1200, useNativeDriver: false }),
        ])
      );
      shimmerLoop.start();

      const timer = setTimeout(() => {
        dismiss();
      }, 5000);

      return () => {
        clearTimeout(timer);
        shimmerLoop.stop();
      };
    } else {
      dismiss();
    }
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const borderColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,229,255,0.3)', 'rgba(0,229,255,0.9)'],
  });

  const glowOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.45],
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <Animated.View style={[styles.container, { borderColor }]}>
        <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

        <TouchableOpacity
          style={styles.content}
          onPress={() => { dismiss(); onPress?.(); }}
          activeOpacity={0.9}
        >
          <View style={styles.iconWrap}>
            <MessageSquare size={20} color="#00e5ff" />
            <View style={styles.iconDot} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.body} numberOfLines={2}>{body}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.8}>
          <X size={14} color="rgba(0,229,255,0.6)" />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 12 : 48,
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  container: {
    backgroundColor: '#060f1e',
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  glow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,229,255,0.08)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,229,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00ff88',
    borderWidth: 2,
    borderColor: '#060f1e',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d0eaff',
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 12,
    color: '#4a7a9b',
    lineHeight: 17,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,229,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
