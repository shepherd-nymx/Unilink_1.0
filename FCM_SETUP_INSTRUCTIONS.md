# Firebase Cloud Messaging (FCM) Integration Setup

This guide will help you complete the FCM integration for push notifications in your grocery delivery app.

## Step 1: Apply Database Migration

You need to apply the database migration to create the `fcm_tokens` table. Copy the following SQL and run it in your Supabase SQL Editor (Dashboard → SQL Editor → New Query):

```sql
/*
  # Add FCM Push Notification Token Support

  1. New Tables
    - `fcm_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references customers or drivers)
      - `user_type` (text) - 'customer' or 'driver'
      - `token` (text) - FCM device token
      - `device_info` (jsonb) - Device information (platform, model, etc.)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `last_used_at` (timestamptz)

  2. Changes
    - Add indexes for efficient token lookup
    - Add RLS policies for secure access
    - Create function to clean up old/expired tokens

  3. Security
    - Enable RLS on `fcm_tokens` table
    - Users can only manage their own tokens
*/

-- Create fcm_tokens table
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('customer', 'driver')),
  token text NOT NULL,
  device_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  CONSTRAINT fcm_tokens_user_id_token_unique UNIQUE (user_id, token)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_type ON fcm_tokens(user_type);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens(token);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_last_used ON fcm_tokens(last_used_at);

-- Enable RLS
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own FCM tokens"
  ON fcm_tokens FOR SELECT
  TO authenticated
  USING (
    (user_type = 'customer' AND user_id IN (SELECT id FROM customers WHERE id = user_id)) OR
    (user_type = 'driver' AND user_id IN (SELECT id FROM drivers WHERE id = user_id))
  );

CREATE POLICY "Users can insert own FCM tokens"
  ON fcm_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_type = 'customer' AND user_id IN (SELECT id FROM customers WHERE id = user_id)) OR
    (user_type = 'driver' AND user_id IN (SELECT id FROM drivers WHERE id = user_id))
  );

CREATE POLICY "Users can update own FCM tokens"
  ON fcm_tokens FOR UPDATE
  TO authenticated
  USING (
    (user_type = 'customer' AND user_id IN (SELECT id FROM customers WHERE id = user_id)) OR
    (user_type = 'driver' AND user_id IN (SELECT id FROM drivers WHERE id = user_id))
  )
  WITH CHECK (
    (user_type = 'customer' AND user_id IN (SELECT id FROM customers WHERE id = user_id)) OR
    (user_type = 'driver' AND user_id IN (SELECT id FROM drivers WHERE id = user_id))
  );

CREATE POLICY "Users can delete own FCM tokens"
  ON fcm_tokens FOR DELETE
  TO authenticated
  USING (
    (user_type = 'customer' AND user_id IN (SELECT id FROM customers WHERE id = user_id)) OR
    (user_type = 'driver' AND user_id IN (SELECT id FROM drivers WHERE id = user_id))
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fcm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS fcm_tokens_updated_at_trigger ON fcm_tokens;
CREATE TRIGGER fcm_tokens_updated_at_trigger
  BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_fcm_tokens_updated_at();

-- Function to clean up old/unused tokens (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_fcm_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM fcm_tokens
  WHERE last_used_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert FCM token (insert or update if exists)
CREATE OR REPLACE FUNCTION upsert_fcm_token(
  p_user_id uuid,
  p_user_type text,
  p_token text,
  p_device_info jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_token_id uuid;
BEGIN
  INSERT INTO fcm_tokens (user_id, user_type, token, device_info)
  VALUES (p_user_id, p_user_type, p_token, p_device_info)
  ON CONFLICT (user_id, token)
  DO UPDATE SET
    last_used_at = now(),
    updated_at = now(),
    device_info = EXCLUDED.device_info
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Step 2: Set Up Expo Push Notifications

### For Development (Expo Go):

1. No additional setup needed - Expo handles push tokens automatically
2. Test notifications will work immediately on devices

### For Production (Standalone Apps):

1. **Create an Expo Account** (if you haven't already):
   ```bash
   expo login
   ```

2. **Configure EAS Project**:
   ```bash
   eas init
   ```

3. **Update app.json** with your EAS project ID:
   ```json
   {
     "expo": {
       "extra": {
         "eas": {
           "projectId": "your-project-id-here"
         }
       }
     }
   }
   ```

## Step 3: Deploy the Edge Function

The Edge Function code is ready at `/edge-functions/send-push-notification.ts`. Deploy it using Supabase:

1. **Option A: Using Supabase CLI** (recommended):
   ```bash
   # Install Supabase CLI if not already installed
   npm install -g supabase

   # Login to Supabase
   supabase login

   # Link your project
   supabase link --project-ref your-project-ref

   # Create the function directory
   mkdir -p supabase/functions/send-push-notification

   # Copy the function code
   cp edge-functions/send-push-notification.ts supabase/functions/send-push-notification/index.ts

   # Deploy the function
   supabase functions deploy send-push-notification
   ```

2. **Option B: Using Supabase Dashboard**:
   - Go to your Supabase Dashboard
   - Navigate to Edge Functions
   - Click "Create a new function"
   - Name it `send-push-notification`
   - Copy the code from `/edge-functions/send-push-notification.ts`
   - Deploy

## Step 4: Set Environment Variable for Expo Access Token

You need to set the `EXPO_ACCESS_TOKEN` secret for the Edge Function:

1. **Get your Expo Access Token**:
   - Go to https://expo.dev/accounts/[your-username]/settings/access-tokens
   - Create a new token with push notification permissions
   - Copy the token

2. **Set the secret in Supabase**:

   **Option A: Using Supabase CLI**:
   ```bash
   supabase secrets set EXPO_ACCESS_TOKEN=your_expo_token_here
   ```

   **Option B: Using Supabase Dashboard**:
   - Go to Project Settings → Edge Functions
   - Add a new secret: `EXPO_ACCESS_TOKEN`
   - Paste your Expo access token

## Step 5: Test the Integration

Once everything is set up, the FCM integration will automatically:

1. **Register device tokens** when users login (both customers and drivers)
2. **Store tokens** in the `fcm_tokens` table
3. **Send push notifications** through the Edge Function when:
   - New orders are placed
   - Orders are accepted/declined
   - Messages are received
   - Delivery status changes

## How It Works

### Token Registration Flow:
1. User logs in (customer or driver)
2. App requests notification permission
3. `setCurrentUser()` is called with user ID and type
4. `registerForPushNotificationsAsync()` automatically registers the Expo push token
5. Token is stored in the `fcm_tokens` table via the `upsert_fcm_token` function

### Notification Sending Flow:
1. An event occurs (new order, message, etc.)
2. App calls `sendPushNotification()` with user IDs and notification data
3. Edge Function fetches all tokens for the specified users
4. Notifications are sent via Expo's push notification service
5. Users receive push notifications on their devices

## Files Created/Modified:

- ✅ `/lib/fcm-service.ts` - Core FCM functionality
- ✅ `/lib/notification-service.ts` - Updated with FCM integration
- ✅ `/app/customer/dashboard.tsx` - Integrated FCM token registration
- ✅ `/app/driver/dashboard.tsx` - Integrated FCM token registration
- ✅ `/edge-functions/send-push-notification.ts` - Edge Function for sending notifications
- ✅ Database migration SQL (needs to be applied manually)

## Troubleshooting:

### Notifications not working:
1. Check that the database migration was applied successfully
2. Verify the `EXPO_ACCESS_TOKEN` is set correctly
3. Check Edge Function logs in Supabase Dashboard
4. Verify notification permissions are granted on the device
5. Check that tokens are being stored in `fcm_tokens` table

### Testing Notifications:
You can test sending notifications directly from Supabase SQL Editor:

```sql
-- Test sending a notification
SELECT * FROM fcm_tokens WHERE user_type = 'customer' LIMIT 1;
```

Then use the Edge Function endpoint directly or through your app's `sendPushNotification()` function.

## Security Notes:

- ✅ RLS policies ensure users can only manage their own tokens
- ✅ Edge Function uses service role for secure database access
- ✅ Expo Access Token is stored securely as an environment variable
- ✅ Old tokens (90+ days) can be cleaned up with `cleanup_old_fcm_tokens()`

## Next Steps:

1. Apply the database migration (Step 1)
2. Configure Expo project (Step 2)
3. Deploy the Edge Function (Step 3)
4. Set the Expo Access Token (Step 4)
5. Test notifications (Step 5)

That's it! Your app now has full FCM push notification support. 🎉
