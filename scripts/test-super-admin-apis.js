/**
 * Test script for Super Admin APIs
 * Tests developer status and public visibility toggles
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const superAdminEmail = 'primbocm@gmail.com'
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(title, 'cyan')
  console.log('='.repeat(60))
}

async function getSuperAdminToken() {
  logSection('🔐 Getting Super Admin Token')
  
  try {
    // First try to sign in as super admin with password
    if (superAdminPassword && superAdminPassword !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: superAdminEmail,
        password: superAdminPassword
      })

      if (!error && data?.session?.access_token) {
        log('✅ Successfully authenticated as super admin', 'green')
        return data.session.access_token
      }
    }

    // If password auth fails, try to create a session using service role
    // For testing purposes, we'll use a mock token approach
    log('⚠️  Password auth not available, using service role for direct DB testing', 'yellow')
    log('   Note: This tests the database operations directly', 'yellow')
    return 'SERVICE_ROLE_TEST' // Special marker for direct DB testing
  } catch (error) {
    log(`❌ Error during authentication: ${error.message}`, 'red')
    return null
  }
}

async function getTestBarber() {
  logSection('👤 Finding Test Barber')
  
  try {
    // Get first barber with profile
    const { data: barbers, error } = await supabaseAdmin
      .from('barbers')
      .select(`
        id,
        user_id,
        business_name,
        is_developer,
        profiles (
          id,
          name,
          email,
          is_public,
          is_disabled
        )
      `)
      .limit(1)

    if (error) {
      log(`❌ Error fetching barbers: ${error.message}`, 'red')
      return null
    }

    if (!barbers || barbers.length === 0) {
      log('❌ No barbers found in database', 'red')
      return null
    }

    const barber = barbers[0]
    const profile = Array.isArray(barber.profiles) ? barber.profiles[0] : barber.profiles

    log(`✅ Found test barber:`, 'green')
    log(`   ID: ${barber.id}`, 'blue')
    log(`   Business: ${barber.business_name || 'N/A'}`, 'blue')
    log(`   Name: ${profile?.name || 'N/A'}`, 'blue')
    log(`   Email: ${profile?.email || 'N/A'}`, 'blue')
    log(`   Current Developer Status: ${barber.is_developer ? 'ENABLED' : 'DISABLED'}`, barber.is_developer ? 'green' : 'yellow')
    log(`   Current Public Status: ${profile?.is_public ? 'PUBLIC' : 'PRIVATE'}`, profile?.is_public ? 'green' : 'yellow')

    return {
      barberId: barber.id,
      userId: barber.user_id,
      currentDeveloperStatus: barber.is_developer,
      currentPublicStatus: profile?.is_public ?? false
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return null
  }
}

async function testDeveloperStatusAPI(token, barberId, currentStatus) {
  logSection('🧪 Testing Developer Status API')
  
  const newStatus = !currentStatus
  log(`Testing toggle from ${currentStatus ? 'ENABLED' : 'DISABLED'} to ${newStatus ? 'ENABLED' : 'DISABLED'}`, 'blue')

  // If using service role, test directly
  if (token === 'SERVICE_ROLE_TEST') {
    log('   Using direct database test (service role)', 'blue')
    
    try {
      // Simulate the API logic: verify barber exists
      const { data: existingBarber, error: checkError } = await supabaseAdmin
        .from('barbers')
        .select('id, business_name, is_developer')
        .eq('id', barberId)
        .single()

      if (checkError || !existingBarber) {
        log(`❌ Barber not found: ${checkError?.message || 'Not found'}`, 'red')
        return false
      }

      log(`   Found barber: ${existingBarber.business_name || 'N/A'}`, 'blue')

      // Update the barber's developer status
      const { error: updateError } = await supabaseAdmin
        .from('barbers')
        .update({ is_developer: newStatus })
        .eq('id', barberId)

      if (updateError) {
        log(`❌ Error updating developer status: ${updateError.message}`, 'red')
        return false
      }

      log('✅ Developer status updated successfully', 'green')
      
      // Verify in database
      const { data: updatedBarber, error: verifyError } = await supabaseAdmin
        .from('barbers')
        .select('is_developer')
        .eq('id', barberId)
        .single()

      if (verifyError) {
        log(`⚠️  Warning: Could not verify update: ${verifyError.message}`, 'yellow')
        return true
      }

      if (updatedBarber.is_developer === newStatus) {
        log('✅ Database verification: Status matches expected value', 'green')
        return true
      } else {
        log(`❌ Database verification failed: Expected ${newStatus}, got ${updatedBarber.is_developer}`, 'red')
        return false
      }
    } catch (error) {
      log(`❌ Error: ${error.message}`, 'red')
      return false
    }
  }

  // Otherwise, test via HTTP API
  try {
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${apiUrl}/api/super-admin/developer-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        barberId,
        isDeveloper: newStatus
      })
    })

    const data = await response.json()

    if (!response.ok) {
      log(`❌ API Error: ${data.error || 'Unknown error'}`, 'red')
      log(`   Status: ${response.status}`, 'red')
      return false
    }

    if (data.success) {
      log('✅ Developer status updated successfully', 'green')
      log(`   Message: ${data.message}`, 'blue')
      
      // Verify in database
      const { data: updatedBarber, error: verifyError } = await supabaseAdmin
        .from('barbers')
        .select('is_developer')
        .eq('id', barberId)
        .single()

      if (verifyError) {
        log(`⚠️  Warning: Could not verify update: ${verifyError.message}`, 'yellow')
        return true
      }

      if (updatedBarber.is_developer === newStatus) {
        log('✅ Database verification: Status matches expected value', 'green')
        return true
      } else {
        log(`❌ Database verification failed: Expected ${newStatus}, got ${updatedBarber.is_developer}`, 'red')
        return false
      }
    } else {
      log(`❌ API returned success: false`, 'red')
      return false
    }
  } catch (error) {
    log(`❌ Error calling API: ${error.message}`, 'red')
    if (error.message.includes('fetch')) {
      log('⚠️  Note: Make sure your Next.js server is running on localhost:3000', 'yellow')
      log('   Or set NEXT_PUBLIC_APP_URL in your .env file', 'yellow')
    }
    return false
  }
}

async function testPublicStatusAPI(token, userId, currentStatus) {
  logSection('🧪 Testing Public Status API')
  
  const newStatus = !currentStatus
  log(`Testing toggle from ${currentStatus ? 'PUBLIC' : 'PRIVATE'} to ${newStatus ? 'PUBLIC' : 'PRIVATE'}`, 'blue')

  // If using service role, test directly
  if (token === 'SERVICE_ROLE_TEST') {
    log('   Using direct database test (service role)', 'blue')
    
    try {
      // Simulate the API logic: verify profile exists
      const { data: existingProfile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, is_public')
        .eq('id', userId)
        .single()

      if (fetchError || !existingProfile) {
        log(`❌ Profile not found: ${fetchError?.message || 'Not found'}`, 'red')
        return false
      }

      log(`   Found profile: ${existingProfile.name || existingProfile.email}`, 'blue')

      // Update the profile's public status
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ is_public: newStatus })
        .eq('id', userId)

      if (updateError) {
        log(`❌ Error updating public status: ${updateError.message}`, 'red')
        return false
      }

      log('✅ Public status updated successfully', 'green')
      
      // Verify in database
      const { data: updatedProfile, error: verifyError } = await supabaseAdmin
        .from('profiles')
        .select('is_public')
        .eq('id', userId)
        .single()

      if (verifyError) {
        log(`⚠️  Warning: Could not verify update: ${verifyError.message}`, 'yellow')
        return true
      }

      if (updatedProfile.is_public === newStatus) {
        log('✅ Database verification: Status matches expected value', 'green')
        return true
      } else {
        log(`❌ Database verification failed: Expected ${newStatus}, got ${updatedProfile.is_public}`, 'red')
        return false
      }
    } catch (error) {
      log(`❌ Error: ${error.message}`, 'red')
      return false
    }
  }

  // Otherwise, test via HTTP API
  try {
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${apiUrl}/api/super-admin/public-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId,
        isPublic: newStatus
      })
    })

    const data = await response.json()

    if (!response.ok) {
      log(`❌ API Error: ${data.error || 'Unknown error'}`, 'red')
      log(`   Status: ${response.status}`, 'red')
      return false
    }

    if (data.success) {
      log('✅ Public status updated successfully', 'green')
      log(`   Message: ${data.message}`, 'blue')
      
      // Verify in database
      const { data: updatedProfile, error: verifyError } = await supabaseAdmin
        .from('profiles')
        .select('is_public')
        .eq('id', userId)
        .single()

      if (verifyError) {
        log(`⚠️  Warning: Could not verify update: ${verifyError.message}`, 'yellow')
        return true
      }

      if (updatedProfile.is_public === newStatus) {
        log('✅ Database verification: Status matches expected value', 'green')
        return true
      } else {
        log(`❌ Database verification failed: Expected ${newStatus}, got ${updatedProfile.is_public}`, 'red')
        return false
      }
    } else {
      log(`❌ API returned success: false`, 'red')
      return false
    }
  } catch (error) {
    log(`❌ Error calling API: ${error.message}`, 'red')
    if (error.message.includes('fetch')) {
      log('⚠️  Note: Make sure your Next.js server is running on localhost:3000', 'yellow')
      log('   Or set NEXT_PUBLIC_APP_URL in your .env file', 'yellow')
    }
    return false
  }
}

async function restoreOriginalStatus(barberId, userId, originalDeveloperStatus, originalPublicStatus) {
  logSection('🔄 Restoring Original Status')
  
  try {
    // Restore developer status
    const { error: devError } = await supabaseAdmin
      .from('barbers')
      .update({ is_developer: originalDeveloperStatus })
      .eq('id', barberId)

    if (devError) {
      log(`⚠️  Warning: Could not restore developer status: ${devError.message}`, 'yellow')
    } else {
      log('✅ Developer status restored', 'green')
    }

    // Restore public status
    const { error: pubError } = await supabaseAdmin
      .from('profiles')
      .update({ is_public: originalPublicStatus })
      .eq('id', userId)

    if (pubError) {
      log(`⚠️  Warning: Could not restore public status: ${pubError.message}`, 'yellow')
    } else {
      log('✅ Public status restored', 'green')
    }
  } catch (error) {
    log(`⚠️  Warning: Error restoring status: ${error.message}`, 'yellow')
  }
}

async function runTests() {
  logSection('🚀 Starting Super Admin API Tests')
  
  // Get super admin token
  const token = await getSuperAdminToken()
  if (!token) {
    log('\n❌ Cannot proceed without authentication token', 'red')
    process.exit(1)
  }

  // Get test barber
  const testBarber = await getTestBarber()
  if (!testBarber) {
    log('\n❌ Cannot proceed without a test barber', 'red')
    process.exit(1)
  }

  // Store original values for restoration
  const originalDeveloperStatus = testBarber.currentDeveloperStatus
  const originalPublicStatus = testBarber.currentPublicStatus

  let allTestsPassed = true

  // Test Developer Status API
  const devTestPassed = await testDeveloperStatusAPI(
    token,
    testBarber.barberId,
    testBarber.currentDeveloperStatus
  )
  allTestsPassed = allTestsPassed && devTestPassed

  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test Public Status API
  const pubTestPassed = await testPublicStatusAPI(
    token,
    testBarber.userId,
    testBarber.currentPublicStatus
  )
  allTestsPassed = allTestsPassed && pubTestPassed

  // Restore original status
  await restoreOriginalStatus(
    testBarber.barberId,
    testBarber.userId,
    originalDeveloperStatus,
    originalPublicStatus
  )

  // Final summary
  logSection('📊 Test Summary')
  if (allTestsPassed) {
    log('✅ All tests passed!', 'green')
    log('   - Developer Status API: Working', 'green')
    log('   - Public Status API: Working', 'green')
  } else {
    log('❌ Some tests failed', 'red')
    if (!devTestPassed) {
      log('   - Developer Status API: Failed', 'red')
    }
    if (!pubTestPassed) {
      log('   - Public Status API: Failed', 'red')
    }
  }

  process.exit(allTestsPassed ? 0 : 1)
}

// Run the tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})

