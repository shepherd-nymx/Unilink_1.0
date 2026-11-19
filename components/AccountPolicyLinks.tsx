import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function AccountPolicyLinks({ lightBackground = false }: { lightBackground?: boolean }) {
 const router=useRouter(),{isDark}=useTheme();
 const color=isDark && !lightBackground?'#a8caff':'#174ea6';
 return <View style={{padding:16,gap:12,marginVertical:8}}>
  <TouchableOpacity accessibilityRole="link" onPress={()=>router.push('/privacy-policy')}><Text style={{color,fontSize:14}}>Privacy policy</Text></TouchableOpacity>
  <TouchableOpacity accessibilityRole="link" onPress={()=>router.push('/delete-account')}><Text style={{color,fontSize:14}}>Request account deletion</Text></TouchableOpacity>
 </View>;
}
