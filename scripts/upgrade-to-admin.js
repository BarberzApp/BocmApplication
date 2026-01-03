require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function upgradeToAdmin(email, isSuperAdmin = false) {
  try {
    console.log(`🔧 Upgrading ${email} to ${isSuperAdmin ? 'super admin' : 'admin'}...`);

    // First, get the user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('email', email)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }

    if (!profile) {
      console.error('❌ No profile found for this email');
      return;
    }

    console.log(`✅ Found profile for: ${profile.name} (${profile.email})`);
    console.log(`📊 Current role: ${profile.role}`);

    // Update profile to admin role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', profile.id);

    if (updateError) {
      console.error('❌ Error updating profile role:', updateError);
      return;
    }

    console.log('✅ Profile role updated to admin');

    // If super admin, also create barber record with is_developer = true
    if (isSuperAdmin) {
      // Check if barber record already exists
      const { data: existingBarber, error: checkError } = await supabase
        .from('barbers')
        .select('id, is_developer')
        .eq('user_id', profile.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Error checking existing barber record:', checkError);
        return;
      }

      if (existingBarber) {
        // Update existing barber record
        const { error: updateBarberError } = await supabase
          .from('barbers')
          .update({ is_developer: true })
          .eq('id', existingBarber.id);

        if (updateBarberError) {
          console.error('❌ Error updating barber record:', updateBarberError);
          return;
        }

        console.log('✅ Updated existing barber record to super admin');
      } else {
        // Create new barber record
        const { error: createBarberError } = await supabase
          .from('barbers')
          .insert({
            user_id: profile.id,
            is_developer: true,
            bio: 'Super Admin Account',
            status: 'active',
            onboarding_complete: true
          });

        if (createBarberError) {
          console.error('❌ Error creating barber record:', createBarberError);
          return;
        }

        console.log('✅ Created new super admin barber record');
      }
    }

    console.log(`\n🎉 Successfully upgraded ${email} to ${isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN'}!`);
    console.log(`\n📋 Summary:`);
    console.log(`   📧 Email: ${email}`);
    console.log(`   👤 Name: ${profile.name}`);
    console.log(`   🔑 New Role: ${isSuperAdmin ? 'Super Admin' : 'Admin'}`);
    console.log(`   🆔 User ID: ${profile.id}`);
    
    if (isSuperAdmin) {
      console.log(`   👨‍💻 Developer Status: Enabled`);
    }

    console.log(`\n🚀 You can now access the super admin panel at /super-admin`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Command line interface
const email = process.argv[2];
const isSuperAdmin = process.argv[3] === '--super';

if (!email) {
  console.log('Usage: node upgrade-to-admin.js <email> [--super]');
  console.log('Example: node upgrade-to-admin.js primbocm@gmail.com');
  console.log('Example: node upgrade-to-admin.js primbocm@gmail.com --super');
  process.exit(1);
}

upgradeToAdmin(email, isSuperAdmin); 