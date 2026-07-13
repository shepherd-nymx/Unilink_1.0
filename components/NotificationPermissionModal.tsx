import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/contexts/NotificationContext';

const ASKED_KEY = 'notif_permission_asked_v1';

async function getHasAsked(): Promise<boolean> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(ASKED_KEY) === 'true'; } catch { return false; }
  }
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    const val = await mod.default.getItem(ASKED_KEY);
    return val === 'true';
  } catch { return false; }
}

async function markAsked(): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(ASKED_KEY, 'true'); } catch {}
    return;
  }
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    await mod.default.setItem(ASKED_KEY, 'true');
  } catch {}
}

interface NotificationPermissionModalProps {
  userType: 'driver' | 'customer';
}

export default function NotificationPermissionModal({ userType }: NotificationPermissionModalProps) {
  const { colors } = useTheme();
  const { hasNotificationPermission, requestNotificationPermission } = useNotifications();
  const [showModal, setShowModal] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (hasNotificationPermission || checked) return;
    getHasAsked().then((asked) => {
      setChecked(true);
      if (!asked) {
        setTimeout(() => setShowModal(true), 1200);
      }
    });
  }, [hasNotificationPermission, checked]);

  const handleAllow = async () => {
    setShowModal(false);
    await markAsked();
    await requestNotificationPermission();
  };

  const handleDismiss = async () => {
    setShowModal(false);
    await markAsked();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    container: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      padding: 4,
      zIndex: 1,
    },
    iconContainer: { alignItems: 'center', marginBottom: 20 },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 8,
    },
    benefitsList: { marginTop: 16, marginBottom: 24, gap: 12 },
    benefitItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    benefitBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginTop: 7,
    },
    benefitText: { flex: 1, fontSize: 14, color: colors.textTertiary, lineHeight: 20 },
    buttonContainer: { gap: 12 },
    allowButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 10,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    allowButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    dismissButton: { paddingVertical: 12, alignItems: 'center' },
    dismissButtonText: { fontSize: 14, color: colors.textTertiary, fontWeight: '500' },
  });

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
            <X size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Bell size={40} color={colors.primary} />
            </View>
            <Text style={styles.title}>Enable Notifications</Text>
            <Text style={styles.description}>
              Stay updated with real-time notifications
            </Text>
          </View>

          <View style={styles.benefitsList}>
            {userType === 'driver' ? (
              <>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitBullet} />
                  <Text style={styles.benefitText}>
                    Get notified instantly when new delivery orders arrive — even when the app is closed
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitBullet} />
                  <Text style={styles.benefitText}>
                    Receive messages from customers immediately
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitBullet} />
                  <Text style={styles.benefitText}>
                    Never miss an opportunity to earn
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitBullet} />
                  <Text style={styles.benefitText}>
                    Know immediately when a driver accepts your order
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitBullet} />
                  <Text style={styles.benefitText}>
                    Get alerts if your order is declined so you can choose another driver
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitBullet} />
                  <Text style={styles.benefitText}>
                    Receive delivery updates and messages from your driver
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.allowButton} onPress={handleAllow}>
              <Bell size={20} color="#fff" />
              <Text style={styles.allowButtonText}>Allow Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
              <Text style={styles.dismissButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
