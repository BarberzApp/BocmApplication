require('dotenv').config();
const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bocmstyle.com';

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY is not configured in environment variables');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);

async function checkWebhookConfiguration() {
  console.log('🔍 Checking Stripe Webhook Configuration\n');
  console.log('='.repeat(60));
  
  // 1. Check environment variables
  console.log('\n1️⃣ Environment Variables:');
  console.log('-'.repeat(60));
  console.log(`✅ STRIPE_SECRET_KEY: ${stripeSecretKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`${webhookSecret ? '✅' : '❌'} STRIPE_WEBHOOK_SECRET: ${webhookSecret ? '✅ Configured' : '❌ Missing'}`);
  console.log(`📱 App URL: ${appUrl}`);
  console.log(`🔗 Expected Webhook URL: ${appUrl}/api/webhooks/stripe`);
  
  if (!webhookSecret) {
    console.log('\n⚠️  WARNING: STRIPE_WEBHOOK_SECRET is not configured!');
    console.log('   The webhook handler will reject all requests.');
  }
  
  // 2. List webhook endpoints from Stripe
  console.log('\n2️⃣ Stripe Webhook Endpoints:');
  console.log('-'.repeat(60));
  
  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    
    if (endpoints.data.length === 0) {
      console.log('❌ No webhook endpoints found in Stripe!');
      console.log('\n📝 To create a webhook endpoint:');
      console.log('   1. Go to https://dashboard.stripe.com/webhooks');
      console.log(`   2. Click "Add endpoint"`);
      console.log(`   3. Set URL to: ${appUrl}/api/webhooks/stripe`);
      console.log('   4. Select events:');
      console.log('      - payment_intent.succeeded');
      console.log('      - payment_intent.payment_failed');
      console.log('      - charge.refunded');
      console.log('      - checkout.session.completed');
      console.log('      - checkout.session.expired');
      console.log('      - account.created');
      console.log('      - account.updated');
      console.log('      - account.application.deauthorized');
      console.log('   5. Copy the "Signing secret" and set it as STRIPE_WEBHOOK_SECRET');
    } else {
      console.log(`✅ Found ${endpoints.data.length} webhook endpoint(s):\n`);
      
      const expectedUrl = `${appUrl}/api/webhooks/stripe`;
      let foundMatchingEndpoint = false;
      
      endpoints.data.forEach((endpoint, index) => {
        const isMatch = endpoint.url === expectedUrl;
        const status = endpoint.status === 'enabled' ? '✅ Enabled' : '⚠️  Disabled';
        const matchStatus = isMatch ? '✅ MATCHES' : '❌ Different URL';
        
        console.log(`   ${index + 1}. ${endpoint.url}`);
        console.log(`      Status: ${status}`);
        console.log(`      Match: ${matchStatus}`);
        console.log(`      Events: ${endpoint.enabled_events.length} event(s)`);
        
        if (isMatch) {
          foundMatchingEndpoint = true;
          console.log(`      Signing Secret: ${endpoint.secret ? '✅ Configured' : '❌ Missing'}`);
          
          // Check if events are configured correctly
          const requiredEvents = [
            'payment_intent.succeeded',
            'payment_intent.payment_failed',
            'charge.refunded',
            'checkout.session.completed',
            'checkout.session.expired',
            'account.created',
            'account.updated',
            'account.application.deauthorized'
          ];
          
          const missingEvents = requiredEvents.filter(e => !endpoint.enabled_events.includes(e));
          if (missingEvents.length > 0) {
            console.log(`      ⚠️  Missing events: ${missingEvents.join(', ')}`);
          } else {
            console.log(`      ✅ All required events configured`);
          }
        }
        
        console.log('');
      });
      
      if (!foundMatchingEndpoint) {
        console.log(`\n⚠️  WARNING: No webhook endpoint found matching: ${expectedUrl}`);
        console.log(`   Current endpoints point to different URLs.`);
        console.log(`   You may need to update the webhook URL in Stripe Dashboard.`);
      } else {
        console.log(`✅ Found matching webhook endpoint!`);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching webhook endpoints:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.error('   This usually means STRIPE_SECRET_KEY is invalid.');
    }
  }
  
  // 3. Check recent webhook events
  console.log('\n3️⃣ Recent Webhook Events:');
  console.log('-'.repeat(60));
  
  try {
    const events = await stripe.events.list({
      limit: 10,
      types: ['payment_intent.succeeded']
    });
    
    if (events.data.length === 0) {
      console.log('ℹ️  No recent payment_intent.succeeded events found.');
    } else {
      console.log(`✅ Found ${events.data.length} recent payment_intent.succeeded event(s):\n`);
      
      events.data.slice(0, 5).forEach((event, index) => {
        const paymentIntent = event.data.object;
        console.log(`   ${index + 1}. Event ID: ${event.id}`);
        console.log(`      Payment Intent: ${paymentIntent.id}`);
        console.log(`      Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
        console.log(`      Status: ${paymentIntent.status}`);
        console.log(`      Created: ${new Date(event.created * 1000).toLocaleString()}`);
        console.log(`      Webhook Status: ${event.request ? '✅ Delivered' : '❌ Failed'}`);
        if (event.request) {
          console.log(`      Request ID: ${event.request.id}`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error fetching webhook events:', error.message);
  }
  
  // 4. Summary and recommendations
  console.log('\n4️⃣ Summary & Recommendations:');
  console.log('='.repeat(60));
  
  let hasEndpoints = false;
  let hasMatchingEndpoint = false;
  
  try {
    const endpointsCheck = await stripe.webhookEndpoints.list({ limit: 100 });
    hasEndpoints = endpointsCheck.data.length > 0;
    hasMatchingEndpoint = endpointsCheck.data.some(e => e.url === `${appUrl}/api/webhooks/stripe`);
  } catch (error) {
    // Already handled above
  }
  
  const hasWebhookSecret = !!webhookSecret;
  
  if (!hasWebhookSecret) {
    console.log('❌ STRIPE_WEBHOOK_SECRET is missing');
    console.log('   → Set this environment variable with the webhook signing secret from Stripe');
  }
  
  if (!hasEndpoints) {
    console.log('❌ No webhook endpoints configured in Stripe');
    console.log('   → Create a webhook endpoint in Stripe Dashboard');
  } else if (!hasMatchingEndpoint) {
    console.log('⚠️  Webhook endpoint URL does not match expected URL');
    console.log(`   → Update webhook URL to: ${appUrl}/api/webhooks/stripe`);
  }
  
  if (hasWebhookSecret && hasMatchingEndpoint) {
    console.log('✅ Webhook configuration looks good!');
    console.log('   If bookings are still not being created, check:');
    console.log('   1. Webhook event logs in Stripe Dashboard');
    console.log('   2. Application logs for webhook processing errors');
    console.log('   3. Database trigger errors (check end_time calculation)');
  }
  
  console.log('\n' + '='.repeat(60));
}

checkWebhookConfiguration().catch(console.error);

