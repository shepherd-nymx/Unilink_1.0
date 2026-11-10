# V2 welcome motion

The landing hero uses WelcomeMotion for the approved v2 choreography: rolling cart entrance, floating/tilting cart with a periodic 3D turn, counter-rotating rings and upright grocery icons, expanding pulse and sparkles, and staggered moving UNILINK letters. Existing tagline, description, theme control and all navigation/actions are unchanged.

Uses React Native Animated with native-driver transforms/opacity and non-interaction animation loops. All loops/listeners are cleaned up; animation stops when the screen loses focus, the app backgrounds, or the browser tab is hidden. System reduced-motion settings render a static hero. Both light/dark palettes and narrow/desktop wordmark sizes are supported. Decorative graphics are hidden from screen readers; the wordmark has one accessible UNILINK heading.

Verified: TypeScript and Expo production web export; browser animation movement, reduced-motion stability, no horizontal overflow and existing registration navigation in dark 390px, light 320px, reduced-motion dark 390px and dark desktop 1440px. The previously observed addEventListener error in existing registration/browser code is excluded from the browser error baseline.
