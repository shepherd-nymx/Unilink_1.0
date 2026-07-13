import { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const PATHS = [
  'M -60 120 C 80 60, 200 200, 340 140 C 480 80, 560 220, 720 160 C 880 100, 960 240, 1100 180',
  'M -40 280 C 100 220, 240 360, 400 300 C 560 240, 640 380, 820 320 C 1000 260, 1060 380, 1200 340',
  'M 20 440 C 160 380, 300 500, 460 440 C 620 380, 700 500, 880 440 C 1060 380, 1120 500, 1260 460',
  'M 0 560 C 140 500, 280 620, 440 560 C 600 500, 700 600, 880 560 C 1060 520, 1140 600, 1280 570',
  'M 60 700 C 180 640, 320 760, 500 700 C 680 640, 760 760, 940 700 C 1120 640, 1180 740, 1320 700',
];

const DOT_COLORS = ['#38bdf8', '#34d399', '#818cf8', '#38bdf8', '#34d399'];
const DOT_DURATIONS = [18000, 22000, 16000, 24000, 20000];
const DOT_DELAYS = [0, 4000, 8000, 2000, 6000];

function getPointOnCubicBezierPath(pathD: string, t: number): { x: number; y: number } {
  const m = pathD.match(
    /M\s*([-\d.]+)\s+([-\d.]+)\s+C\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+)\s+C\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+)\s+C\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+)/
  );
  if (!m) return { x: 0, y: 0 };

  const segments = [
    {
      p0: { x: +m[1], y: +m[2] },
      p1: { x: +m[3], y: +m[4] },
      p2: { x: +m[5], y: +m[6] },
      p3: { x: +m[7], y: +m[8] },
    },
    {
      p0: { x: +m[7], y: +m[8] },
      p1: { x: +m[9], y: +m[10] },
      p2: { x: +m[11], y: +m[12] },
      p3: { x: +m[13], y: +m[14] },
    },
    {
      p0: { x: +m[13], y: +m[14] },
      p1: { x: +m[15], y: +m[16] },
      p2: { x: +m[17], y: +m[18] },
      p3: { x: +m[19], y: +m[20] },
    },
  ];

  const segT = t * segments.length;
  const idx = Math.min(Math.floor(segT), segments.length - 1);
  const lt = segT - idx;
  const { p0, p1, p2, p3 } = segments[idx];
  const mt = 1 - lt;

  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * lt * p1.x + 3 * mt * lt * lt * p2.x + lt * lt * lt * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * lt * p1.y + 3 * mt * lt * lt * p2.y + lt * lt * lt * p3.y,
  };
}

export default function AnimatedDeliveryBackground() {
  const canvasRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouse);

    const draw = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;

      const cw = canvas.width;
      const ch = canvas.height;
      const scaleX = cw / 1200;
      const scaleY = ch / 800;

      ctx.clearRect(0, 0, cw, ch);

      const grd = ctx.createLinearGradient(0, 0, cw, ch);
      grd.addColorStop(0, '#050D1A');
      grd.addColorStop(0.45, '#071428');
      grd.addColorStop(1, '#060e20');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cw, ch);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const px = (mx / cw - 0.5) * 18;
      const py = (my / ch - 0.5) * 18;

      const radialX = cw * 0.5 + px;
      const radialY = ch * 0.38 + py;
      const spot = ctx.createRadialGradient(radialX, radialY, 0, radialX, radialY, cw * 0.65);
      spot.addColorStop(0, 'rgba(26,115,232,0.07)');
      spot.addColorStop(0.5, 'rgba(99,102,241,0.04)');
      spot.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, cw, ch);

      const spot2 = ctx.createRadialGradient(cw * 0.85 + px * 0.5, ch * 0.7 + py * 0.5, 0, cw * 0.85, ch * 0.7, cw * 0.4);
      spot2.addColorStop(0, 'rgba(16,185,129,0.05)');
      spot2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spot2;
      ctx.fillRect(0, 0, cw, ch);

      ctx.save();
      ctx.translate(px * 0.3, py * 0.3);

      PATHS.forEach((pathD, i) => {
        const SEGMENTS = 200;
        ctx.beginPath();
        for (let j = 0; j <= SEGMENTS; j++) {
          const pt = getPointOnCubicBezierPath(pathD, j / SEGMENTS);
          const sx = pt.x * scaleX;
          const sy = pt.y * scaleY;
          if (j === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        const wave = Math.sin(elapsed * 0.0003 + i * 1.1) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(${i % 2 === 0 ? '56,189,248' : '129,140,248'},${0.07 + wave * 0.06})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const dur = DOT_DURATIONS[i];
        const delay = DOT_DELAYS[i];
        const t = ((elapsed + delay) % dur) / dur;

        const pt = getPointOnCubicBezierPath(pathD, t);
        const dx = pt.x * scaleX;
        const dy = pt.y * scaleY;

        const color = DOT_COLORS[i];
        const hex = color.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);

        const glowR = ctx.createRadialGradient(dx, dy, 0, dx, dy, 22);
        glowR.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
        glowR.addColorStop(0.4, `rgba(${r},${g},${b},0.18)`);
        glowR.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = glowR;
        ctx.beginPath();
        ctx.arc(dx, dy, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
        ctx.fill();

        const tailT = Math.max(0, t - 0.04);
        const tail = getPointOnCubicBezierPath(pathD, tailT);
        const tdx = tail.x * scaleX;
        const tdy = tail.y * scaleY;
        const tailGrd = ctx.createLinearGradient(tdx, tdy, dx, dy);
        tailGrd.addColorStop(0, `rgba(${r},${g},${b},0)`);
        tailGrd.addColorStop(1, `rgba(${r},${g},${b},0.35)`);
        ctx.beginPath();
        ctx.moveTo(tdx, tdy);
        ctx.lineTo(dx, dy);
        ctx.strokeStyle = tailGrd;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });

      const now = elapsed * 0.00008;
      for (let i = 0; i < 28; i++) {
        const seed = i * 137.508;
        const bx = ((Math.sin(seed) * 0.5 + 0.5) * cw + Math.sin(now + seed) * 18 + px * 0.15) % cw;
        const by = ((Math.cos(seed * 1.3) * 0.5 + 0.5) * ch + Math.cos(now * 0.7 + seed) * 12 + py * 0.15) % ch;
        const pulse = Math.sin(elapsed * 0.001 + seed) * 0.5 + 0.5;
        const alpha = 0.06 + pulse * 0.1;
        const radius = 1.2 + pulse * 0.8;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0
          ? `rgba(56,189,248,${alpha})`
          : i % 3 === 1
          ? `rgba(129,140,248,${alpha})`
          : `rgba(52,211,153,${alpha})`;
        ctx.fill();
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#050D1A' }]} pointerEvents="none" />
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* @ts-ignore web-only */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </View>
  );
}
