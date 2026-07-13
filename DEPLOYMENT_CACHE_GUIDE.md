# Deployment and Cache Management Guide

This document explains the cache-busting strategy implemented in the UNILINK app to ensure users always receive the latest version after deployment.

## Overview

The app now implements a comprehensive cache-busting strategy that includes:

1. **No-cache headers for HTML** - index.html is never cached
2. **Content hashing for assets** - JS and CSS bundles include unique hashes
3. **Network-first service worker** - Always fetches latest HTML/JS/CSS from network
4. **Automatic update detection** - Service worker checks for updates every 60 seconds
5. **Versioning support** - App version visible in console logs

## What Was Changed

### 1. Service Worker (`public/service-worker.js`)

The service worker now:
- Uses dynamic cache names with version and timestamp
- Implements network-first strategy for HTML, JS, and CSS files
- Automatically deletes old caches on activation
- Checks for updates and forces reload when new version is available
- Logs cache operations for debugging

**Key features:**
```javascript
// Cache version updates automatically
const CACHE_VERSION = '1.0.0';
const BUILD_TIMESTAMP = Date.now();

// Network-first for HTML, JS, CSS
// Cache-first for static assets (icons, images)
```

### 2. Index HTML (`public/index.html`)

Added meta tags to prevent caching:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

Added automatic update detection:
- Checks for service worker updates every 60 seconds
- Forces reload when new version is detected
- Handles controller changes automatically

### 3. Metro Configuration (`metro.config.js`)

Created metro config to ensure proper module ID generation for consistent builds.

### 4. Version Indicator Component (`components/VersionIndicator.tsx`)

A utility component that:
- Logs app version and build time to console
- Can be added to any screen to show version info
- Only visible on web platform

## How It Works

### On Every Deployment

1. **Build Process:**
   - `npm run build:web` generates new bundle with unique hash
   - Example: `entry-0b1448b7bb5f60b9ccc3fa530a47b02f.js`
   - Each build gets a different hash, even with no code changes

2. **Service Worker:**
   - Gets new timestamp on each build
   - Creates new cache name: `unilink-v1.0.0-[timestamp]`
   - Old caches are automatically deleted

3. **User Experience:**
   - User visits site
   - Browser fetches index.html (never cached due to meta tags)
   - Service worker detects new version within 60 seconds
   - Page automatically reloads with new version
   - Old cache is cleared

### Network Strategy

**HTML, JS, CSS (Network-First):**
1. Try to fetch from network first
2. Cache the response for offline use
3. If network fails, use cached version

**Static Assets (Cache-First):**
1. Check cache first
2. If not in cache, fetch from network
3. Cache for future use

## Deployment Checklist

### Before Deploying

1. **Update version in `app.json`:**
   ```json
   "version": "1.0.2"
   ```

2. **Build the app:**
   ```bash
   npm run build:web
   ```

3. **Verify new bundle hash:**
   - Check the build output for the new `entry-[hash].js` filename
   - Confirm it's different from the previous build

### After Deploying

1. **Clear your browser cache** (first time only):
   - Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

2. **Open browser console:**
   - Look for version logs: `[Version] App Version: 1.0.X`
   - Look for service worker logs: `[SW] Installing service worker version: unilink-v1.0.X-[timestamp]`

3. **Verify update mechanism:**
   - Wait 60 seconds
   - Service worker should check for updates
   - If new version exists, page should reload automatically

## Debugging

### Check Current Version

Open browser console and look for:
```
[Version] App Version: 1.0.1
[Version] Build Time: 2026-03-19T...
[SW] Installing service worker version: unilink-v1.0.0-1234567890
```

### Check Caches

Open DevTools → Application → Cache Storage
- Should see only one `unilink-v1.0.0-[latest-timestamp]` cache
- Old caches should be deleted automatically

### Force Update

If users report seeing old version:
1. Ask them to hard refresh: `Ctrl + Shift + R`
2. Or clear browser cache completely
3. Or wait 60 seconds for automatic update

### Service Worker Issues

If service worker isn't updating:
1. Go to DevTools → Application → Service Workers
2. Click "Unregister" to remove old service worker
3. Hard refresh the page
4. New service worker will register automatically

## CDN Considerations

If using a CDN (Cloudflare, AWS CloudFront, etc.):

### Option 1: Configure CDN Cache Headers

Set cache rules in your CDN:
```
index.html → Cache-Control: no-cache, no-store, must-revalidate
service-worker.js → Cache-Control: no-cache, no-store, must-revalidate
*.js → Cache-Control: public, max-age=31536000, immutable
*.css → Cache-Control: public, max-age=31536000, immutable
```

### Option 2: Purge CDN Cache on Deploy

Add to your CI/CD pipeline:
- Purge `index.html` after every deployment
- Purge `service-worker.js` after every deployment
- JS/CSS bundles don't need purging (unique hashes)

### Cloudflare Example

```bash
# Purge specific files
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://yourdomain.com/index.html","https://yourdomain.com/service-worker.js"]}'
```

## Testing the Cache Strategy

### Test 1: New Deployment Detection

1. Deploy version 1.0.1
2. Open app in browser
3. Check console for version: `[Version] App Version: 1.0.1`
4. Deploy version 1.0.2
5. Wait 60 seconds or refresh page
6. Service worker should detect update
7. Page should reload automatically
8. Console should show: `[Version] App Version: 1.0.2`

### Test 2: Offline Support

1. Open app in browser
2. Open DevTools → Network → Set to "Offline"
3. Refresh page
4. App should still load from cache
5. Static assets should work
6. Only new network requests will fail

### Test 3: Cache Cleanup

1. Check Application → Cache Storage before deployment
2. Note cache name: `unilink-v1.0.0-1234567890`
3. Deploy new version
4. Wait 60 seconds
5. Check Cache Storage again
6. Old cache should be deleted
7. New cache should exist: `unilink-v1.0.0-9876543210`

## User Instructions

If a user reports not seeing the latest version:

1. **First, try hard refresh:**
   - Windows/Linux: Press `Ctrl + Shift + R`
   - Mac: Press `Cmd + Shift + R`

2. **If that doesn't work, clear browser cache:**
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   - Firefox: Settings → Privacy → Clear Data → Cached Web Content
   - Safari: Safari → Clear History → All History

3. **Last resort:**
   - Close all browser tabs with the app
   - Clear browser cache completely
   - Restart browser
   - Open app again

## Monitoring

### What to Log

Your hosting platform should log:
- Deployment timestamps
- Bundle hash changes
- Cache hit/miss rates (if available)

### What to Check

After each deployment:
- [ ] New bundle hash generated
- [ ] index.html shows new cache-control headers
- [ ] Service worker updated with new timestamp
- [ ] App version incremented in app.json
- [ ] Build completed successfully
- [ ] No console errors in browser

## Troubleshooting

### Problem: Users still seeing old version after hours

**Solution:**
- Check if CDN is caching index.html (it shouldn't be)
- Verify CDN cache rules are configured correctly
- Manually purge CDN cache for index.html
- Check service worker registration in DevTools

### Problem: App doesn't work offline

**Solution:**
- Verify service worker is installed (DevTools → Application)
- Check cache storage has required assets
- Look for service worker errors in console

### Problem: Page keeps reloading

**Solution:**
- This happens if service worker detects constant updates
- Ensure build process is stable
- Check that BUILD_TIMESTAMP in service worker isn't changing on every request
- Verify CDN is not serving dynamic service-worker.js

### Problem: Service worker not updating

**Solution:**
- Unregister old service worker manually
- Hard refresh page
- Check browser console for service worker errors
- Verify service-worker.js is being fetched (Network tab)

## Best Practices

1. **Always increment version** in `app.json` before deploying
2. **Test locally first** with `npm run build:web`
3. **Verify bundle hash changes** in build output
4. **Check console logs** after deployment
5. **Monitor user reports** for caching issues
6. **Document deployments** with version numbers and timestamps
7. **Use semantic versioning**: MAJOR.MINOR.PATCH (e.g., 1.2.3)

## Summary

The cache-busting strategy ensures:
- ✅ Users always get the latest HTML (no-cache headers)
- ✅ New deployments force new bundles (content hashing)
- ✅ Service worker detects updates automatically (60s interval)
- ✅ Old caches are cleaned up automatically
- ✅ Offline support still works (network-first with fallback)
- ✅ Version tracking for debugging (console logs)

No manual intervention required - the system handles cache invalidation automatically!
