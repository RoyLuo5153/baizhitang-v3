import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const client = getSupabaseClient();
  const body = await request.json();
  const { questions: rows } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
  }

  const { error } = await client.from('questions').insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, inserted: rows.length });
}

export async function GET() {
  const client = getSupabaseClient();
  const { count, error } = await client.from('questions').select('*', { count: 'exact', head: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: 'ok', questionCount: count });
}
