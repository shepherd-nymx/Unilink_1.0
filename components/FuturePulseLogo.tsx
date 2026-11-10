import { Image, View } from 'react-native';
import type { FuturePulseLogoProps } from './FuturePulseLogo.types';

/** Native fallback; the installed Android PWA uses the animated web component. */
export default function FuturePulseLogo({ variant = 'wordmark', width = 200, height = 44, style }: FuturePulseLogoProps) {
  return <View style={[{ width, height, maxWidth: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: '#07070f' }, style]}>
    <Image source={variant === 'mark' ? require('../assets/images/future-pulse-mark-poster.png') : require('../assets/images/future-pulse-wordmark-poster.png')} accessibilityLabel="Future Pulse" resizeMode="contain" style={{ width: '100%', height: '100%' }} />
  </View>;
}
