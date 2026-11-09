import PageSkeleton from '@/components/PageSkeleton';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { TermsAndConditions } from '@/components/TermsAndConditions';
import { useTheme } from '@/contexts/ThemeContext';

export default function CustomerTermsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [termsContent, setTermsContent] = useState('');
  const [privacyContent, setPrivacyContent] = useState('');
  const [termsVersion, setTermsVersion] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
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

      if (params.customerId) {
        setCustomerId(params.customerId as string);
      }
    } catch {
      Alert.alert('Error', 'Failed to load Terms & Conditions');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!customerId) return;

    setLoading(true);

    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('user_id')
        .eq('id', customerId)
        .maybeSingle();

      const { error: updateError } = await supabase
        .from('customers')
        .update({
          terms_accepted: true,
          terms_version: termsVersion,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      if (updateError) throw updateError;

      if (customer?.user_id) {
        await supabase.from('terms_acceptance_log').insert({
          user_id: customer.user_id,
          user_type: 'customer',
          terms_version: termsVersion,
        });
      }

      router.replace({
        pathname: '/customer/dashboard',
        params: { customerId },
      });
    } catch {
      Alert.alert('Error', 'Failed to accept Terms & Conditions');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Terms Required',
      'You must accept the Terms & Conditions to use UniLink. You will be logged out.',
      [
        { text: 'Review Again', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => router.replace('/customer/login'),
        },
      ]
    );
  };

  if (loading && !termsContent) {
    return <PageSkeleton page="customer/terms"/>;
  }

  return (
    <TermsAndConditions
      visible={true}
      onAccept={handleAccept}
      onDecline={handleDecline}
      userType="customer"
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
