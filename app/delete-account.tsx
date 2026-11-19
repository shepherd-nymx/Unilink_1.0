import { useState } from 'react';
import { Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function DeleteAccount() {
 const router=useRouter();const [name,setName]=useState(''),[contact,setContact]=useState(''),[role,setRole]=useState('Shopper'),[error,setError]=useState('');
 async function composeRequest() {
  setError('');
  if(!name.trim()||!contact.trim()){setError('Enter your name and the email or phone number registered with UniLink.');return;}
  const subject=encodeURIComponent('UniLink account and personal data deletion request');
  const body=encodeURIComponent(`Please delete my UniLink account and associated personal data.\n\nAccount type: ${role}\nRegistered name: ${name.trim()}\nRegistered email or phone: ${contact.trim()}\n\nPlease contact me to verify account ownership and confirm any records that must be retained under the published privacy policy.`);
  try{await Linking.openURL(`mailto:unilinkbase@gmail.com?subject=${subject}&body=${body}`)}catch{setError('Your email app could not open. Email unilinkbase@gmail.com directly using the details below.');}
 }
 const input=(label:string,value:string,change:(value:string)=>void)=><View style={{gap:6}}><Text style={{color:'#18324b',fontWeight:'600'}}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} maxLength={200} style={{padding:13,borderWidth:1,borderColor:'#b8c9dd',borderRadius:10,color:'#102139',backgroundColor:'#fff'}}/></View>;
 return <ScrollView style={{flex:1,backgroundColor:'#f8fafc'}} contentContainerStyle={{padding:24,maxWidth:760,width:'100%',alignSelf:'center',paddingBottom:60,gap:18}}>
  <TouchableOpacity accessibilityRole="button" onPress={()=>router.canGoBack()?router.back():router.replace('/')}><Text style={{color:'#174ea6'}}>Back to UniLink</Text></TouchableOpacity>
  <Text accessibilityRole="header" style={{fontSize:28,fontWeight:'800',color:'#102139'}}>Delete your UniLink account</Text>
  <Text style={{color:'#52627c',fontSize:15,lineHeight:23}}>UniLink is operated by Future Pulse Investments. You can request deletion of your account and associated personal data here, without installing the app or signing in.</Text>
  <Text style={{color:'#18324b',fontSize:15,lineHeight:23}}>Send your request from your registered email address where possible. Include your registered name, account type, and email or phone number so support can verify ownership. Never include a password, PIN, identity document, or verification code in the request.</Text>
  {input('Registered name',name,setName)}{input('Registered email or phone number',contact,setContact)}
  <Text style={{color:'#18324b',fontWeight:'600'}}>Account type</Text>
  <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{['Shopper','Messenger','Shop'].map(value=><TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{checked:role===value}} onPress={()=>setRole(value)} style={{backgroundColor:role===value?'#1a73e8':'#e6eef9',padding:12,borderRadius:8}}><Text style={{color:role===value?'white':'#174ea6'}}>{value}</Text></TouchableOpacity>)}</View>
  <TouchableOpacity accessibilityRole="button" onPress={()=>void composeRequest()} style={{backgroundColor:'#1a73e8',padding:15,borderRadius:10}}><Text style={{color:'#fff',fontWeight:'700',textAlign:'center'}}>Compose deletion request</Text></TouchableOpacity>
  {error?<Text accessibilityRole="alert" style={{color:'#b42318'}}>{error}</Text>:null}
  <Text style={{color:'#52627c',lineHeight:22}}>This opens your email app; send the email to submit the request. If it does not open, email the same request directly to:</Text>
  <Text selectable style={{color:'#174ea6',fontSize:17,fontWeight:'700'}}>unilinkbase@gmail.com</Text>
  <Text style={{color:'#52627c',lineHeight:22}}>Support will verify ownership before arranging account deletion. Account/profile data and associated personal data are covered by the request. Some transaction, dispute or security records may need to be retained for the purposes and periods described in the privacy policy. Uninstalling the app alone does not delete your account.</Text>
  <TouchableOpacity accessibilityRole="link" onPress={()=>router.push('/privacy-policy')}><Text style={{color:'#174ea6'}}>Read UniLink’s privacy policy and retention details</Text></TouchableOpacity>
 </ScrollView>;
}
