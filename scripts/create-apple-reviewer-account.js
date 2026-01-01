require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAppleReviewerAccount() {
  try {
    console.log('🍎 Creating Apple Reviewer Account...\n');

    // Apple reviewer credentials - simple and memorable
    const email = 'apple.reviewer@bocmstyle.com';
    const password = 'AppleReview123!';
    const name = 'Apple Reviewer';

    // Check if user already exists by checking profiles table first (more reliable)
    let existingUser = null;
    let existingProfile = null;
    
    // First check profiles table
    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single();
    
    if (profileCheck) {
      existingProfile = profileCheck;
      console.log('📋 Found existing profile, fetching auth user...');
    }
    
    // Then check auth users
    try {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      existingUser = existingUsers?.users?.find(user => user.email === email);
      
      // If we found a profile but not in auth, use the profile's id
      if (existingProfile && !existingUser) {
        // Try to get user by ID from profile
        try {
          const { data: userById } = await supabase.auth.admin.getUserById(existingProfile.id);
          if (userById?.user) {
            existingUser = userById.user;
          }
        } catch (getUserError) {
          // User might not exist in auth, that's okay - we'll create it
          console.log('⚠️  Profile exists but auth user not found, will create auth user...');
        }
      }
    } catch (listError) {
      console.log('⚠️  Could not list existing users, will try to create new user...');
    }

    if (existingUser) {
      console.log('✅ Apple reviewer account already exists');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
      console.log(`👤 User ID: ${existingUser.id}\n`);

      // Update password to ensure it's correct
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: password }
      );

      if (updateError) {
        console.error('❌ Error updating password:', updateError);
      } else {
        console.log('✅ Password updated');
      }

      // Check if profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingUser.id)
        .single();

      if (!profile) {
        console.log('🔄 Creating profile for existing user...');
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: existingUser.id,
            name: name,
            email: email,
            role: 'client',
            is_public: true,
            email_notifications: true,
            sms_notifications: true,
            marketing_emails: false
          });

        if (profileError) {
          console.error('❌ Error creating profile:', profileError);
        } else {
          console.log('✅ Apple reviewer profile created');
        }
      } else {
        console.log('✅ Apple reviewer profile already exists');
        // Update profile to ensure role is client
        if (profile.role !== 'client') {
          const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({ role: 'client' })
            .eq('id', existingUser.id);

          if (updateProfileError) {
            console.error('❌ Error updating profile role:', updateProfileError);
          } else {
            console.log('✅ Profile role updated to client');
          }
        }
      }

      console.log('\n📋 Account Information:');
      console.log('==================');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
      console.log(`👤 Name: ${name}`);
      console.log(`🔑 Role: client`);
      console.log('\n✅ Apple reviewer account is ready to use!');
      return;
    }

    // Create new Apple reviewer user
    console.log('🔄 Creating new Apple reviewer user...');
    let authData = null;
    const { data: newAuthData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Pre-confirm email so reviewers can login immediately
      user_metadata: {
        name: name,
        role: 'client'
      }
    });

    if (authError) {
      // Check if error is because user already exists (various error formats)
      if (authError.message?.includes('already registered') || 
          authError.message?.includes('already exists') ||
          authError.message?.includes('Database error creating new user') ||
          authError.status === 422 ||
          authError.code === 'unexpected_failure') {
        console.log('⚠️  User may already exist or database error occurred, checking...');
        
        // Try to find the user by checking profiles table first
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', email)
          .single();
        
        let retryUser = null;
        
        if (profileData) {
          // Try to get the auth user by ID
          try {
            const { data: userData } = await supabase.auth.admin.getUserById(profileData.id);
            retryUser = userData?.user;
          } catch (getUserError) {
            // Auth user doesn't exist, continue to create
          }
        }
        
        // Also try listUsers as fallback
        if (!retryUser) {
          const { data: retryUsers } = await supabase.auth.admin.listUsers();
          retryUser = retryUsers?.users?.find(user => user.email === email);
        }
        
        if (retryUser) {
          console.log('✅ User already exists, updating password and profile...');
          existingUser = retryUser;
          
          // Handle existing user (similar to code above)
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: password }
          );

          if (updateError) {
            console.error('❌ Error updating password:', updateError);
          } else {
            console.log('✅ Password updated');
          }

          // Check if profile exists
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', existingUser.id)
            .single();

          if (!profile) {
            console.log('🔄 Creating profile for existing user...');
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: existingUser.id,
                name: name,
                email: email,
                role: 'client',
                is_public: true,
                email_notifications: true,
                sms_notifications: true,
                marketing_emails: false
              });

            if (profileError) {
              console.error('❌ Error creating profile:', profileError);
            } else {
              console.log('✅ Apple reviewer profile created');
            }
          } else {
            console.log('✅ Apple reviewer profile already exists');
            // Update profile to ensure role is client
            if (profile.role !== 'client') {
              const { error: updateProfileError } = await supabase
                .from('profiles')
                .update({ role: 'client' })
                .eq('id', existingUser.id);

              if (updateProfileError) {
                console.error('❌ Error updating profile role:', updateProfileError);
              } else {
                console.log('✅ Profile role updated to client');
              }
            }
          }

          console.log('\n📋 Account Information:');
          console.log('==================');
          console.log(`📧 Email: ${email}`);
          console.log(`🔑 Password: ${password}`);
          console.log(`👤 Name: ${name}`);
          console.log(`🔑 Role: client`);
          console.log('\n✅ Apple reviewer account is ready to use!');
          return;
        } else {
          console.error('❌ Error creating auth user:', authError);
          console.error('   Details:', authError.message);
          return;
        }
      } else {
        console.error('❌ Error creating auth user:', authError);
        console.error('   Details:', authError.message);
        return;
      }
    }

    authData = newAuthData;
    console.log('✅ Auth user created:', authData.user.id);

    // Check if profile was created by trigger
    const { data: profile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileCheckError || !profile) {
      // Create profile manually
      console.log('🔄 Creating profile manually...');
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          name: name,
          email: email,
          role: 'client',
          is_public: true,
          email_notifications: true,
          sms_notifications: true,
          marketing_emails: false
        });

      if (profileError) {
        console.error('❌ Error creating profile:', profileError);
        return;
      }

      console.log('✅ Apple reviewer profile created');
    } else {
      console.log('✅ Apple reviewer profile already exists (created by trigger)');
      // Ensure profile has correct settings
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
          role: 'client',
          is_public: true
        })
        .eq('id', authData.user.id);

      if (updateProfileError) {
        console.error('❌ Error updating profile:', updateProfileError);
      } else {
        console.log('✅ Profile settings updated');
      }
    }

    console.log('\n🎉 Apple reviewer account created successfully!');
    console.log('\n📋 Account Information:');
    console.log('==================');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Name: ${name}`);
    console.log(`🔑 Role: client`);
    console.log(`👤 User ID: ${authData.user.id}`);
    console.log('\n💡 Add these credentials to App Store Connect > App Review Information');
    console.log('   so Apple reviewers can test your app.\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
createAppleReviewerAccount();

