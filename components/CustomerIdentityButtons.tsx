import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { customerCallbackUrl } from '@/lib/customer-identity';

export function CustomerIdentityButtons() {
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
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue with Google" disabled={busy} onPress={()=>run(true)} style={{padding:14,borderRadius:12,backgroundColor:'#1A73E8',alignItems:'center'}}><Text style={{color:'white',fontWeight:'700'}}>Continue with Google</Text></TouchableOpacity>
    <TextInput accessibilityLabel="Email for sign in" placeholder="you@example.com" placeholderTextColor="#64748b" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} style={{padding:14,borderWidth:1,borderColor:'#94a3b8',borderRadius:12,color:'#0f172a',backgroundColor:'white'}}/>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>run(false)} style={{padding:14,borderRadius:12,backgroundColor:'#e8f0fe',alignItems:'center'}}><Text style={{color:'#174ea6',fontWeight:'700'}}>Email me a sign-in link</Text></TouchableOpacity>
    {busy?<ActivityIndicator color="#1A73E8"/>:null}
    {message?<Text accessibilityRole={failed?'alert':undefined} style={{color:failed?'#dc2626':'#15803d'}}>{message}</Text>:null}
  </View>;
}
