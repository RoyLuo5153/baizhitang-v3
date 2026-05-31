import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'published';

    let query = supabase
      .from('knowledge_articles')
      .select('*')
      .order('view_count', { ascending: false });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (search) query = query.textSearch('title', search);

    const { data, error } = await query;
    if (error) throw error;

    // Get user's bookmarks
    let bookmarkIds: number[] = [];
    if (userId) {
      const { data: bookmarks } = await supabase
        .from('knowledge_bookmarks')
        .select('article_id')
        .eq('user_id', userId);
      bookmarkIds = (bookmarks || []).map((b: { article_id: number }) => b.article_id);
    }

    const articles = (data || []).map((a: Record<string, unknown>) => ({
      ...a,
      is_bookmarked: bookmarkIds.includes(a.id as number),
    }));

    return NextResponse.json({ articles });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('knowledge_articles')
      .insert({
        title: body.title,
        content: body.content || '',
        category: body.category || '',
        author_id: body.authorId,
        tags: body.tags || [],
        status: body.status || 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ article: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    if (!body.articleId) {
      return NextResponse.json({ error: 'Missing articleId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('knowledge_articles')
      .update({
        ...(body.title && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.tags && { tags: body.tags }),
        ...(body.status && { status: body.status, published_at: body.status === 'published' ? new Date().toISOString() : undefined }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.articleId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ article: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
