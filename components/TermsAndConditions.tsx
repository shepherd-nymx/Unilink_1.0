import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle, FileText, Shield } from 'lucide-react-native';

interface TermsAndConditionsProps {
  visible: boolean;
  onAccept: () => void;
  onDecline?: () => void;
  userType: 'customer' | 'driver' | 'shop';
  termsContent?: string;
  privacyContent?: string;
  loading?: boolean;
}

type Tab = 'terms' | 'privacy';

export function TermsAndConditions({
  visible,
  onAccept,
  onDecline,
  userType,
  termsContent,
  privacyContent,
  loading = false,
}: TermsAndConditionsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('terms');
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [privacyScrolled, setPrivacyScrolled] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const termsScrollRef = useRef<ScrollView>(null);
  const privacyScrollRef = useRef<ScrollView>(null);

  const hasPrivacy = !!privacyContent;
  const bothScrolled = hasPrivacy ? termsScrolled && privacyScrolled : termsScrolled;
  const canAccept = isChecked && bothScrolled;

  const handleScroll = (tab: Tab) => (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isAtBottom) {
      if (tab === 'terms') setTermsScrolled(true);
      else setPrivacyScrolled(true);
    }
  };

  const handleAccept = () => {
    if (canAccept) onAccept();
  };

  const activeScrolled = activeTab === 'terms' ? termsScrolled : privacyScrolled;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <AlertCircle size={28} color="#dc2626" />
          <Text style={styles.headerTitle}>Legal Agreement</Text>
          <Text style={styles.headerSubtitle}>Read both documents before accepting</Text>
        </View>

        <View style={styles.warningBanner}>
          <AlertCircle size={18} color="#854d0e" />
          <Text style={styles.warningText}>
            You must read and accept our Terms & Conditions and Privacy Policy to use UniLink.
          </Text>
        </View>

        {hasPrivacy && (
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
              onPress={() => setActiveTab('terms')}
            >
              <FileText
                size={16}
                color={activeTab === 'terms' ? '#1d4ed8' : '#6b7280'}
              />
              <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
                Terms & Conditions
              </Text>
              {termsScrolled && (
                <View style={styles.tabBadge}>
                  <CheckCircle size={12} color="#16a34a" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
              onPress={() => setActiveTab('privacy')}
            >
              <Shield
                size={16}
                color={activeTab === 'privacy' ? '#1d4ed8' : '#6b7280'}
              />
              <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
                Privacy Policy
              </Text>
              {privacyScrolled && (
                <View style={styles.tabBadge}>
                  <CheckCircle size={12} color="#16a34a" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading documents...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'terms' && (
              <ScrollView
                ref={termsScrollRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                onScroll={handleScroll('terms')}
                scrollEventThrottle={16}
              >
                <Text style={styles.documentText}>{termsContent}</Text>
                <View style={styles.endMarker}>
                  <Text style={styles.endMarkerText}>— End of Terms & Conditions —</Text>
                </View>
              </ScrollView>
            )}

            {activeTab === 'privacy' && hasPrivacy && (
              <ScrollView
                ref={privacyScrollRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                onScroll={handleScroll('privacy')}
                scrollEventThrottle={16}
              >
                <Text style={styles.documentText}>{privacyContent}</Text>
                <View style={styles.endMarker}>
                  <Text style={styles.endMarkerText}>— End of Privacy Policy —</Text>
                </View>
              </ScrollView>
            )}

            {!activeScrolled && (
              <View style={styles.scrollHint}>
                <Text style={styles.scrollHintText}>
                  ↓ Scroll to the bottom to mark this document as read ↓
                </Text>
              </View>
            )}

            {hasPrivacy && !bothScrolled && (
              <View style={styles.progressBanner}>
                <Text style={styles.progressText}>
                  {!termsScrolled && !privacyScrolled
                    ? 'Read both documents to continue'
                    : !termsScrolled
                    ? 'Read Terms & Conditions to continue'
                    : 'Read Privacy Policy to continue'}
                </Text>
              </View>
            )}

            <View style={styles.acceptanceSection}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setIsChecked(!isChecked)}
                disabled={!bothScrolled}
              >
                <View
                  style={[
                    styles.checkbox,
                    isChecked && styles.checkboxChecked,
                    !bothScrolled && styles.checkboxDisabled,
                  ]}
                >
                  {isChecked && <CheckCircle size={18} color="#ffffff" />}
                </View>
                <Text
                  style={[
                    styles.checkboxLabel,
                    !bothScrolled && styles.checkboxLabelDisabled,
                  ]}
                >
                  I have read and I agree to the Terms & Conditions and Privacy Policy
                </Text>
              </TouchableOpacity>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.acceptButton, !canAccept && styles.acceptButtonDisabled]}
                  onPress={handleAccept}
                  disabled={!canAccept}
                >
                  <Text
                    style={[
                      styles.acceptButtonText,
                      !canAccept && styles.acceptButtonTextDisabled,
                    ]}
                  >
                    Accept & Continue as {userType === 'customer' ? 'Shopper' : userType === 'driver' ? 'Driver' : 'Merchant'}
                  </Text>
                </TouchableOpacity>

                {onDecline && (
                  <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
                    <Text style={styles.declineButtonText}>Decline & Exit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#fef2f2',
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#fee2e2',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 10,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  warningText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#854d0e',
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1d4ed8',
    backgroundColor: '#eff6ff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#1d4ed8',
  },
  tabBadge: {
    marginLeft: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  documentText: {
    fontSize: 13,
    lineHeight: 22,
    color: '#374151',
  },
  endMarker: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  endMarkerText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  scrollHint: {
    backgroundColor: '#dbeafe',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
  },
  scrollHintText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
  },
  progressBanner: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
  },
  progressText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  acceptanceSection: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 20,
  },
  checkboxLabelDisabled: {
    color: '#9ca3af',
  },
  buttonContainer: {
    gap: 10,
  },
  acceptButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonDisabled: {
    backgroundColor: '#e5e7eb',
    shadowOpacity: 0,
    elevation: 0,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  acceptButtonTextDisabled: {
    color: '#9ca3af',
  },
  declineButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#dc2626',
  },
});
