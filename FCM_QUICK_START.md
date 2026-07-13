# FCM Integration - Quick Start Guide

## ✅ What's Already Done

The FCM (Firebase Cloud Messaging) integration has been fully implemented in your codebase:

1. **FCM Service** (`lib/fcm-service.ts`) - Handles token registration and management
2. **Notification Service** (`lib/notification-service.ts`) - Integrated with FCM
3. **Customer Dashboard** - Auto-registers FCM tokens on login
4. **Driver Dashboard** - Auto-registers FCM tokens on login
5. **Edge Function** - Ready to send push notifications via Expo
6. **Database Schema** - SQL migration ready to apply

## 🚀 3-Step Setup

### Step 1: Apply Database Migration (2 minutes)

1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy the SQL from `FCM_SETUP_INSTRUCTIONS.md` (starts with `CREATE TABLE IF NOT EXISTS fcm_tokens`)
4. Run it

### Step 2: Deploy Edge Function (3 minutes)

Copy the file from `/edge-functions/send-push-notification.ts` and deploy to Supabase:

**Quick Deploy:**
```bash
# Option 1: Via Dashboard
# Go to Supabase Dashboard → Edge Functions → Create New
# Name: send-push-notification
# Paste code from edge-functions/send-push-notification.ts

# Option 2: Via CLI (if you have Supabase CLI)
mkdir -p supabase/functions/send-push-notification
cp edge-functions/send-push-notification.ts supabase/functions/send-push-notification/index.ts
supabase functions deploy send-push-notification
```

### Step 3: Add Expo Access Token (2 minutes)

1. Get token from: https://expo.dev/accounts/[username]/settings/access-tokens
2. Create a new token with push notification permissions
3. Add to Supabase:
   - Dashboard → Project Settings → Edge Functions → Secrets
   - Add: `EXPO_ACCESS_TOKEN` = your token

## 🎯 How It Works

Once setup is complete:

- ✅ Users automatically register for push notifications on login
- ✅ Device tokens are stored securely in `fcm_tokens` table
- ✅ Notifications are sent through your Edge Function
- ✅ Push notifications work on iOS, Android, and web (via Expo)

## 📱 Sending Notifications

Use the built-in function anywhere in your app:

```typescript
import { sendPushNotification } from '@/lib/fcm-service';

// Send to specific users
await sendPushNotification(
  ['user-id-1', 'user-id-2'],
  'customer', // or 'driver'
  'New Order!',
  'Your order has been accepted',
  { orderId: '123', type: 'order_update' }
);
```

## 🔧 Testing

After setup, test by:

1. Login as a customer or driver
2. Check Supabase `fcm_tokens` table - your token should appear
3. Trigger an event (place order, send message)
4. Push notification should arrive on device

## 📋 Checklist

- [ ] Database migration applied
- [ ] Edge Function deployed
- [ ] Expo Access Token added
- [ ] Test notification received

## 🆘 Need Help?

See `FCM_SETUP_INSTRUCTIONS.md` for detailed setup guide and troubleshooting.

---

**Total setup time: ~7 minutes** ⏱️
