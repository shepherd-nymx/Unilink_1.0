import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { TermsAndConditions } from '@/components/TermsAndConditions';
import { useTheme } from '@/contexts/ThemeContext';

export default function ShopTermsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [termsContent, setTermsContent] = useState('');
  const [termsVersion, setTermsVersion] = useState('');
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      const { data, error: termsErr } = await supabase
        .from('merchant_policies')
        .select('version, content')
        .eq('is_active', true)
        .maybeSingle();

      if (termsErr || !data) throw termsErr || new Error('No active merchant policy found');

      setTermsContent(data.content || '');
      setTermsVersion(data.version);

      if (params.shopId) {
        setShopId(params.shopId as string);
      }
    } catch {
      Alert.alert('Error', 'Failed to load Merchant Terms & Conditions');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!shopId) return;

    setLoading(true);

    try {
      const { data: shop } = await supabase
        .from('shops')
        .select('owner_id')
        .eq('id', shopId)
        .maybeSingle();

      const { error: updateError } = await supabase
        .from('shops')
        .update({
          terms_accepted: true,
          terms_version: termsVersion,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', shopId);

      if (updateError) throw updateError;

      if (shop?.owner_id) {
        await supabase.from('terms_acceptance_log').insert({
          user_id: shop.owner_id,
          user_type: 'shop',
          terms_version: termsVersion,
        });
      }

      router.replace('/shop/dashboard');
    } catch {
      Alert.alert('Error', 'Failed to accept Terms & Conditions');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Terms Required',
      'You must accept the Merchant Terms & Conditions to use UniLink. You will be logged out.',
      [
        { text: 'Review Again', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => router.replace('/shop/login'),
        },
      ]
    );
  };

  if (loading && !termsContent) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading Merchant Terms & Conditions...
        </Text>
      </View>
    );
  }

  return (
    <TermsAndConditions
      visible={true}
      onAccept={handleAccept}
      onDecline={handleDecline}
      userType="shop"
      termsContent={termsContent}
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
