import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { MessageCircle } from 'lucide-react-native';

type Props = {
  unreadCount: number;
  iconColor: string;
  badgeColor?: string;
  size?: number;
};

export default function AnimatedChatIcon({ unreadCount, iconColor, badgeColor = '#ef4444', size = 24 }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const badgeBounce = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > 0) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );

      const ringLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 2.2, duration: 900, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );

      pulseLoop.start();
      ringLoop.start();

      return () => {
        pulseLoop.stop();
        ringLoop.stop();
      };
    } else {
      Animated.parallel([
        Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [unreadCount > 0]);

  useEffect(() => {
    if (unreadCount > prevCount.current) {
      Animated.sequence([
        Animated.spring(badgeBounce, { toValue: 1.5, useNativeDriver: true, tension: 300, friction: 5 }),
        Animated.spring(badgeBounce, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
      ]).start();
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size + 16,
            height: size + 16,
            borderRadius: (size + 16) / 2,
            borderColor: iconColor,
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <MessageCircle size={size} color={unreadCount > 0 ? iconColor : iconColor} />
      </Animated.View>

      {unreadCount > 0 && (
        <Animated.View
          style={[
            styles.badge,
            {
              backgroundColor: badgeColor,
              transform: [{ scale: badgeBounce }],
              shadowColor: badgeColor,
            },
          ]}
        >
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -9,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#030810',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 6,
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
