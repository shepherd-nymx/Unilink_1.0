import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ProductLoad } from '@/lib/delivery-quote-types';
export default function ProductLoadFields({value,onChange}:{value:ProductLoad;onChange:(value:ProductLoad)=>void}) {
 const [raw,setRaw]=useState({weight_kg:value.weight_kg==null?'':String(value.weight_kg),volume_litres:value.volume_litres==null?'':String(value.volume_litres)});
 const change=(patch:ProductLoad)=>onChange({...value,...patch});
 return <View style={{padding:12,backgroundColor:'#edf5ff',borderRadius:12,gap:8,marginVertical:10}}>
 <Text style={{color:'#102139',fontWeight:'700'}}>Delivery details — per unit sold</Text>
 <Text style={{fontSize:12,color:'#52627c'}}>Use measured values. Leave unknown details blank: delivery will need a manual quote. Volume means packed space (length × width × height in cm ÷ 1000).</Text>
 {(['weight_kg','volume_litres'] as const).map(key=><View key={key}><Text style={{color:'#102139'}}>{key==='weight_kg'?'Weight (kg)':'Packed volume (litres)'}</Text><TextInput accessibilityLabel={key==='weight_kg'?'Product weight in kilograms':'Packed volume in litres'} keyboardType="decimal-pad" value={raw[key]} onChangeText={text=>{setRaw({...raw,[key]:text});change({[key]:text.trim()===''?null:Number(text)})}} placeholder="Unknown" style={{padding:10,backgroundColor:'#fff',borderRadius:8,color:'#102139'}} /></View>)}
 <Text style={{color:'#102139'}}>Package size</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{([null,'compact','bag','bulky'] as const).map(size=><TouchableOpacity key={size||'unknown'} accessibilityRole="button" onPress={()=>change({package_size:size})} style={{padding:8,borderRadius:8,backgroundColor:value.package_size===size?'#1a73e8':'#fff'}}><Text style={{color:value.package_size===size?'#fff':'#102139'}}>{size||'Unknown'}</Text></TouchableOpacity>)}</View>
 {(['fragile','two_person_lift'] as const).map(key=><TouchableOpacity key={key} accessibilityRole="checkbox" accessibilityState={{checked:!!value[key]}} onPress={()=>change({[key]:!value[key]})}><Text style={{color:'#102139',paddingVertical:5}}>{value[key]?'☑':'☐'} {key==='fragile'?'Fragile / special handling':'Requires two-person lifting'}</Text></TouchableOpacity>)}
 </View>;
}
