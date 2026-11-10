import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Clock, CircleCheck, CircleAlert } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { driverIdentityProfile, type DriverIdentityProfile } from '@/lib/driver-identity';
import { SkeletonGroup, SkeletonBlock } from '@/components/Skeleton';
export default function DriverApplicationStatus() {
 const router=useRouter();const [profile,setProfile]=useState<DriverIdentityProfile|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useFocusEffect(useCallback(()=>{let alive=true;setLoading(true);setError('');void driverIdentityProfile().then(p=>{if(!alive)return;if(!p){router.replace('/driver/register');return;}setProfile(p);}).catch(()=>{if(alive)setError('Your application could not be checked. Sign in again or retry.');}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[router,retry]));
 if(loading)return <View accessibilityRole="progressbar" accessibilityLabel="Checking application status" style={{flex:1,justifyContent:'center',padding:28,backgroundColor:'#060c18'}}><SkeletonGroup color="#24364d"><View style={{gap:20}}><SkeletonBlock width={48} height={48} borderRadius={24}/><SkeletonBlock width="80%" height={25}/><SkeletonBlock width="95%" height={14}/><SkeletonBlock width="89%" height={14}/><SkeletonBlock width="70%" height={14}/><SkeletonBlock width={180} height={18}/><SkeletonBlock width={130} height={18}/></View></SkeletonGroup></View>;
 const approved=profile?.approval_status==='approved', rejected=profile?.approval_status==='rejected';const Icon=approved?CircleCheck:rejected?CircleAlert:Clock;
 return <View style={{flex:1,justifyContent:'center',padding:28,backgroundColor:'#060c18',gap:20}}>
  <Icon size={48} color="#00e5ff"/>
  <Text style={{color:'#e8f4ff',fontSize:25,fontWeight:'800'}}>{error?'Check your application':approved?'Application approved':rejected?'Application not approved':'Awaiting admin approval'}</Text>
  <Text accessibilityRole={error?'alert':undefined} style={{color:'#9eb6cf',fontSize:15,lineHeight:24}}>{error|| (approved?'Your application has been approved. Use the monthly access key issued by admin to sign in.':rejected?'Contact UNILINK support for help with your application.':'Your details have been submitted for review. You can sign in as a driver after admin approval and receiving your monthly access key.')}</Text>
  <TouchableOpacity accessibilityRole="button" onPress={()=>setRetry(n=>n+1)}><Text style={{color:'#00e5ff',fontWeight:'700'}}>Refresh application status</Text></TouchableOpacity>
  <TouchableOpacity accessibilityRole="button" onPress={async()=>{await supabase.auth.signOut({scope:'local'});router.replace('/driver/login');}}><Text style={{color:'#00e5ff',fontWeight:'700'}}>Back to driver login</Text></TouchableOpacity>
 </View>;
}
