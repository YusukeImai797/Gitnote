// Test Supabase connection
const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    process.env[key] = value;
  }
});

const { createClient } = require('@supabase/supabase-js');

async function testSupabase() {
  console.log('=== Supabase Connection Test ===\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing');
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
  console.log('');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables');
    return;
  }

  // Create Supabase client with service role key
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('Testing Service Role connection...\n');

  // Test 1: Check if users table exists
  console.log('Test 1: Checking users table...');
  const { data: tableCheck, error: tableError } = await supabase
    .from('users')
    .select('count')
    .limit(0);

  if (tableError) {
    console.error('❌ Error accessing users table:', tableError.message);
    console.error('Details:', tableError);
    return;
  }
  console.log('✓ Users table accessible\n');

  // Test 2: Try to insert a test user
  console.log('Test 2: Attempting to upsert test user...');
  const testUser = {
    github_user_id: 999999999,
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg'
  };

  const { data: upsertData, error: upsertError } = await supabase
    .from('users')
    .upsert(testUser, { onConflict: 'github_user_id' })
    .select();

  if (upsertError) {
    console.error('❌ Error upserting user:', upsertError.message);
    console.error('Code:', upsertError.code);
    console.error('Details:', upsertError.details);
    console.error('Hint:', upsertError.hint);
    console.error('Full error:', upsertError);
    return;
  }

  console.log('✓ User upserted successfully');
  console.log('Data:', upsertData);
  console.log('');

  // Test 3: Clean up test user
  console.log('Test 3: Cleaning up test user...');
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('github_user_id', 999999999);

  if (deleteError) {
    console.error('❌ Error deleting test user:', deleteError.message);
  } else {
    console.log('✓ Test user deleted\n');
  }

  console.log('=== All tests completed ===');
}

testSupabase().catch(console.error);
