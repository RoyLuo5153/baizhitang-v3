import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { userId, articleId, action } = body;

    if (!userId || !articleId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'bookmark') {
      const { error } = await supabase
        .from('knowledge_bookmarks')
        .insert({ user_id: userId, article_id: articleId });
      if (error && !error.message.includes('duplicate')) throw error;

      await supabase.rpc('increment_bookmark', { article_id: articleId });
    } else if (action === 'unbookmark') {
      await supabase
        .from('knowledge_bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('article_id', articleId);
    } else if (action === 'view') {
      await supabase.rpc('increment_view', { article_id: articleId });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
