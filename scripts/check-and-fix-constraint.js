require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixConstraint() {
  try {
    console.log('🔍 Checking database constraints...');

    // First, let's try to update the role directly
    const { data: updateResult, error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('email', 'primbocm@gmail.com')
      .select('id, name, email, role');

    if (updateError) {
      console.error('❌ Update failed:', updateError.message);
      console.log('🔍 Error details:', updateError);
      
      // The constraint might not be properly set up. Let's try to drop and recreate it
      console.log('\n🔧 Attempting to fix the constraint...');
      
      try {
        // Drop the existing constraint
        const { error: dropError } = await supabase
          .rpc('exec_sql', {
            sql: 'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;'
          });

        if (dropError) {
          console.log('Could not drop constraint:', dropError);
        } else {
          console.log('✅ Dropped existing constraint');
        }

        // Recreate the constraint
        const { error: createError } = await supabase
          .rpc('exec_sql', {
            sql: "ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('client', 'barber', 'admin'));"
          });

        if (createError) {
          console.log('Could not recreate constraint:', createError);
        } else {
          console.log('✅ Recreated constraint with admin role');
        }

        // Now try the update again
        console.log('\n🔄 Trying update again...');
        const { data: retryResult, error: retryError } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('email', 'primbocm@gmail.com')
          .select('id, name, email, role');

        if (retryError) {
          console.error('❌ Update still failed:', retryError);
        } else {
          console.log('✅ Update successful:', retryResult);
          
          // Create barber record for super admin
          const { error: barberError } = await supabase
            .from('barbers')
            .insert({
              user_id: retryResult[0].id,
              is_developer: true,
              bio: 'Super Admin Account',
              status: 'active',
              onboarding_complete: true
            });

          if (barberError) {
            console.error('❌ Error creating barber record:', barberError);
          } else {
            console.log('✅ Super admin barber record created');
            console.log('\n🎉 Successfully upgraded to SUPER ADMIN!');
            console.log('🚀 You can now access the super admin panel at /super-admin');
          }
        }

      } catch (constraintError) {
        console.error('❌ Error fixing constraint:', constraintError);
      }
      
    } else {
      console.log('✅ Update successful:', updateResult);
      
      // Create barber record for super admin
      const { error: barberError } = await supabase
        .from('barbers')
        .insert({
          user_id: updateResult[0].id,
          is_developer: true,
          bio: 'Super Admin Account',
          status: 'active',
          onboarding_complete: true
        });

      if (barberError) {
        console.error('❌ Error creating barber record:', barberError);
      } else {
        console.log('✅ Super admin barber record created');
        console.log('\n🎉 Successfully upgraded to SUPER ADMIN!');
        console.log('🚀 You can now access the super admin panel at /super-admin');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAndFixConstraint(); 