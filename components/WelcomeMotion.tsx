import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Apple, ShoppingBag, ShoppingCart, Zap } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

/** V2 welcome choreography. Decorative motion only; contains no actions or navigation. */
export default function WelcomeMotion() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const [reduced, setReduced] = useState(true), [active, setActive] = useState(true);
  const enabled = focused && active && !reduced;
  const orbit = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const entry = useRef(new Animated.Value(0)).current;
  const letters = useRef(Array.from({length:7},()=>new Animated.Value(0))).current;
  useEffect(() => {
    let alive = true;
    const media = Platform.OS === 'web' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const update = (value:boolean) => { if (alive) setReduced(value || !!media?.matches); };
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(()=>update(true));
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged',update);
    const mediaUpdate = () => update(!!media?.matches);
    media?.addEventListener('change',mediaUpdate);
    const visibility = () => setActive(AppState.currentState === 'active' && (Platform.OS !== 'web' || !document.hidden));
    const app = AppState.addEventListener('change',visibility);
    if (Platform.OS === 'web') { document.addEventListener('visibilitychange',visibility); visibility(); }
    return () => {alive=false;listener.remove();app.remove();media?.removeEventListener('change',mediaUpdate);if(Platform.OS==='web')document.removeEventListener('visibilitychange',visibility);};
  },[]);
  useEffect(() => {
    if (!enabled) return;
    [orbit,bounce,spin,ripple,entry,...letters].forEach(value=>value.setValue(0));
    const timing = (value:Animated.Value,toValue:number,duration:number,easing=Easing.linear) => Animated.timing(value,{toValue,duration,easing,useNativeDriver:true,isInteraction:false});
    const loops = [
      Animated.loop(timing(orbit,1,2880)),
      Animated.loop(Animated.sequence([timing(bounce,1,1300,Easing.inOut(Easing.sin)),timing(bounce,0,1300,Easing.inOut(Easing.sin))])),
      Animated.loop(Animated.sequence([Animated.delay(2050),timing(spin,1,1020,Easing.inOut(Easing.cubic)),Animated.delay(330)])),
      Animated.loop(timing(ripple,1,2600)),
      ...letters.map((value,i)=>Animated.loop(Animated.sequence([Animated.delay(i*90),timing(value,1,650,Easing.inOut(Easing.sin)),timing(value,0,650,Easing.inOut(Easing.sin)),Animated.delay(1300-i*90)]))),
    ];
    const entrance = timing(entry,1,1050,Easing.out(Easing.back(1.3)));
    entrance.start();loops.forEach(loop=>loop.start());
    return () => {entrance.stop();loops.forEach(loop=>loop.stop());[orbit,bounce,spin,ripple,entry,...letters].forEach(value=>value.stopAnimation());};
  },[enabled,orbit,bounce,spin,ripple,entry,letters]);
  const rotation = orbit.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']});
  const counter = orbit.interpolate({inputRange:[0,1],outputRange:['0deg','-360deg']});
  return <View testID="welcome-motion-v2" style={s.root}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.stage}>
      {enabled && <Animated.View style={[s.ripple,{borderColor:colors.primary,opacity:ripple.interpolate({inputRange:[0,1],outputRange:[.3,0]}),transform:[{scale:ripple.interpolate({inputRange:[0,1],outputRange:[1,1.6]})}]}]}/>}
      <Animated.View style={[s.ring,{borderColor:colors.primary,opacity:.7,transform:enabled?[{rotate:rotation}]:[]}] }>
        <View style={[s.arc,{borderTopColor:colors.primary,borderRightColor:colors.primary}]}/><View style={[s.dot,{backgroundColor:colors.primary}]}/>
      </Animated.View>
      <Animated.View style={[s.outer,{borderColor:`${colors.primary}30`,transform:enabled?[{rotate:counter}]:[]}] }>
        <Animated.View style={[s.bag,{backgroundColor:isDark?'#0b2835':'#e5f5ff',borderColor:`${colors.primary}70`,transform:enabled?[{rotate:rotation}]:[] }]}><ShoppingBag size={16} color={colors.primary}/></Animated.View>
        <Animated.View style={[s.apple,{backgroundColor:isDark?'#102b2a':'#e8faf3',transform:enabled?[{rotate:rotation}]:[]}]}><Apple size={16} color={isDark?'#7de9c2':'#188764'}/></Animated.View>
      </Animated.View>
      <Animated.View style={[s.cart,{backgroundColor:isDark?'#062d38':'#e7f3ff',transform:enabled?[{translateX:entry.interpolate({inputRange:[0,1],outputRange:[-180,0]})},{translateY:bounce.interpolate({inputRange:[0,1],outputRange:[5,-10]})},{rotate:bounce.interpolate({inputRange:[0,1],outputRange:['-7deg','7deg']})}]:[]}]}>
        <Animated.View style={{transform:enabled?[{perspective:420},{rotateY:spin.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]:[]}}><ShoppingCart size={42} color={colors.primary} strokeWidth={2.3}/></Animated.View>
      </Animated.View>
      {enabled && [0,1,2,3].map(i=><Animated.View key={i} style={[s.spark,{left:14+i*36,top:i%2?20:112,backgroundColor:colors.primary,opacity:bounce.interpolate({inputRange:[0,1],outputRange:[.15,.65]}),transform:[{rotate:rotation},{scale:bounce.interpolate({inputRange:[0,1],outputRange:[.6,1.2]})}]}]}/>)}
    </View>
    <Text style={[s.label,{color:colors.textTertiary}]}>WELCOME TO</Text>
    <View accessible accessibilityRole="header" accessibilityLabel="UNILINK" style={s.word}>
      {'UNILINK'.split('').map((letter,i)=><Animated.Text key={i} accessible={false} style={[s.letter,{fontSize:width<600?46:56,color:i<3?colors.text:colors.primary,transform:enabled?[{translateY:letters[i].interpolate({inputRange:[0,1],outputRange:[0,-6]})},{rotate:letters[i].interpolate({inputRange:[0,1],outputRange:['0deg',i%2?'2deg':'-2deg']})}]:[]}]}>{letter}</Animated.Text>)}
    </View>
    <View pointerEvents="none" style={s.divider}><View style={[s.line,{backgroundColor:colors.primary}]}/><Zap size={12} color={colors.primary}/><View style={[s.line,{backgroundColor:colors.primary}]}/></View>
  </View>;
}
const s=StyleSheet.create({
  root:{alignItems:'center'},stage:{width:152,height:146,alignItems:'center',justifyContent:'center',marginTop:-8,marginBottom:8},
  ring:{position:'absolute',width:108,height:108,borderWidth:1,borderRadius:54},arc:{position:'absolute',inset:-1,borderWidth:2,borderRadius:54,borderBottomColor:'transparent',borderLeftColor:'transparent'},dot:{position:'absolute',right:-3,top:50,width:5,height:5,borderRadius:3},
  outer:{position:'absolute',width:136,height:136,borderRadius:68,borderWidth:1},bag:{position:'absolute',left:-9,top:29,width:27,height:27,borderWidth:1,borderRadius:9,alignItems:'center',justifyContent:'center'},apple:{position:'absolute',right:-7,bottom:20,width:27,height:27,borderRadius:9,alignItems:'center',justifyContent:'center'},
  cart:{width:78,height:78,borderRadius:39,alignItems:'center',justifyContent:'center'},ripple:{position:'absolute',width:106,height:106,borderRadius:53,borderWidth:1},spark:{position:'absolute',width:4,height:4,borderRadius:1},label:{fontSize:11,fontWeight:'700',letterSpacing:4,marginBottom:8},word:{flexDirection:'row',alignItems:'center',justifyContent:'center',paddingTop:6},letter:{fontWeight:'900',letterSpacing:1},divider:{flexDirection:'row',alignItems:'center',gap:8,marginVertical:10},line:{height:1,width:36,opacity:.4},
});
