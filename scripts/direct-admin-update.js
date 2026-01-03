require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function directAdminUpdate(email) {
  try {
    console.log(`🔧 Directly updating admin role for: ${email}`);

    // Use raw SQL to update the role
    const { data, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          UPDATE profiles 
          SET role = 'admin', updated_at = NOW() 
          WHERE email = $1
          RETURNING id, name, email, role;
        `,
        params: [email]
      });

    if (error) {
      console.error('❌ Error with raw SQL update:', error);
      
      // Try alternative approach - check if the constraint exists
      console.log('\n🔍 Trying alternative approach...');
      
      // First, let's check what roles are currently in the database
      const { data: roles, error: rolesError } = await supabase
        .from('profiles')
        .select('role')
        .limit(10);

      if (rolesError) {
        console.error('❌ Error checking roles:', rolesError);
      } else {
        console.log('Current roles in database:', roles.map(r => r.role));
      }
      
      return;
    }

    console.log('✅ Raw SQL update result:', data);

    // Now get the profile to create barber record
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('email', email)
      .single();

    if (profileError) {
      console.error('❌ Error fetching updated profile:', profileError);
      return;
    }

    console.log('✅ Updated profile:', profile);

    // Create barber record for super admin
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
  console.log('Usage: node direct-admin-update.js <email>');
  console.log('Example: node direct-admin-update.js primbocm@gmail.com');
  process.exit(1);
}

directAdminUpdate(email); 