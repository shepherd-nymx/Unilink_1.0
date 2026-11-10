import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { FuturePulseLogoProps } from './FuturePulseLogo.types';

/** The supplied Future Pulse animation, paused offscreen and for reduced motion. */
export default function FuturePulseLogo({ variant = 'wordmark', width = 200, height = 44, style }: FuturePulseLogoProps) {
  const video = useRef<HTMLVideoElement>(null);
  const focused = useIsFocused();
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(true);
  const [failed, setFailed] = useState(false);
  const src = `/brand/future-pulse-${variant}`;
  const enabled = focused && visible && active && !reduced && !failed;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    const visibility = () => setActive(!document.hidden);
    update(); visibility();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', visibility);
    const element = video.current;
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { threshold: .1 });
    if (element) observer.observe(element);
    return () => { media.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility); observer.disconnect(); };
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (enabled) void element.play().catch((error) => { if (error?.name !== 'AbortError') setFailed(true); }); else element.pause();
    return () => element.pause();
  }, [enabled]);
  const poster = reduced || failed;
  return <View accessible accessibilityRole="image" accessibilityLabel="Future Pulse" pointerEvents="none" style={[{ width, height, maxWidth: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: '#07070f' }, style]}>
    <video ref={video} data-future-pulse-logo={variant} src={`${src}.mp4`} poster={`${src}-poster.png`} muted loop playsInline preload="metadata" controls={false} aria-hidden="true" tabIndex={-1} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: poster ? 0 : 1, display: 'block' }} />
    {poster && <img src={`${src}-poster.png`} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
  </View>;
}
