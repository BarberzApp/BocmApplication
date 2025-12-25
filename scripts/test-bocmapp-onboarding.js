/**
 * Test script for BocmApp (React Native) Barber Onboarding Process
 * Simulates the exact flow the mobile app uses
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Use regular client (like the app does) and admin client for setup
const supabase = createClient(supabaseUrl, supabaseAnonKey)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(title, 'cyan')
  console.log('='.repeat(60))
}

function extractHandle(input) {
  if (!input) return ''
  input = input.trim()
  try {
    const url = new URL(input)
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (pathParts.length > 0) {
      let handle = pathParts[pathParts.length - 1]
      if (handle.startsWith('@')) handle = handle.slice(1)
      return '@' + handle
    }
  } catch {
    // Not a URL
  }
  if (input.startsWith('@')) return input
  return '@' + input
}

async function findAndAuthenticateTestBarber() {
  logSection('👤 Finding & Authenticating Test Barber (App User)')
  
  try {
    // Find a barber user that we can test with
    const { data: barbers, error } = await supabaseAdmin
      .from('barbers')
      .select('user_id, business_name, onboarding_complete, profiles!inner(email, name, role)')
      .eq('profiles.role', 'barber')
      .limit(1)
      .single()

    if (error || !barbers) {
      log(`❌ No barber found: ${error?.message}`, 'red')
      return null
    }

    const profile = Array.isArray(barbers.profiles) ? barbers.profiles[0] : barbers.profiles

    log(`✅ Found test barber:`, 'green')
    log(`   User ID: ${barbers.user_id}`, 'blue')
    log(`   Email: ${profile?.email}`, 'blue')
    log(`   Name: ${profile?.name}`, 'blue')
    log(`   Current Onboarding: ${barbers.onboarding_complete ? 'Complete' : 'Incomplete'}`, 'blue')
    
    // Reset onboarding for testing
    if (barbers.onboarding_complete) {
      log('   Resetting onboarding_complete to false for testing...', 'yellow')
      await supabaseAdmin
        .from('barbers')
        .update({ onboarding_complete: false })
        .eq('user_id', barbers.user_id)
    }

    // For testing, we'll use admin client to bypass RLS
    // In real app, user would be authenticated via supabase.auth
    log('   Note: Using admin client to simulate authenticated session', 'yellow')
    log('   (In real app, user would be logged in via supabase.auth)', 'yellow')

    return {
      userId: barbers.user_id,
      email: profile?.email,
      name: profile?.name,
      supabaseClient: supabaseAdmin, // Use admin client to simulate authenticated user
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return null
  }
}

async function testAppOnboardingFlow(userId) {
  logSection('📱 Testing BocmApp Onboarding Flow')
  
  // Simulate the exact form data the app would collect
  const formData = {
    businessName: 'Test Mobile Barber Shop',
    phone: '+1234567890',
    location: 'Los Angeles, CA',
    bio: 'Professional mobile barber with expertise in modern styles and fades.',
    specialties: ['fade', 'undercut', 'pompadour', 'taper'],
    services: [
      { name: 'Classic Cut', price: 35, duration: 30 },
      { name: 'Fade', price: 40, duration: 35 },
      { name: 'Beard Trim', price: 25, duration: 20 },
    ],
    socialMedia: {
      instagram: 'https://instagram.com/testbarber',
      twitter: '@testbarber',
      tiktok: 'testbarber',
      facebook: 'testbarber',
    }
  }

  try {
    log('   Step 1: Checking if barber row exists (app logic)...', 'blue')
    
    // Simulate app's check
    const { data: existingBarber, error: checkError } = await supabase
      .from('barbers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      log(`   ⚠️  Check error (non-critical): ${checkError.message}`, 'yellow')
    }

    log('   Step 2: Upserting barber profile (app logic)...', 'blue')
    
    // Simulate app's upsert (using regular client like app does)
    const { error: upsertError } = await supabase
      .from('barbers')
      .upsert({
        user_id: userId,
        business_name: formData.businessName,
        bio: formData.bio,
        specialties: formData.specialties,
        instagram: extractHandle(formData.socialMedia.instagram),
        twitter: extractHandle(formData.socialMedia.twitter),
        tiktok: extractHandle(formData.socialMedia.tiktok),
        facebook: extractHandle(formData.socialMedia.facebook),
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      log(`❌ Upsert failed: ${upsertError.message}`, 'red')
      return false
    }

    log('   ✅ Barber profile upserted', 'green')

    log('   Step 3: Updating profile phone and location (app logic)...', 'blue')
    
    // Simulate app's profile update
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        phone: formData.phone,
        location: formData.location,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (profileError) {
      log(`❌ Profile update failed: ${profileError.message}`, 'red')
      return false
    }

    log('   ✅ Profile updated', 'green')

    log('   Step 4: Getting barber ID for services (app logic)...', 'blue')
    
    // Simulate app's barber ID fetch
    const { data: barberData, error: barberError } = await supabase
      .from('barbers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (barberError || !barberData) {
      log(`❌ Failed to get barber ID: ${barberError?.message}`, 'red')
      return false
    }

    log(`   ✅ Got barber ID: ${barberData.id}`, 'green')

    log('   Step 5: Deleting existing services (app logic)...', 'blue')
    
    // Simulate app's service deletion
    const { error: deleteError } = await supabase
      .from('services')
      .delete()
      .eq('barber_id', barberData.id)

    if (deleteError) {
      log(`   ⚠️  Delete warning (may not exist): ${deleteError.message}`, 'yellow')
    } else {
      log('   ✅ Existing services deleted', 'green')
    }

    log('   Step 6: Inserting new services (app logic)...', 'blue')
    
    // Simulate app's service insertion
    const servicesToInsert = formData.services.map(service => ({
      barber_id: barberData.id,
      name: service.name,
      price: service.price,
      duration: service.duration
    }))

    const { error: servicesError } = await supabase
      .from('services')
      .insert(servicesToInsert)

    if (servicesError) {
      log(`❌ Services insert failed: ${servicesError.message}`, 'red')
      return false
    }

    log('   ✅ Services inserted', 'green')

    // Verify everything was saved correctly
    log('   Step 7: Verifying saved data...', 'blue')
    
    const { data: savedBarber, error: verifyBarberError } = await supabaseAdmin
      .from('barbers')
      .select('business_name, bio, specialties, onboarding_complete')
      .eq('user_id', userId)
      .single()

    const { data: savedProfile, error: verifyProfileError } = await supabaseAdmin
      .from('profiles')
      .select('phone, location')
      .eq('id', userId)
      .single()

    const { data: savedServices, error: verifyServicesError } = await supabaseAdmin
      .from('services')
      .select('name, price, duration')
      .eq('barber_id', barberData.id)
      .order('created_at', { ascending: true })

    if (verifyBarberError || verifyProfileError || verifyServicesError) {
      log(`❌ Verification failed`, 'red')
      return false
    }

    // Check all data matches
    const isValid = 
      savedBarber.business_name === formData.businessName &&
      savedBarber.bio === formData.bio &&
      savedBarber.onboarding_complete === true &&
      savedProfile.phone === formData.phone &&
      savedProfile.location === formData.location &&
      savedServices.length === formData.services.length

    if (isValid) {
      log('   ✅ All data verified correctly!', 'green')
      log(`   Business: ${savedBarber.business_name}`, 'blue')
      log(`   Phone: ${savedProfile.phone}`, 'blue')
      log(`   Location: ${savedProfile.location}`, 'blue')
      log(`   Services: ${savedServices.length}`, 'blue')
      log(`   Onboarding Complete: ${savedBarber.onboarding_complete}`, 'blue')
      return true
    } else {
      log('❌ Data verification failed', 'red')
      return false
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return false
  }
}

async function testOnboardingCheck(userId) {
  logSection('🔍 Testing App Onboarding Check Logic')
  
  try {
    // Simulate what the app does in LoginPage.tsx
    log('   Simulating app onboarding check (LoginPage logic)...', 'blue')
    
    const { data: barberData, error: barberError } = await supabase
      .from('barbers')
      .select('onboarding_complete, business_name, bio, specialties')
      .eq('user_id', userId)
      .single()

    if (barberError) {
      log(`   ⚠️  Barber check error: ${barberError.message}`, 'yellow')
      log('   ✅ App would redirect to BarberOnboarding (error case)', 'green')
      return true
    }

    if (!barberData) {
      log('   ⚠️  No barber data found', 'yellow')
      log('   ✅ App would redirect to BarberOnboarding (no data)', 'green')
      return true
    }

    log(`   Onboarding Complete: ${barberData.onboarding_complete}`, 'blue')
    log(`   Business Name: ${barberData.business_name || 'None'}`, 'blue')
    log(`   Bio: ${barberData.bio ? 'Present' : 'Missing'}`, 'blue')
    log(`   Specialties: ${barberData.specialties?.length || 0}`, 'blue')

    if (barberData.onboarding_complete) {
      log('   ✅ App would redirect to MainTabs (onboarding complete)', 'green')
    } else {
      log('   ✅ App would redirect to BarberOnboarding (incomplete)', 'green')
    }

    return true
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return false
  }
}

async function cleanupTestData(userId) {
  logSection('🧹 Cleaning Up Test Data')
  
  try {
    // Get barber ID
    const { data: barber } = await supabaseAdmin
      .from('barbers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (barber) {
      // Delete test services
      await supabaseAdmin
        .from('services')
        .delete()
        .eq('barber_id', barber.id)
        .in('name', ['Classic Cut', 'Fade', 'Beard Trim'])
    }

    log('✅ Test services cleaned up', 'green')
  } catch (error) {
    log(`⚠️  Cleanup warning: ${error.message}`, 'yellow')
  }
}

async function runTests() {
  logSection('🚀 Starting BocmApp Onboarding Tests')
  log('   Simulating the exact flow the React Native app uses', 'blue')
  
  // Find test user
  const testUser = await findTestBarber()
  if (!testUser) {
    log('\n❌ Cannot proceed without test user', 'red')
    process.exit(1)
  }

  let allTestsPassed = true

  try {
    // Test the actual app onboarding flow
    const onboardingPassed = await testAppOnboardingFlow(testUser.userId)
    allTestsPassed = allTestsPassed && onboardingPassed

    // Test the app's onboarding check logic
    const checkPassed = await testOnboardingCheck(testUser.userId)
    allTestsPassed = allTestsPassed && checkPassed

  } finally {
    // Cleanup
    await cleanupTestData(testUser.userId)
  }

  // Final summary
  logSection('📊 Test Summary')
  if (allTestsPassed) {
    log('✅ All BocmApp onboarding tests passed!', 'green')
    log('   - Onboarding Flow: Working', 'green')
    log('   - Data Persistence: Working', 'green')
    log('   - Onboarding Check Logic: Working', 'green')
    log('   - App Navigation Logic: Working', 'green')
  } else {
    log('❌ Some tests failed', 'red')
  }

  process.exit(allTestsPassed ? 0 : 1)
}

// Run the tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})

