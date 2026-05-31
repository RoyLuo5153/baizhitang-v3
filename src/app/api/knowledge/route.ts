import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'published';

    let query = supabase
      .from('knowledge_articles')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('view_count', { ascending: false });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (search) query = query.textSearch('title', search);

    const { data, error } = await query;
    if (error) throw error;

    // Filter by tag if specified (tags is an array column)
    let articles = data || [];
    if (tag) {
      articles = articles.filter((a: Record<string, unknown>) => {
        const tags = a.tags as string[] | null;
        return tags && tags.includes(tag);
      });
    }

    // Get user's bookmarks
    let bookmarkIds: number[] = [];
    if (userId) {
      const { data: bookmarks } = await supabase
        .from('knowledge_bookmarks')
        .select('article_id')
        .eq('user_id', userId);
      bookmarkIds = (bookmarks || []).map((b: { article_id: number }) => b.article_id);
    }

    const result = articles.map((a: Record<string, unknown>) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      category: a.category,
      tags: a.tags || [],
      scenario: a.scenario || '',
      problemSolved: a.problem_solved || '',
      authorId: a.author_id,
      status: a.status,
      viewCount: a.view_count || 0,
      bookmarkCount: a.bookmark_count || 0,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      publishedAt: a.published_at,
      isBookmarked: bookmarkIds.includes(a.id as number),
    }));

    // Distinct categories and tags for filters
    const categories = [...new Set(result.map(a => a.category).filter(Boolean))];
    const allTags = [...new Set(result.flatMap(a => a.tags))];

    return NextResponse.json({ articles: result, categories, tags: allTags });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('knowledge_articles')
      .insert({
        title: body.title,
        content: body.content || '',
        category: body.category || '',
        author_id: body.authorId,
        tags: body.tags || [],
        scenario: body.scenario || '',
        problem_solved: body.problemSolved || '',
        status: body.status || 'draft',
        view_count: 0,
        bookmark_count: 0,
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

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.scenario !== undefined) updateData.scenario = body.scenario;
    if (body.problemSolved !== undefined) updateData.problem_solved = body.problemSolved;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'published') updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('knowledge_articles')
      .update(updateData)
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

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // Delete bookmarks first
    await supabase.from('knowledge_bookmarks').delete().eq('article_id', id);

    const { error } = await supabase
      .from('knowledge_articles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
