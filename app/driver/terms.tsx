import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { TermsAndConditions } from '@/components/TermsAndConditions';
import { useTheme } from '@/contexts/ThemeContext';

export default function DriverTermsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [termsContent, setTermsContent] = useState('');
  const [privacyContent, setPrivacyContent] = useState('');
  const [termsVersion, setTermsVersion] = useState('');
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    fetchTermsAndDriver();
  }, []);

  const fetchTermsAndDriver = async () => {
    try {
      const { data: termsData, error: termsError } = await supabase
        .from('terms_and_conditions')
        .select('version, content, privacy_policy')
        .eq('is_active', true)
        .single();

      if (termsError) throw termsError;

      setTermsContent(termsData.content);
      setPrivacyContent(termsData.privacy_policy || '');
      setTermsVersion(termsData.version);

      if (params.driverId) {
        setDriverId(params.driverId as string);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load Terms & Conditions');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!driverId) return;

    setLoading(true);

    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('user_id')
        .eq('id', driverId)
        .single();

      const { error: updateError } = await supabase
        .from('drivers')
        .update({
          terms_accepted: true,
          terms_version: termsVersion,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', driverId);

      if (updateError) throw updateError;

      if (driver?.user_id) {
        await supabase.from('terms_acceptance_log').insert({
          user_id: driver.user_id,
          user_type: 'driver',
          terms_version: termsVersion,
        });
      }

      router.replace('/driver/dashboard');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to accept Terms & Conditions');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Terms Required',
      'You must accept the Terms & Conditions to use the driver platform. You will be logged out.',
      [
        {
          text: 'Review Again',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => router.replace('/driver/login'),
        },
      ]
    );
  };

  if (loading && !termsContent) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading Terms & Conditions...
        </Text>
      </View>
    );
  }

  return (
    <TermsAndConditions
      visible={true}
      onAccept={handleAccept}
      onDecline={handleDecline}
      userType="driver"
      termsContent={termsContent}
      privacyContent={privacyContent}
      loading={loading}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
