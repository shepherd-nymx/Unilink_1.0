import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { supabase } from '@/lib/supabase';
import { customerCallbackUrl } from '@/lib/customer-identity';

// Google G artwork from Google's FirebaseUI assets (Copyright Google Inc.).
function GoogleMark() {
  return <Svg width={20} height={20} viewBox="0 0 120 120" accessible={false} style={{ flexShrink: 0 }}>
    <Path fill="#4285F4" d="M117.6,61.3636364 C117.6,57.1090909 117.218182,53.0181818 116.509091,49.0909091 L60,49.0909091 L60,72.3 L92.2909091,72.3 C90.9,79.8 86.6727273,86.1545455 80.3181818,90.4090909 L80.3181818,105.463636 L99.7090909,105.463636 C111.054545,95.0181818 117.6,79.6363636 117.6,61.3636364 L117.6,61.3636364 Z"/>
    <Path fill="#34A853" d="M60,120 C76.2,120 89.7818182,114.627273 99.7090909,105.463636 L80.3181818,90.4090909 C74.9454545,94.0090909 68.0727273,96.1363636 60,96.1363636 C44.3727273,96.1363636 31.1454545,85.5818182 26.4272727,71.4 L6.38181818,71.4 L6.38181818,86.9454545 C16.2545455,106.554545 36.5454545,120 60,120 L60,120 Z"/>
    <Path fill="#FBBC05" d="M26.4272727,71.4 C25.2272727,67.8 24.5454545,63.9545455 24.5454545,60 C24.5454545,56.0454545 25.2272727,52.2 26.4272727,48.6 L26.4272727,33.0545455 L6.38181818,33.0545455 C2.31818182,41.1545455 0,50.3181818 0,60 C0,69.6818182 2.31818182,78.8454545 6.38181818,86.9454545 L26.4272727,71.4 L26.4272727,71.4 Z"/>
    <Path fill="#EA4335" d="M60,23.8636364 C68.8090909,23.8636364 76.7181818,26.8909091 82.9363636,32.8363636 L100.145455,15.6272727 C89.7545455,5.94545455 76.1727273,0 60,0 C36.5454545,0 16.2545455,13.4454545 6.38181818,33.0545455 L26.4272727,48.6 C31.1454545,34.4181818 44.3727273,23.8636364 60,23.8636364 L60,23.8636364 Z"/>
  </Svg>;
}

export function CustomerIdentityButtons() {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [email,setEmail]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  const run=async (google:boolean)=>{
    setMessage('');setFailed(false);
    if(!google&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setFailed(true);setMessage('Enter a valid email address.');return;}
    setBusy(true);
    try{
      const result=google
        ? await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:customerCallbackUrl()}})
        : await supabase.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{emailRedirectTo:customerCallbackUrl(),shouldCreateUser:true}});
      if(result.error)throw result.error;
      if(!google)setMessage('Check your email for the sign-in link. Open it on this device to continue.');
    }catch(e:any){setFailed(true);setMessage(e.message||'Sign-in could not start. Please try again.');}
    finally{setBusy(false);}
  };
  return <View style={{gap:12,marginVertical:16}}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue with Google" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={()=>run(true)}
      style={{ minHeight: 50, paddingHorizontal: compact ? 12 : 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e3e3e3', backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: compact ? 12 : 16, opacity: busy ? 0.65 : 1 }}>
      <GoogleMark/>
      <Text style={{ color: '#1f1f1f', fontSize: compact ? 16 : 17, fontWeight: '400' }}>Continue with Google</Text>
    </TouchableOpacity>
    <TextInput accessibilityLabel="Email for sign in" placeholder="you@example.com" placeholderTextColor="#64748b" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} style={{padding:14,borderWidth:1,borderColor:'#94a3b8',borderRadius:12,color:'#0f172a',backgroundColor:'white'}}/>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>run(false)} style={{padding:14,borderRadius:12,backgroundColor:'#e8f0fe',alignItems:'center'}}><Text style={{color:'#174ea6',fontWeight:'700'}}>Email me a sign-in link</Text></TouchableOpacity>
    {busy?<ActivityIndicator color="#1A73E8"/>:null}
    {message?<Text accessibilityRole={failed?'alert':undefined} style={{color:failed?'#dc2626':'#15803d'}}>{message}</Text>:null}
  </View>;
}
