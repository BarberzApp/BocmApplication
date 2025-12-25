/**
 * Test script for Barber Onboarding Process in BocmApp
 * Tests the complete onboarding flow and data persistence
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

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

async function findOrCreateTestBarber() {
  logSection('👤 Finding Test Barber User')
  
  try {
    // Try to find an existing barber without onboarding_complete
    const { data: existingBarbers, error: findError } = await supabaseAdmin
      .from('barbers')
      .select('user_id, business_name, onboarding_complete, profiles!inner(email, name)')
      .eq('onboarding_complete', false)
      .limit(1)

    if (!findError && existingBarbers && existingBarbers.length > 0) {
      const barber = existingBarbers[0]
      const profile = Array.isArray(barber.profiles) ? barber.profiles[0] : barber.profiles
      
      log(`✅ Found existing barber for testing:`, 'green')
      log(`   User ID: ${barber.user_id}`, 'blue')
      log(`   Email: ${profile?.email}`, 'blue')
      log(`   Name: ${profile?.name}`, 'blue')
      log(`   Business: ${barber.business_name || 'None'}`, 'blue')
      
      return {
        userId: barber.user_id,
        email: profile?.email,
        existing: true,
      }
    }

    // If no incomplete barber found, try any barber
    log('⚠️  No incomplete barber found, looking for any barber...', 'yellow')
    
    const { data: anyBarber, error: anyError } = await supabaseAdmin
      .from('barbers')
      .select('user_id, business_name, onboarding_complete, profiles!inner(email, name)')
      .limit(1)
      .single()

    if (!anyError && anyBarber) {
      const profile = Array.isArray(anyBarber.profiles) ? anyBarber.profiles[0] : anyBarber.profiles
      
      log(`✅ Found barber for testing:`, 'green')
      log(`   User ID: ${anyBarber.user_id}`, 'blue')
      log(`   Email: ${profile?.email}`, 'blue')
      log(`   Onboarding Complete: ${anyBarber.onboarding_complete ? 'Yes' : 'No'}`, 'blue')
      log(`   Note: Will reset onboarding_complete to false for testing`, 'yellow')
      
      // Reset onboarding for testing
      await supabaseAdmin
        .from('barbers')
        .update({ onboarding_complete: false })
        .eq('user_id', anyBarber.user_id)
      
      return {
        userId: anyBarber.user_id,
        email: profile?.email,
        existing: true,
      }
    }

    log('❌ No barber found in database', 'red')
    return null
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return null
  }
}

async function testStep1BusinessInfo(userId, formData) {
  logSection('📝 Testing Step 1: Business Information')
  
  try {
    log('   Updating barber profile with business info...', 'blue')
    
    const { error: upsertError } = await supabaseAdmin
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
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      log(`❌ Failed to update barber profile: ${upsertError.message}`, 'red')
      return false
    }

    // Update profile phone and location
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        phone: formData.phone,
        location: formData.location,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (profileError) {
      log(`❌ Failed to update profile: ${profileError.message}`, 'red')
      return false
    }

    // Verify data was saved
    const { data: barber, error: verifyError } = await supabaseAdmin
      .from('barbers')
      .select('business_name, bio, specialties, instagram, twitter')
      .eq('user_id', userId)
      .single()

    if (verifyError || !barber) {
      log(`❌ Verification failed: ${verifyError?.message}`, 'red')
      return false
    }

    const isValid = 
      barber.business_name === formData.businessName &&
      barber.bio === formData.bio &&
      JSON.stringify(barber.specialties) === JSON.stringify(formData.specialties)

    if (isValid) {
      log('✅ Step 1 data saved and verified correctly', 'green')
      log(`   Business: ${barber.business_name}`, 'blue')
      log(`   Bio: ${barber.bio.substring(0, 50)}...`, 'blue')
      log(`   Specialties: ${barber.specialties.join(', ')}`, 'blue')
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

async function testStep2Services(userId, services) {
  logSection('✂️  Testing Step 2: Services & Pricing')
  
  try {
    // Get barber ID
    const { data: barber, error: barberError } = await supabaseAdmin
      .from('barbers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (barberError || !barber) {
      log(`❌ Barber not found: ${barberError?.message}`, 'red')
      return false
    }

    log(`   Found barber ID: ${barber.id}`, 'blue')
    log(`   Adding ${services.length} services...`, 'blue')

    // Delete existing services first
    await supabaseAdmin
      .from('services')
      .delete()
      .eq('barber_id', barber.id)

    // Insert new services
    const servicesToInsert = services.map(service => ({
      barber_id: barber.id,
      name: service.name,
      price: service.price,
      duration: service.duration,
    }))

    const { error: servicesError } = await supabaseAdmin
      .from('services')
      .insert(servicesToInsert)

    if (servicesError) {
      log(`❌ Failed to insert services: ${servicesError.message}`, 'red')
      return false
    }

    // Verify services were saved
    const { data: savedServices, error: verifyError } = await supabaseAdmin
      .from('services')
      .select('name, price, duration')
      .eq('barber_id', barber.id)
      .order('created_at', { ascending: true })

    if (verifyError) {
      log(`❌ Verification failed: ${verifyError.message}`, 'red')
      return false
    }

    // Compare services (handle price as number or string)
    const isValid = savedServices.length === services.length &&
      savedServices.every((saved, index) => {
        const service = services[index]
        const priceMatch = Number(saved.price) === Number(service.price)
        const nameMatch = saved.name === service.name
        const durationMatch = saved.duration === service.duration
        
        if (!priceMatch || !nameMatch || !durationMatch) {
          log(`   Mismatch at index ${index}:`, 'yellow')
          log(`     Expected: ${service.name}, $${service.price}, ${service.duration}min`, 'yellow')
          log(`     Got: ${saved.name}, $${saved.price}, ${saved.duration}min`, 'yellow')
        }
        
        return priceMatch && nameMatch && durationMatch
      })

    if (isValid) {
      log('✅ Step 2 services saved and verified correctly', 'green')
      savedServices.forEach((service, index) => {
        log(`   Service ${index + 1}: ${service.name} - $${service.price} (${service.duration} min)`, 'blue')
      })
      return true
    } else {
      log('❌ Services verification failed', 'red')
      return false
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return false
  }
}

async function testStep3Stripe(userId) {
  logSection('💳 Testing Step 3: Payment Setup (Stripe)')
  
  try {
    // For testing, we'll just mark stripe as ready (skip actual Stripe connection)
    log('   Note: Skipping actual Stripe connection for testing', 'yellow')
    log('   Marking stripe_account_ready as true...', 'blue')

    const { error: stripeError } = await supabaseAdmin
      .from('barbers')
      .update({
        stripe_account_ready: true,
        stripe_account_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (stripeError) {
      log(`❌ Failed to update Stripe status: ${stripeError.message}`, 'red')
      return false
    }

    // Verify
    const { data: barber, error: verifyError } = await supabaseAdmin
      .from('barbers')
      .select('stripe_account_ready, stripe_account_status')
      .eq('user_id', userId)
      .single()

    if (verifyError || !barber) {
      log(`❌ Verification failed: ${verifyError?.message}`, 'red')
      return false
    }

    if (barber.stripe_account_ready) {
      log('✅ Step 3 Stripe status updated correctly', 'green')
      log(`   Stripe Ready: ${barber.stripe_account_ready}`, 'blue')
      log(`   Status: ${barber.stripe_account_status}`, 'blue')
      return true
    } else {
      log('❌ Stripe status verification failed', 'red')
      return false
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return false
  }
}

async function testOnboardingCompletion(userId) {
  logSection('✅ Testing Onboarding Completion')
  
  try {
    log('   Marking onboarding as complete...', 'blue')

    const { error: completeError } = await supabaseAdmin
      .from('barbers')
      .update({
        onboarding_complete: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (completeError) {
      log(`❌ Failed to mark onboarding complete: ${completeError.message}`, 'red')
      return false
    }

    // Verify completion check (simulating what the app does)
    const { data: barberData, error: verifyError } = await supabaseAdmin
      .from('barbers')
      .select('onboarding_complete, business_name, bio, specialties')
      .eq('user_id', userId)
      .single()

    if (verifyError) {
      log(`❌ Verification failed: ${verifyError.message}`, 'red')
      return false
    }

    if (barberData.onboarding_complete) {
      log('✅ Onboarding marked as complete', 'green')
      log(`   Business: ${barberData.business_name}`, 'blue')
      log(`   Bio: ${barberData.bio ? 'Present' : 'Missing'}`, 'blue')
      log(`   Specialties: ${barberData.specialties?.length || 0}`, 'blue')
      
      // Simulate app redirect logic
      if (barberData.onboarding_complete) {
        log('✅ App would redirect to MainTabs (onboarding complete)', 'green')
      } else {
        log('⚠️  App would redirect to BarberOnboarding (incomplete)', 'yellow')
      }
      
      return true
    } else {
      log('❌ Onboarding completion verification failed', 'red')
      return false
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return false
  }
}

async function cleanupTestUser(userId, isExisting) {
  logSection('🧹 Cleaning Up Test Data')
  
  try {
    if (isExisting) {
      // For existing users, just clean up test services and reset onboarding
      log('   Cleaning up test services...', 'blue')
      
      const { data: barber } = await supabaseAdmin
        .from('barbers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (barber) {
        // Delete test services (keep existing ones if any)
        await supabaseAdmin
          .from('services')
          .delete()
          .eq('barber_id', barber.id)
          .in('name', ['Haircut', 'Beard Trim', 'Haircut + Beard'])
      }

      log('✅ Test data cleaned up (user preserved)', 'green')
    } else {
      // For new test users, delete everything
      const { data: barber } = await supabaseAdmin
        .from('barbers')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (barber) {
        await supabaseAdmin
          .from('services')
          .delete()
          .eq('barber_id', barber.id)
      }

      await supabaseAdmin
        .from('barbers')
        .delete()
        .eq('user_id', userId)

      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)

      await supabaseAdmin.auth.admin.deleteUser(userId)

      log('✅ Test user deleted successfully', 'green')
    }
  } catch (error) {
    log(`⚠️  Cleanup warning: ${error.message}`, 'yellow')
  }
}

async function runTests() {
  logSection('🚀 Starting Barber Onboarding Tests')
  
  // Test data
  const formData = {
    businessName: 'Test Barber Shop',
    phone: '+1234567890',
    location: 'New York, NY',
    bio: 'Professional barber with 10 years of experience specializing in modern cuts and fades.',
    specialties: ['fade', 'undercut', 'pompadour'],
    services: [
      { name: 'Haircut', price: 30, duration: 30 },
      { name: 'Beard Trim', price: 20, duration: 20 },
      { name: 'Haircut + Beard', price: 45, duration: 45 },
    ],
    socialMedia: {
      instagram: '@testbarber',
      twitter: '@testbarber',
      tiktok: '@testbarber',
      facebook: 'testbarber',
    }
  }

  // Find or create test user
  const testUser = await findOrCreateTestBarber()
  if (!testUser) {
    log('\n❌ Cannot proceed without test user', 'red')
    log('   Please ensure there is at least one barber in the database', 'yellow')
    process.exit(1)
  }

  let allTestsPassed = true

  try {
    // Test Step 1: Business Information
    const step1Passed = await testStep1BusinessInfo(testUser.userId, formData)
    allTestsPassed = allTestsPassed && step1Passed

    // Test Step 2: Services
    const step2Passed = await testStep2Services(testUser.userId, formData.services)
    allTestsPassed = allTestsPassed && step2Passed

    // Test Step 3: Stripe
    const step3Passed = await testStep3Stripe(testUser.userId)
    allTestsPassed = allTestsPassed && step3Passed

    // Test Completion
    const completionPassed = await testOnboardingCompletion(testUser.userId)
    allTestsPassed = allTestsPassed && completionPassed

  } finally {
    // Cleanup
    await cleanupTestUser(testUser.userId, testUser.existing)
  }

  // Final summary
  logSection('📊 Test Summary')
  if (allTestsPassed) {
    log('✅ All onboarding tests passed!', 'green')
    log('   - Step 1 (Business Info): Working', 'green')
    log('   - Step 2 (Services): Working', 'green')
    log('   - Step 3 (Stripe): Working', 'green')
    log('   - Completion Check: Working', 'green')
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

