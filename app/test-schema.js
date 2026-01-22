
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.prod manually
const envPath = path.resolve(process.cwd(), '.env.production.local');
console.log('Loading env from:', envPath);
try {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1'); // Remove quotes
            process.env[key] = value;
        }
    });
} catch (e) {
    console.error('Error reading .env.prod:', e.message);
    process.exit(1);
}

async function testSchema() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.prod');
        process.exit(1);
    }

    console.log('Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Testing "users" table schema...');

    // 1. Try to select "github_user_id" (The fix assumes this exists)
    console.log('\n--- Test 1: Select "github_user_id" ---');
    const { data: data1, error: error1 } = await supabase
        .from('users')
        .select('id, github_user_id')
        .limit(1);

    if (error1) {
        console.error('❌ Failed to select github_user_id:', error1.message);
    } else {
        console.log('✅ Successfully selected github_user_id. Column exists!');
        // console.log('Sample data:', data1); // Mask data for privacy
    }

    // 2. Try to select "provider_id" (The cause of the bug)
    console.log('\n--- Test 2: Select "provider_id" ---');
    const { data: data2, error: error2 } = await supabase
        .from('users')
        .select('id, provider_id')
        .limit(1);

    if (error2) {
        console.log('✅ Expected error: Failed to select provider_id:', error2.message);
        console.log('This confirms that provider_id column DOES NOT exist, justifying the fix.');
    } else {
        console.error('❌ Unexpectedly succeeded to select provider_id. Column exists?');
        // console.log('Sample data:', data2);
    }

    // 3. Test the exact query logic used in auth.config.ts fix
    console.log('\n--- Test 3: Simulation of auth.config.ts logic ---');
    // Use a dummy ID for testing query structure
    const dummyGithubId = 12345;
    const { data: data3, error: error3 } = await supabase
        .from('users')
        .select('id, email')
        .eq('github_user_id', dummyGithubId)
        .limit(1);

    if (error3) {
        console.error('❌ Simulation failed:', error3.message);
    } else {
        console.log('✅ Simulation query succeeded (Structure is correct).');
    }
}

testSchema();
