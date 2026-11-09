import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, ArrowUp, ChevronRight, MapPin, ShoppingBag, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { loadUserDataAsync } from '@/lib/storage-service';
import { supabase } from '@/lib/supabase';
import PageSkeleton from '@/components/PageSkeleton';
import type { AssistantProduct, AssistantResponse } from '@/lib/shopping-assistant-types';

type Message = { id: number; role: 'user' | 'assistant'; content: string; result?: AssistantResponse };
const money = (n: number) => `$${n.toFixed(2)}`;
const examples = ['2 kg rice under $10', '1 L cooking oil and 2 kg rice for $15', 'How do delivery fees work?'];
export default function ShoppingAssistant() {
  const router = useRouter(), { isDark } = useTheme();
  const [loading, setLoading] = useState(true), [universityId, setUniversityId] = useState(''), [locationName, setLocationName] = useState('');
  const [draft, setDraft] = useState(''), [messages, setMessages] = useState<Message[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const scroll = useRef<ScrollView>(null), controller = useRef<AbortController | null>(null), nextId = useRef(0), pending = useRef(false);
  const palette = { bg: isDark ? '#07101e' : '#f3f6fc', card: isDark ? '#101e30' : '#fff', border: isDark ? '#263c52' : '#dbe5f1', text: isDark ? '#e5f1fc' : '#102139', muted: isDark ? '#9aafc5' : '#5e7189', blue: isDark ? '#58b5ff' : '#005be8' };
  useFocusEffect(useCallback(() => {
    let alive = true;
    setLoading(true); setError('');
    void (async () => {
      try {
        const session = await loadUserDataAsync();
        if (!alive) return;
        if (!session || session.type !== 'customer') { router.replace('/customer/login'); return; }
        const customer = await supabase.from('customers').select('university_id').eq('id',session.id).maybeSingle();
        if (customer.error) throw customer.error;
        if (!customer.data?.university_id) { if (alive) { setUniversityId(''); setLocationName(''); } return; }
        const university = await supabase.from('universities').select('name').eq('id',customer.data.university_id).maybeSingle();
        if (university.error) throw university.error;
        if (alive) { setUniversityId(customer.data.university_id); setLocationName(university.data?.name || 'Your service area'); }
      } catch { if (alive) setError('Your service location could not be loaded. Please try again.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [reload, router]));
  useEffect(() => () => { controller.current?.abort(); }, []);

  async function send(value = draft) {
    const text = value.trim();
    if (!text || pending.current || !universityId) return;
    pending.current = true; setBusy(true); setError(''); setDraft('');
    const user: Message = { id: ++nextId.current, role:'user', content: text };
    const history = [...messages, user]; setMessages(history);
    const abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(),28000);
    try {
      const response = await fetch(Platform.OS === 'web' ? '/api/shopping-assistant' : 'https://www.unilinkbase.com/api/shopping-assistant', {
        method:'POST', headers:{'Content-Type':'application/json'}, signal:abort.signal,
        body:JSON.stringify({universityId, messages:history.slice(-5).map(message => ({role:message.role,content:message.content}))}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The assistant is temporarily unavailable.');
      if (!abort.signal.aborted) setMessages(previous => [...previous,{id:++nextId.current,role:'assistant',content:result.message,result}]);
    } catch (err) {
      setMessages(previous => previous.filter(message => message.id !== user.id)); setDraft(text);
      setError(err instanceof Error && err.name !== 'AbortError' ? err.message : 'The request took too long. Please try again.');
    } finally { clearTimeout(timer); pending.current = false; setBusy(false); }
  }
  function browse(product: AssistantProduct) {
    router.push({pathname:'/customer/marketplace',params:{shopId:product.shopId,productId:product.id}});
  }
  function productRow(product: AssistantProduct, key: string) {
    return <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={`View ${product.name} at ${product.shopName}`} onPress={() => browse(product)} style={[s.product,{borderColor:palette.border}]}>
      <View style={{flex:1,minWidth:0,gap:4}}><Text style={[s.productName,{color:palette.text}]}>{product.name}</Text>
        <Text style={[s.small,{color:palette.muted}]}>{product.shopName} · {product.open ? 'Open' : 'Closed / unavailable'}</Text>
        <Text style={[s.small,{color:palette.muted}]}>{money(product.price)} per pack{product.quantity == null ? ' · Check pack size' : ` · ${product.quantity} pack${product.quantity === 1 ? '' : 's'}`}{product.supplied ? ` · ${product.supplied} total` : ''}</Text>
      </View><View style={{alignItems:'flex-end',gap:5}}>{product.lineTotal != null && <Text style={{color:palette.blue,fontWeight:'800',fontSize:14}}>{money(product.lineTotal)}</Text>}<ChevronRight size={18} color={palette.blue}/></View>
    </TouchableOpacity>;
  }
  if (loading) return <PageSkeleton page="customer/assistant" layout="chat" onBack={() => router.back()}/>;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.root,{backgroundColor:palette.bg}]}>
    <View style={[s.header,{borderColor:palette.border}]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={[s.back,{backgroundColor:palette.card,borderColor:palette.border}]}><ArrowLeft size={21} color={palette.text}/></TouchableOpacity>
      <View style={{flex:1}}><Text style={[s.title,{color:palette.text}]}>UNILINK assistant</Text><Text style={[s.small,{color:palette.muted}]}>Your list. Your budget.</Text></View>
      <Sparkles size={23} color={palette.blue}/>
    </View>
    <View style={s.location}><MapPin size={13} color={palette.muted}/><Text style={[s.small,{color:palette.muted,flexShrink:1}]} numberOfLines={2}>{locationName || 'Service location needed'}</Text></View>
    <ScrollView ref={scroll} style={{flex:1}} contentContainerStyle={s.conversation} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({animated:true})}>
      {!messages.length && <View style={[s.welcome,{backgroundColor:palette.card,borderColor:palette.border}]}>
        <View style={s.sparkle}><Sparkles size={27} color={palette.blue}/></View>
        <Text style={[s.welcomeTitle,{color:palette.text}]}>What can I find for you?</Text>
        <Text style={[s.copy,{color:palette.muted}]}>Tell me what you need, the quantity and your budget in US dollars. I’ll check real products and shop delivery fees.</Text>
        {universityId ? examples.map(example => <TouchableOpacity key={example} accessibilityRole="button" onPress={() => void send(example)} style={[s.example,{borderColor:palette.border}]}><Text style={[s.copy,{color:palette.text,flex:1}]}>{example}</Text><ChevronRight size={16} color={palette.blue}/></TouchableOpacity>) : <TouchableOpacity accessibilityRole="button" onPress={() => error ? setReload(n => n+1) : router.push('/customer/profile')} style={s.primary}><Text style={s.primaryText}>{error ? 'Retry loading location' : 'Add service location in Profile'}</Text></TouchableOpacity>}
      </View>}
      {messages.map(message => <View key={message.id} style={[s.message,message.role === 'user' ? {alignSelf:'flex-end',backgroundColor:'#005be8',maxWidth:'90%',borderColor:'#005be8'} : {backgroundColor:palette.card,borderColor:palette.border}]}>
        <Text style={[s.copy,{color:message.role === 'user' ? '#fff' : palette.text}]}>{message.content}</Text>
        {message.result && <>
          <Text style={[s.small,{color:palette.muted}]}>{message.result.mode === 'ai' ? 'AI-assisted catalogue search' : 'Catalogue assistant'}{message.result.budget != null ? ` · Budget ${money(message.result.budget)} (${message.result.budgetIncludesDelivery ? 'including delivery' : 'goods only'})` : ''}</Text>
          {message.result.notice && <Text style={[s.small,{color:palette.muted}]}>{message.result.notice}</Text>}
          {message.result.basket && <View style={[s.basket,{borderColor:palette.border}]}>
            <View style={s.heading}><ShoppingBag size={17} color={palette.blue}/><Text style={[s.productName,{color:palette.text}]}>Suggested basket</Text></View>
            {message.result.basket.lines.map(product => productRow(product,product.id))}
            <View style={s.total}><Text style={[s.copy,{color:palette.muted}]}>Goods</Text><Text style={[s.copy,{color:palette.text}]}>{money(message.result.basket.goodsTotal)}</Text></View>
            <View style={s.total}><Text style={[s.copy,{color:palette.muted}]}>Delivery estimate</Text><Text style={[s.copy,{color:palette.text}]}>{message.result.basket.deliveryFee == null ? 'Confirm at checkout' : money(message.result.basket.deliveryFee)}</Text></View>
            {message.result.basket.total != null && <View style={s.total}><Text style={[s.productName,{color:palette.text}]}>Estimated total</Text><Text style={[s.productName,{color:palette.blue}]}>{money(message.result.basket.total)}</Text></View>}
            {message.result.basket.budgetStatus === 'over' && <Text style={[s.copy,{color:isDark ? '#ffa5a5' : '#ad2839'}]}>Over budget — adjust your request before shopping.</Text>}
            <Text style={[s.small,{color:palette.muted}]}>Payment fees may apply. Prices, stock, opening status and delivery are checked again in the shop and checkout. Nothing has been added or ordered.</Text>
          </View>}
          {message.result.missing.map(missing => <Text key={missing} style={[s.small,{color:palette.muted}]}>{missing}</Text>)}
          {message.result.matches.map(match => <View key={match.requested} style={{gap:4}}><Text style={[s.productName,{color:palette.text,marginTop:8}]}>{match.requested}</Text>{match.products.length ? match.products.map(product => productRow(product,product.id)) : <Text style={[s.small,{color:palette.muted}]}>No matching products in the checked catalogue.</Text>}</View>)}
        </>}
      </View>)}
      {busy && <View accessibilityRole="progressbar" accessibilityLabel="Checking your request" style={[s.thinking,{backgroundColor:palette.card}]}><ActivityIndicator size="small" color={palette.blue}/><Text style={[s.copy,{color:palette.muted}]}>Checking your request…</Text></View>}
      {!!error && <Text accessibilityRole="alert" style={[s.copy,{color:isDark ? '#ffa5a5' : '#ad2839'}]}>{error}</Text>}
    </ScrollView>
    <View style={[s.composer,{borderColor:palette.border,backgroundColor:palette.card}]}>
      <View style={[s.inputRow,{borderColor:palette.border}]}><TextInput accessibilityLabel="Your shopping request" placeholder="What do you need? Add your budget…" placeholderTextColor={palette.muted} value={draft} onChangeText={setDraft} maxLength={1000} multiline editable={!busy && !!universityId} style={[s.input,{color:palette.text}]}/><TouchableOpacity accessibilityRole="button" accessibilityLabel="Send request" accessibilityState={{disabled:busy || !draft.trim() || !universityId}} disabled={busy || !draft.trim() || !universityId} onPress={() => void send()} style={[s.send,{opacity:busy || !draft.trim() || !universityId ? 0.4 : 1}]}><ArrowUp size={21} color="#fff"/></TouchableOpacity></View>
      <Text style={[s.disclosure,{color:palette.muted}]}>Requests may be processed by a free AI provider. Don’t include passwords, payment details or private information.</Text>
    </View>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  root:{flex:1,minHeight:0},header:{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderBottomWidth:1,width:'100%',maxWidth:760,alignSelf:'center'},back:{width:40,height:40,borderWidth:1,borderRadius:12,alignItems:'center',justifyContent:'center'},title:{fontSize:18,fontWeight:'800'},small:{fontSize:11,lineHeight:17},location:{flexDirection:'row',gap:5,paddingHorizontal:20,paddingVertical:9,width:'100%',maxWidth:760,alignSelf:'center'},conversation:{padding:16,gap:14,width:'100%',maxWidth:760,alignSelf:'center',paddingBottom:24},welcome:{borderWidth:1,borderRadius:22,padding:20,gap:15},sparkle:{width:52,height:52,borderRadius:16,backgroundColor:'#137bff18',alignItems:'center',justifyContent:'center'},welcomeTitle:{fontSize:24,fontWeight:'800',letterSpacing:-0.5},copy:{fontSize:13,lineHeight:21},example:{borderWidth:1,borderRadius:12,padding:12,flexDirection:'row',alignItems:'center',gap:8},primary:{backgroundColor:'#005be8',padding:14,borderRadius:12,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'700',fontSize:13},message:{padding:14,borderWidth:1,borderRadius:18,gap:10,width:'100%'},basket:{borderWidth:1,borderRadius:14,padding:12,gap:10},heading:{flexDirection:'row',alignItems:'center',gap:7},product:{flexDirection:'row',alignItems:'center',gap:8,borderBottomWidth:1,paddingVertical:12},productName:{fontSize:13,fontWeight:'700',lineHeight:20},total:{flexDirection:'row',justifyContent:'space-between',gap:10,flexWrap:'wrap'},thinking:{flexDirection:'row',gap:9,alignItems:'center',padding:14,borderRadius:14},composer:{borderTopWidth:1,padding:12,gap:8,width:'100%',maxWidth:760,alignSelf:'center'},inputRow:{flexDirection:'row',alignItems:'flex-end',gap:8,padding:8,borderWidth:1,borderRadius:16},input:{flex:1,minWidth:0,fontSize:13,lineHeight:20,minHeight:36,maxHeight:100,padding:7},send:{width:36,height:36,borderRadius:12,backgroundColor:'#005be8',alignItems:'center',justifyContent:'center'},disclosure:{fontSize:9,lineHeight:14,textAlign:'center'},
});
