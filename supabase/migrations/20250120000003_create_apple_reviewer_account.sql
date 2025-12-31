-- Migration to create Apple Reviewer account
-- This migration assumes the auth user is created via Supabase Dashboard
-- See instructions below

-- Step 1: Create the auth user in Supabase Dashboard
-- Go to: Authentication > Users > Add User
-- Email: apple.reviewer@bocmstyle.com
-- Password: AppleReview123!
-- Auto Confirm User: ON
-- 
-- After creating the user, get the user ID from the users list

-- Step 2: Run this migration after creating the auth user
-- Replace USER_ID_HERE with the actual user ID from auth.users

DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'apple.reviewer@bocmstyle.com';
BEGIN
    -- Try to find the user ID from auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_email
    LIMIT 1;

    -- If user exists, ensure profile is set up correctly
    IF v_user_id IS NOT NULL THEN
        -- Insert or update the profile
        INSERT INTO public.profiles (
            id,
            name,
            email,
            role,
            is_public,
            email_notifications,
            sms_notifications,
            marketing_emails
        ) VALUES (
            v_user_id,
            'Apple Reviewer',
            v_email,
            'client',
            true,
            true,
            true,
            false
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            is_public = EXCLUDED.is_public,
            email_notifications = EXCLUDED.email_notifications,
            sms_notifications = EXCLUDED.sms_notifications,
            marketing_emails = EXCLUDED.marketing_emails;
        
        RAISE NOTICE '✅ Apple Reviewer profile created/updated for user: %', v_user_id;
    ELSE
        RAISE WARNING '⚠️  Auth user not found. Please create the user first in Supabase Dashboard (Authentication > Users)';
        RAISE WARNING 'Email: apple.reviewer@bocmstyle.com';
        RAISE WARNING 'Password: AppleReview123!';
        RAISE WARNING 'Then run this migration again.';
    END IF;
END $$;

-- Verify the profile was created
SELECT 
    id,
    email,
    name,
    role,
    is_public,
    created_at
FROM public.profiles
WHERE email = 'apple.reviewer@bocmstyle.com';

