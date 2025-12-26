/**
 * Test script to verify Google Calendar integration setup
 * Run with: node scripts/test-google-calendar-integration.js
 */

require('dotenv').config();

const tests = {
  environmentVariables: () => {
    console.log('🔍 Testing Environment Variables...\n');
    
    const required = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
    ];
    
    const missing = [];
    const present = [];
    
    required.forEach(key => {
      if (process.env[key]) {
        present.push(key);
        console.log(`  ✅ ${key}: Present`);
      } else {
        missing.push(key);
        console.log(`  ❌ ${key}: MISSING`);
      }
    });
    
    console.log(`\n📊 Summary: ${present.length}/${required.length} environment variables set\n`);
    
    if (missing.length > 0) {
      console.log('⚠️  Missing environment variables:');
      missing.forEach(key => {
        console.log(`   - ${key}`);
      });
      console.log('\n💡 Add these to your .env.local file:\n');
      missing.forEach(key => {
        console.log(`${key}=your_value_here`);
      });
      return false;
    }
    
    return true;
  },
  
  databaseTables: async () => {
    console.log('🔍 Testing Database Tables...\n');
    
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      
      const tables = [
        'user_calendar_connections',
        'synced_events',
        'calendar_sync_logs'
      ];
      
      const results = {};
      
      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);
          
          if (error) {
            if (error.code === '42P01') {
              console.log(`  ❌ ${table}: Table does not exist`);
              results[table] = false;
            } else {
              console.log(`  ⚠️  ${table}: Error checking (${error.message})`);
              results[table] = 'error';
            }
          } else {
            console.log(`  ✅ ${table}: Table exists`);
            results[table] = true;
          }
        } catch (err) {
          console.log(`  ❌ ${table}: ${err.message}`);
          results[table] = false;
        }
      }
      
      const allExist = Object.values(results).every(r => r === true);
      
      if (!allExist) {
        console.log('\n⚠️  Some tables are missing. Run the migration:');
        console.log('   supabase migration up');
        console.log('   Or apply: supabase/migrations/20250108000011_add_calendar_sync_tables.sql\n');
      }
      
      return allExist;
    } catch (error) {
      console.log(`  ❌ Database check failed: ${error.message}\n`);
      return false;
    }
  },
  
  apiRoutes: () => {
    console.log('🔍 Testing API Routes...\n');
    
    const fs = require('fs');
    const path = require('path');
    
    const routes = [
      'src/app/api/auth/google-calendar/route.ts',
      'src/app/api/auth/google-calendar/callback/route.ts',
      'src/app/api/calendar/sync/route.ts',
      'src/app/api/calendar/connection/route.ts',
    ];
    
    const results = {};
    
    routes.forEach(route => {
      const fullPath = path.join(process.cwd(), route);
      if (fs.existsSync(fullPath)) {
        console.log(`  ✅ ${route}: Exists`);
        results[route] = true;
      } else {
        console.log(`  ❌ ${route}: Missing`);
        results[route] = false;
      }
    });
    
    const allExist = Object.values(results).every(r => r === true);
    console.log(`\n📊 Summary: ${Object.values(results).filter(r => r).length}/${routes.length} routes exist\n`);
    
    return allExist;
  },
  
  codeFiles: () => {
    console.log('🔍 Testing Code Files...\n');
    
    const fs = require('fs');
    const path = require('path');
    
    const files = [
      'src/shared/lib/google-calendar-api.ts',
      'src/shared/lib/google-calendar-utils.ts',
      'src/shared/hooks/useCalendarSync.ts',
      'src/shared/components/calendar-sync-settings.tsx',
    ];
    
    const results = {};
    
    files.forEach(file => {
      const fullPath = path.join(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        console.log(`  ✅ ${file}: Exists`);
        results[file] = true;
      } else {
        console.log(`  ❌ ${file}: Missing`);
        results[file] = false;
      }
    });
    
    const allExist = Object.values(results).every(r => r === true);
    console.log(`\n📊 Summary: ${Object.values(results).filter(r => r).length}/${files.length} files exist\n`);
    
    return allExist;
  },
  
  calendarPageIntegration: () => {
    console.log('🔍 Testing Calendar Page Integration...\n');
    
    const fs = require('fs');
    const path = require('path');
    
    const calendarPagePath = path.join(process.cwd(), 'src/app/calendar/page.tsx');
    
    if (!fs.existsSync(calendarPagePath)) {
      console.log('  ❌ Calendar page not found\n');
      return false;
    }
    
    const content = fs.readFileSync(calendarPagePath, 'utf8');
    
    const checks = {
      'CalendarSyncSettings imported': content.includes("import { CalendarSyncSettings }"),
      'CalendarSyncSettings used': content.includes('<CalendarSyncSettings'),
      'Calendar sync section exists': content.includes('Calendar Sync'),
    };
    
    Object.entries(checks).forEach(([check, passed]) => {
      if (passed) {
        console.log(`  ✅ ${check}`);
      } else {
        console.log(`  ❌ ${check}`);
      }
    });
    
    const allPassed = Object.values(checks).every(c => c === true);
    console.log(`\n📊 Summary: ${Object.values(checks).filter(c => c).length}/${Object.keys(checks).length} checks passed\n`);
    
    return allPassed;
  },
  
  dependencies: () => {
    console.log('🔍 Testing Dependencies...\n');
    
    try {
      const packageJson = require('../package.json');
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      const required = ['googleapis'];
      
      const results = {};
      
      required.forEach(dep => {
        if (dependencies[dep]) {
          console.log(`  ✅ ${dep}: ${dependencies[dep]}`);
          results[dep] = true;
        } else {
          console.log(`  ❌ ${dep}: Missing`);
          results[dep] = false;
        }
      });
      
      const allPresent = Object.values(results).every(r => r === true);
      
      if (!allPresent) {
        console.log('\n💡 Install missing dependencies:');
        console.log('   npm install googleapis\n');
      }
      
      return allPresent;
    } catch (error) {
      console.log(`  ❌ Failed to check dependencies: ${error.message}\n`);
      return false;
    }
  }
};

async function runAllTests() {
  console.log('🧪 Google Calendar Integration Test Suite\n');
  console.log('=' .repeat(50) + '\n');
  
  const results = {
    environmentVariables: tests.environmentVariables(),
    dependencies: tests.dependencies(),
    codeFiles: tests.codeFiles(),
    apiRoutes: tests.apiRoutes(),
    calendarPageIntegration: tests.calendarPageIntegration(),
    databaseTables: await tests.databaseTables(),
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL RESULTS\n');
  
  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`${icon} ${test}: ${status}`);
  });
  
  console.log(`\n📈 Overall: ${passed}/${total} tests passed\n`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Google Calendar integration is ready.\n');
    console.log('Next steps:');
    console.log('1. Set up Google OAuth credentials in Google Cloud Console');
    console.log('2. Add environment variables to .env.local');
    console.log('3. Run database migration if not already done');
    console.log('4. Test the integration in the calendar page\n');
  } else {
    console.log('⚠️  Some tests failed. Please fix the issues above.\n');
  }
  
  process.exit(passed === total ? 0 : 1);
}

runAllTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});

