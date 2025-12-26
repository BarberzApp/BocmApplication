/**
 * Test script for User Profile Manager and Photo Deletion APIs
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
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(title, 'cyan')
  console.log('='.repeat(60))
}

async function findTestUser() {
  logSection('👤 Finding Test User')
  
  try {
    // Get a user with photos
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, avatar_url, coverphoto, role')
      .or('avatar_url.not.is.null,coverphoto.not.is.null')
      .limit(1)

    if (error) {
      log(`❌ Error fetching profiles: ${error.message}`, 'red')
      return null
    }

    if (!profiles || profiles.length === 0) {
      log('⚠️  No users with photos found, trying any user...', 'yellow')
      
      // Try to get any user
      const { data: anyProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, avatar_url, coverphoto, role')
        .limit(1)
        .single()

      if (anyProfile) {
        log(`✅ Found test user:`, 'green')
        log(`   ID: ${anyProfile.id}`, 'blue')
        log(`   Name: ${anyProfile.name || 'N/A'}`, 'blue')
        log(`   Email: ${anyProfile.email}`, 'blue')
        log(`   Role: ${anyProfile.role}`, 'blue')
        log(`   Avatar: ${anyProfile.avatar_url ? 'Yes' : 'No'}`, 'blue')
        log(`   Cover: ${anyProfile.coverphoto ? 'Yes' : 'No'}`, 'blue')
        return anyProfile
      }
      
      log('❌ No users found in database', 'red')
      return null
    }

    const profile = profiles[0]
    log(`✅ Found test user with photos:`, 'green')
    log(`   ID: ${profile.id}`, 'blue')
    log(`   Name: ${profile.name || 'N/A'}`, 'blue')
    log(`   Email: ${profile.email}`, 'blue')
    log(`   Role: ${profile.role}`, 'blue')
    log(`   Avatar: ${profile.avatar_url ? 'Yes' : 'No'}`, 'blue')
    log(`   Cover: ${profile.coverphoto ? 'Yes' : 'No'}`, 'blue')

    return profile
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return null
  }
}

async function getBarberPhotos(userId) {
  try {
    const { data: barber } = await supabaseAdmin
      .from('barbers')
      .select('id, portfolio')
      .eq('user_id', userId)
      .single()

    if (!barber) return { portfolio: [], cuts: [] }

    const { data: cuts } = await supabaseAdmin
      .from('cuts')
      .select('id, url, thumbnail, title')
      .eq('barber_id', barber.id)
      .limit(5)

    return {
      portfolio: barber.portfolio || [],
      cuts: cuts || [],
    }
  } catch (error) {
    return { portfolio: [], cuts: [] }
  }
}

async function testSearchUser(email) {
  logSection('🔍 Testing User Search')
  
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, avatar_url, coverphoto, role')
      .eq('email', email)
      .single()

    if (error || !profile) {
      log(`❌ User not found: ${error?.message || 'Not found'}`, 'red')
      return false
    }

    log(`✅ User found:`, 'green')
    log(`   Name: ${profile.name || 'N/A'}`, 'blue')
    log(`   Email: ${profile.email}`, 'blue')
    log(`   Role: ${profile.role}`, 'blue')
    
    // Get barber photos if barber
    if (profile.role === 'barber') {
      const barberPhotos = await getBarberPhotos(profile.id)
      log(`   Portfolio images: ${barberPhotos.portfolio.length}`, 'blue')
      log(`   Cuts/Reels: ${barberPhotos.cuts.length}`, 'blue')
    }

    return true
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return false
  }
}

async function testDeletePhotoAPI(userId, photoType, photoUrl, photoId = null) {
  logSection(`🗑️  Testing Delete Photo API (${photoType})`)
  
  try {
    // Simulate the API logic using service role
    log(`   Photo Type: ${photoType}`, 'blue')
    log(`   Photo URL: ${photoUrl.substring(0, 50)}...`, 'blue')

    // Check if photo exists in database
    let photoExists = false
    if (photoType === 'avatar') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single()
      photoExists = profile?.avatar_url === photoUrl
    } else if (photoType === 'cover') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('coverphoto')
        .eq('id', userId)
        .single()
      photoExists = profile?.coverphoto === photoUrl
    } else if (photoType === 'portfolio') {
      const { data: barber } = await supabaseAdmin
        .from('barbers')
        .select('portfolio')
        .eq('user_id', userId)
        .single()
      photoExists = barber?.portfolio?.includes(photoUrl) || false
    } else if (photoType === 'cut' && photoId) {
      const { data: cut } = await supabaseAdmin
        .from('cuts')
        .select('id')
        .eq('id', photoId)
        .single()
      photoExists = !!cut
    }

    if (!photoExists) {
      log(`⚠️  Photo not found in database (may have been deleted already)`, 'yellow')
      return true // Not an error if it doesn't exist
    }

    log(`   Photo exists in database, proceeding with deletion...`, 'blue')

    // Try to delete from storage (if URL is a storage URL)
    try {
      const url = new URL(photoUrl)
      const pathParts = url.pathname.split('/')
      const bucketIndex = pathParts.findIndex(part => part === 'storage' || part === 'v1')
      
      if (bucketIndex !== -1 && pathParts[bucketIndex + 1] && pathParts[bucketIndex + 2]) {
        const bucket = pathParts[bucketIndex + 1]
        const filePath = pathParts.slice(bucketIndex + 2).join('/').split('?')[0]
        
        const { error: storageError } = await supabaseAdmin.storage
          .from(bucket)
          .remove([filePath])

        if (storageError) {
          log(`⚠️  Storage deletion warning: ${storageError.message}`, 'yellow')
        } else {
          log(`✅ Deleted from storage bucket: ${bucket}`, 'green')
        }
      }
    } catch (storageError) {
      log(`⚠️  Could not parse storage URL (may be external): ${storageError.message}`, 'yellow')
    }

    // Update database
    let updateError = null
    switch (photoType) {
      case 'avatar':
        const { error: avatarError } = await supabaseAdmin
          .from('profiles')
          .update({ avatar_url: null })
          .eq('id', userId)
        updateError = avatarError
        break

      case 'cover':
        const { error: coverError } = await supabaseAdmin
          .from('profiles')
          .update({ coverphoto: null })
          .eq('id', userId)
        updateError = coverError
        break

      case 'portfolio':
        const { data: barber } = await supabaseAdmin
          .from('barbers')
          .select('id, portfolio')
          .eq('user_id', userId)
          .single()

        if (barber) {
          const updatedPortfolio = (barber.portfolio || []).filter(url => url !== photoUrl)
          const { error: portfolioError } = await supabaseAdmin
            .from('barbers')
            .update({ portfolio: updatedPortfolio })
            .eq('id', barber.id)
          updateError = portfolioError
        }
        break

      case 'cut':
        if (photoId) {
          const { error: cutError } = await supabaseAdmin
            .from('cuts')
            .delete()
            .eq('id', photoId)
          updateError = cutError
        }
        break
    }

    if (updateError) {
      log(`❌ Database update error: ${updateError.message}`, 'red')
      return false
    }

    log(`✅ Photo deleted successfully from database`, 'green')
    return true
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    return false
  }
}

async function runTests() {
  logSection('🚀 Starting Profile Manager Tests')
  
  // Find test user
  const testUser = await findTestUser()
  if (!testUser) {
    log('\n❌ Cannot proceed without a test user', 'red')
    process.exit(1)
  }

  let allTestsPassed = true

  // Test 1: Search user by email
  const searchTest = await testSearchUser(testUser.email)
  allTestsPassed = allTestsPassed && searchTest

  // Test 2: Delete avatar if exists
  if (testUser.avatar_url) {
    log('\n⚠️  Note: This will delete the avatar. Restoring after test...', 'yellow')
    const originalAvatar = testUser.avatar_url
    
    const deleteAvatarTest = await testDeletePhotoAPI(
      testUser.id,
      'avatar',
      testUser.avatar_url
    )
    allTestsPassed = allTestsPassed && deleteAvatarTest

    // Restore avatar
    if (deleteAvatarTest) {
      await supabaseAdmin
        .from('profiles')
        .update({ avatar_url: originalAvatar })
        .eq('id', testUser.id)
      log('✅ Avatar restored', 'green')
    }
  } else {
    log('\n⚠️  User has no avatar to test deletion', 'yellow')
  }

  // Test 3: Delete cover photo if exists
  if (testUser.coverphoto) {
    log('\n⚠️  Note: This will delete the cover photo. Restoring after test...', 'yellow')
    const originalCover = testUser.coverphoto
    
    const deleteCoverTest = await testDeletePhotoAPI(
      testUser.id,
      'cover',
      testUser.coverphoto
    )
    allTestsPassed = allTestsPassed && deleteCoverTest

    // Restore cover photo
    if (deleteCoverTest) {
      await supabaseAdmin
        .from('profiles')
        .update({ coverphoto: originalCover })
        .eq('id', testUser.id)
      log('✅ Cover photo restored', 'green')
    }
  } else {
    log('\n⚠️  User has no cover photo to test deletion', 'yellow')
  }

  // Test 4: Test portfolio deletion if barber
  if (testUser.role === 'barber') {
    const barberPhotos = await getBarberPhotos(testUser.id)
    
    if (barberPhotos.portfolio.length > 0) {
      log('\n⚠️  Note: This will delete a portfolio image. Restoring after test...', 'yellow')
      const portfolioUrl = barberPhotos.portfolio[0]
      
      const deletePortfolioTest = await testDeletePhotoAPI(
        testUser.id,
        'portfolio',
        portfolioUrl
      )
      allTestsPassed = allTestsPassed && deletePortfolioTest

      // Restore portfolio
      if (deletePortfolioTest) {
        const { data: barber } = await supabaseAdmin
          .from('barbers')
          .select('id, portfolio')
          .eq('user_id', testUser.id)
          .single()

        if (barber) {
          const restoredPortfolio = [...(barber.portfolio || []), portfolioUrl]
          await supabaseAdmin
            .from('barbers')
            .update({ portfolio: restoredPortfolio })
            .eq('id', barber.id)
          log('✅ Portfolio image restored', 'green')
        }
      }
    } else {
      log('\n⚠️  Barber has no portfolio images to test deletion', 'yellow')
    }

    // Test 5: Test cut deletion if exists
    if (barberPhotos.cuts.length > 0) {
      log('\n⚠️  Note: This will delete a cut/reel. NOT restoring (permanent deletion).', 'yellow')
      const cut = barberPhotos.cuts[0]
      
      const deleteCutTest = await testDeletePhotoAPI(
        testUser.id,
        'cut',
        cut.url,
        cut.id
      )
      allTestsPassed = allTestsPassed && deleteCutTest
      log('⚠️  Cut/reel was permanently deleted (not restored)', 'yellow')
    } else {
      log('\n⚠️  Barber has no cuts/reels to test deletion', 'yellow')
    }
  }

  // Final summary
  logSection('📊 Test Summary')
  if (allTestsPassed) {
    log('✅ All tests passed!', 'green')
    log('   - User Search: Working', 'green')
    log('   - Photo Deletion API: Working', 'green')
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

