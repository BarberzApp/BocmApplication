require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAdminRole(email) {
  try {
    console.log(`🔧 Fixing admin role for: ${email}`);

    // First, let's check the current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }

    console.log('Current profile data:', JSON.stringify(profile, null, 2));

    // Let's try to update with a more specific approach
    const { data: updateData, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .select();

    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      
      // Let's try to see what the exact constraint violation is
      console.log('\n🔍 Debugging constraint issue...');
      
      // Check if there are any other constraints
      const { data: constraintCheck, error: constraintError } = await supabase
        .rpc('get_table_constraints', { table_name: 'profiles' })
        .select();

      if (constraintError) {
        console.log('Could not check constraints:', constraintError);
      } else {
        console.log('Table constraints:', constraintCheck);
      }
      
      return;
    }

    console.log('✅ Profile updated successfully:', updateData);

    // Now create the barber record for super admin
    const { error: barberError } = await supabase
      .from('barbers')
      .insert({
        user_id: profile.id,
        is_developer: true,
        bio: 'Super Admin Account',
        status: 'active',
        onboarding_complete: true
      });

    if (barberError) {
      console.error('❌ Error creating barber record:', barberError);
      return;
    }

    console.log('✅ Super admin barber record created');

    console.log(`\n🎉 Successfully upgraded ${email} to SUPER ADMIN!`);
    console.log(`🚀 You can now access the super admin panel at /super-admin`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.log('Usage: node fix-admin-role.js <email>');
  console.log('Example: node fix-admin-role.js primbocm@gmail.com');
  process.exit(1);
}

fixAdminRole(email); 