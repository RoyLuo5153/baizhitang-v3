import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 使用coze-coding-ai的数据库连接
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const questions = JSON.parse(fs.readFileSync('/tmp/questions.json', 'utf-8'));

const typeMap = { 'choice': 'single_choice', 'single_choice': 'single_choice', 
  'multiple_choice': 'multiple_choice', 'true_false': 'true_false', 
  'essay': 'essay', 'fill_blank': 'essay' };

async function migrate() {
  let inserted = 0;
  let errors = 0;
  const BATCH = 25;
  
  for (let i = 0; i < questions.length; i += BATCH) {
    const batch = questions.slice(i, i + BATCH);
    const rows = batch.map(q => ({
      level_id: q.level_id || 1,
      question_type: typeMap[q.question_type] || 'single_choice',
      difficulty: q.difficulty || 'medium',
      content: q.question || '',
      options: q.options || null,
      answer: q.answer || null,
      explanation: q.explanation || '',
      is_active: true,
      created_by: 1,
    }));
    
    const { error } = await supabase.from('questions').insert(rows);
    if (error) {
      console.error(`Batch ${i}-${i+BATCH} error:`, error.message?.substring(0, 200));
      // Try one by one
      for (const row of rows) {
        const { error: e2 } = await supabase.from('questions').insert([row]);
        if (e2) { errors++; } else { inserted++; }
      }
    } else {
      inserted += batch.length;
    }
    if ((inserted + errors) % 100 === 0) console.log(`Progress: ${inserted + errors}/${questions.length}`);
  }
  console.log(`Done: ${inserted} inserted, ${errors} errors`);
}

migrate();
