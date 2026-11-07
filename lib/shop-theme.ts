export const S = {
  bg: '#050b16',
  surface: '#0a1220',
  card: '#0f1a2e',
  cardHover: '#142035',
  border: '#1a2d4a',
  borderBright: '#243d60',

  cyan: '#00e5ff',
  cyanDim: 'rgba(0,229,255,0.12)',
  cyanGlow: 'rgba(0,229,255,0.06)',
  green: '#00ff88',
  greenDim: 'rgba(0,255,136,0.12)',
  orange: '#ff6b00',
  orangeDim: 'rgba(255,107,0,0.12)',
  amber: '#ffaa00',
  amberDim: 'rgba(255,170,0,0.12)',
  red: '#ff3366',
  redDim: 'rgba(255,51,102,0.12)',
  blue: '#0066ff',
  blueDim: 'rgba(0,102,255,0.12)',

  text: '#e0eeff',
  textSub: '#6a8fb0',
  textMuted: '#2e4a6a',

  inputBg: '#0d1828',
  inputBorder: '#1a2d4a',

  overlay: 'rgba(0,0,0,0.7)',
};

export const modalStyle = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end' as const,
  },
  content: {
    backgroundColor: '#0a1220',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#1a2d4a',
    padding: 24,
    paddingBottom: 48,
  },
  centerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  centerContent: {
    backgroundColor: '#0a1220',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a2d4a',
    padding: 24,
    width: '100%' as any,
    maxWidth: 420,
  },
};
