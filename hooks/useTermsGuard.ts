import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

type UserType = 'customer' | 'driver' | 'shop';

export function useTermsGuard(userType: UserType) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isChecking, setIsChecking] = useState(true);
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    checkTermsAcceptance();
  }, []);

  const checkTermsAcceptance = async () => {
    try {
      const userId =
        userType === 'customer' ? params.customerId
        : userType === 'driver' ? params.driverId
        : params.shopId;

      if (!userId) {
        router.replace(`/${userType}/login`);
        return;
      }

      const { data: currentTerms } = await supabase
        .from('terms_and_conditions')
        .select('version')
        .eq('is_active', true)
        .single();

      const tableName =
        userType === 'customer' ? 'customers'
        : userType === 'driver' ? 'drivers'
        : 'shops';
      const { data: userData } = await supabase
        .from(tableName)
        .select('terms_accepted, terms_version')
        .eq('id', userId as string)
        .single();

      if (
        !userData?.terms_accepted ||
        userData.terms_version !== currentTerms?.version
      ) {
        if (userType === 'driver') {
          router.replace({
            pathname: '/driver/terms',
            params: { driverId: userId as string },
          });
        } else if (userType === 'shop') {
          router.replace({
            pathname: '/shop/terms',
            params: { shopId: userId as string },
          });
        } else {
          router.replace({
            pathname: '/customer/terms',
            params: { customerId: userId as string },
          });
        }
        return;
      }

      setIsAccepted(true);
    } catch (error) {
      console.error('Error checking terms acceptance:', error);
      router.replace(`/${userType}/login`);
    } finally {
      setIsChecking(false);
    }
  };

  return { isChecking, isAccepted };
}
