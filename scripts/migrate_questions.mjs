import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const batches = JSON.parse(fs.readFileSync('/tmp/question_batches.json', 'utf-8'));

async function migrate() {
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < batches.length; i++) {
    const { error } = await supabase.from('questions').insert(batches[i]);
    if (error) {
      console.error(`Batch ${i+1} error:`, error.message?.substring(0, 200));
      errors += batches[i].length;
    } else {
      inserted += batches[i].length;
      console.log(`Batch ${i+1}: inserted ${inserted} total`);
    }
  }
  console.log(`Done: ${inserted} inserted, ${errors} errors out of ${batches.flat().length}`);
}

migrate();
