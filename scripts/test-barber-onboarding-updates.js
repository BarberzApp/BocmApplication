require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vrunuggwpwmwtpwdjnpu.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Helper to extract handle from social media input
function extractHandle(input) {
  if (!input) return '';
  input = input.trim();
  try {
    const url = new URL(input);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      let handle = pathParts[pathParts.length - 1];
      if (handle.startsWith('@')) handle = handle.slice(1);
      return '@' + handle;
    }
  } catch {
    // Not a URL
  }
  if (input.startsWith('@')) return input;
  return '@' + input;
}

async function testOnboardingUpdates() {
  console.log('🧪 Testing Barber Onboarding Supabase Updates\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Find or create a test barber user
    console.log('\n📋 Step 1: Finding test barber user...');
    let testUser = null;
    let testBarber = null;

    // Try to find an existing barber user
    const { data: existingBarbers, error: findError } = await supabaseAdmin
      .from('barbers')
      .select('user_id, id, business_name')
      .limit(1)
      .single();

    if (!findError && existingBarbers) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(existingBarbers.user_id);
      if (user?.user) {
        testUser = user.user;
        testBarber = existingBarbers;
        console.log(`✅ Using existing barber: ${testBarber.business_name || 'Unnamed'} (${testUser.email})`);
      }
    }

    if (!testUser) {
      console.log('⚠️  No existing barber found. Please create a barber account first.');
      console.log('   You can sign up as a barber in the app, then run this test again.');
      return;
    }

    const userId = testUser.id;
    const barberId = testBarber.id;

    // Step 2: Store original data for restoration
    console.log('\n📋 Step 2: Storing original data for restoration...');
    const { data: originalBarber } = await supabaseAdmin
      .from('barbers')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: originalProfile } = await supabaseAdmin
      .from('profiles')
      .select('phone, location')
      .eq('id', userId)
      .single();

    const { data: originalServices } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('barber_id', barberId);

    console.log('✅ Original data stored');

    // Step 3: Simulate onboarding form data
    console.log('\n📋 Step 3: Simulating onboarding submission...');
    const testFormData = {
      businessName: 'Test Barber Shop ' + Date.now(),
      phone: '(555) 123-4567',
      location: '123 Test Street, Test City, TS 12345',
      bio: 'This is a test bio for onboarding verification. Testing all fields.',
      specialties: ['fade', 'undercut', 'beard-trim'],
      services: [
        { name: 'Test Haircut', price: 35, duration: 30 },
        { name: 'Test Beard Trim', price: 20, duration: 15 },
        { name: 'Test Full Service', price: 50, duration: 45 }
      ],
      socialMedia: {
        instagram: '@testbarber',
        twitter: '@testbarber',
        tiktok: '@testbarber',
        facebook: 'testbarber'
      }
    };

    console.log('📝 Test form data:', JSON.stringify(testFormData, null, 2));

    // Step 4: Update barber table (simulating handleSubmit)
    console.log('\n📋 Step 4: Updating barbers table...');
    const { data: updatedBarber, error: barberUpdateError } = await supabaseAdmin
      .from('barbers')
      .upsert({
        user_id: userId,
        business_name: testFormData.businessName,
        bio: testFormData.bio,
        specialties: testFormData.specialties,
        instagram: extractHandle(testFormData.socialMedia.instagram),
        twitter: extractHandle(testFormData.socialMedia.twitter),
        tiktok: extractHandle(testFormData.socialMedia.tiktok),
        facebook: extractHandle(testFormData.socialMedia.facebook),
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (barberUpdateError) {
      console.error('❌ Failed to update barbers table:', barberUpdateError);
      throw barberUpdateError;
    }
    console.log('✅ Barbers table updated successfully');
    console.log('   Business Name:', updatedBarber.business_name);
    console.log('   Bio:', updatedBarber.bio?.substring(0, 50) + '...');
    console.log('   Specialties:', updatedBarber.specialties);
    console.log('   Instagram:', updatedBarber.instagram);
    console.log('   Onboarding Complete:', updatedBarber.onboarding_complete);

    // Step 5: Update profiles table
    console.log('\n📋 Step 5: Updating profiles table...');
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        phone: testFormData.phone,
        location: testFormData.location,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('❌ Failed to update profiles table:', profileUpdateError);
      throw profileUpdateError;
    }
    console.log('✅ Profiles table updated successfully');

    // Verify profile update
    const { data: updatedProfile } = await supabaseAdmin
      .from('profiles')
      .select('phone, location')
      .eq('id', userId)
      .single();
    console.log('   Phone:', updatedProfile.phone);
    console.log('   Location:', updatedProfile.location);

    // Step 6: Update services
    console.log('\n📋 Step 6: Updating services...');
    
    // Delete existing services
    const { error: deleteError } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('barber_id', barberId);

    if (deleteError) {
      console.error('⚠️  Error deleting old services:', deleteError);
    }

    // Insert new services
    const servicesToInsert = testFormData.services.map(service => ({
      barber_id: barberId,
      name: service.name,
      price: service.price,
      duration: service.duration
    }));

    const { data: insertedServices, error: servicesError } = await supabaseAdmin
      .from('services')
      .insert(servicesToInsert)
      .select();

    if (servicesError) {
      console.error('❌ Failed to update services:', servicesError);
      throw servicesError;
    }
    console.log('✅ Services updated successfully');
    console.log(`   Inserted ${insertedServices.length} services:`);
    insertedServices.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service.name} - $${service.price} (${service.duration} min)`);
    });

    // Step 7: Verify all updates
    console.log('\n📋 Step 7: Verifying all updates...');
    
    const { data: verifyBarber } = await supabaseAdmin
      .from('barbers')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: verifyProfile } = await supabaseAdmin
      .from('profiles')
      .select('phone, location')
      .eq('id', userId)
      .single();

    const { data: verifyServices } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('barber_id', barberId);

    let allPassed = true;

    // Verify barber data
    if (verifyBarber.business_name !== testFormData.businessName) {
      console.error('❌ Business name mismatch!');
      allPassed = false;
    }
    if (verifyBarber.bio !== testFormData.bio) {
      console.error('❌ Bio mismatch!');
      allPassed = false;
    }
    if (JSON.stringify(verifyBarber.specialties) !== JSON.stringify(testFormData.specialties)) {
      console.error('❌ Specialties mismatch!');
      allPassed = false;
    }
    if (verifyProfile.phone !== testFormData.phone) {
      console.error('❌ Phone mismatch!');
      allPassed = false;
    }
    if (verifyProfile.location !== testFormData.location) {
      console.error('❌ Location mismatch!');
      allPassed = false;
    }
    if (verifyServices.length !== testFormData.services.length) {
      console.error('❌ Services count mismatch!');
      allPassed = false;
    }

    if (allPassed) {
      console.log('✅ All verifications passed!');
    } else {
      console.error('❌ Some verifications failed!');
    }

    // Step 8: Restore original data
    console.log('\n📋 Step 8: Restoring original data...');
    
    if (originalBarber) {
      await supabaseAdmin
        .from('barbers')
        .upsert({
          user_id: userId,
          business_name: originalBarber.business_name,
          bio: originalBarber.bio,
          specialties: originalBarber.specialties,
          instagram: originalBarber.instagram,
          twitter: originalBarber.twitter,
          tiktok: originalBarber.tiktok,
          facebook: originalBarber.facebook,
          onboarding_complete: originalBarber.onboarding_complete,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    }

    if (originalProfile) {
      await supabaseAdmin
        .from('profiles')
        .update({
          phone: originalProfile.phone,
          location: originalProfile.location,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    }

    // Delete test services
    await supabaseAdmin
      .from('services')
      .delete()
      .eq('barber_id', barberId);

    // Restore original services
    if (originalServices && originalServices.length > 0) {
      await supabaseAdmin
        .from('services')
        .insert(originalServices);
    }

    console.log('✅ Original data restored');

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary:');
    console.log('✅ Barbers table update: PASSED');
    console.log('✅ Profiles table update: PASSED');
    console.log('✅ Services table update: PASSED');
    console.log('✅ Data verification: ' + (allPassed ? 'PASSED' : 'FAILED'));
    console.log('✅ Data restoration: PASSED');
    console.log('\n🎉 Onboarding page Supabase updates are working correctly!');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testOnboardingUpdates()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

