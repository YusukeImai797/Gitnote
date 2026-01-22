
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.production.local');
try {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
    });
} catch (e) { process.exit(1); }

async function inspectFolders() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: folders, error } = await supabase.from('folder_paths').select('*');
    if (error) { console.error(error); return; }

    const badFolders = folders.filter(f => f.path.includes('api'));

    if (badFolders.length === 0) {
        console.log('✅ No bad folders found.');
    } else {
        console.log(`🚨 Found ${badFolders.length} bad folders:`);
        badFolders.forEach(f => {
            console.log(`ID: ${f.id} | Path: "${f.path}"`);
        });
    }
}

inspectFolders();
