import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 从cookie解析用户身份
function getUserFromCookie(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch {
    return null;
  }
}

// GET /api/knowledge — 获取文章列表（按角色过滤）
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getUserFromCookie(request);
    const role = userInfo?.role || 'trainee';

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const search = searchParams.get('search');
    const statusFilter = searchParams.get('status');

    let query = supabase
      .from('knowledge_articles')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('view_count', { ascending: false });

    // 按角色过滤状态：
    // trainee只能看approved；其他角色可按statusFilter查看，默认看全部非draft
    if (role === 'trainee') {
      query = query.eq('status', 'approved');
    } else if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    // 无statusFilter时，非trainee看全部（含pending_review/approved/draft）

    if (category) query = query.eq('category', category);
    if (search) query = query.textSearch('title', search);

    const { data, error } = await query;
    if (error) throw error;

    // Filter by tag if specified
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
      reviewedBy: a.reviewed_by,
      reviewedAt: a.reviewed_at,
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

    // 统计待审核数量（非trainee角色可见）
    let pendingCount = 0;
    if (role !== 'trainee') {
      const { count } = await supabase
        .from('knowledge_articles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_review');
      pendingCount = count || 0;
    }

    return NextResponse.json({
      articles: result,
      categories,
      tags: allTags,
      pendingCount,
      userRole: role,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/knowledge — 创建文章（按角色设置默认status）
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getUserFromCookie(request);
    const role = userInfo?.role || 'trainee';
    const userId = userInfo?.id || null;

    // trainee不能创建文章
    if (role === 'trainee') {
      return NextResponse.json({ error: '新人无权创建文章' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.title) {
      return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
    }

    // 培训负责人直接approved，其他角色pending_review
    const defaultStatus = role === 'training_manager' ? 'approved' : 'pending_review';
    const finalStatus = body.status === 'draft' ? 'draft' : defaultStatus;

    const insertData: Record<string, unknown> = {
      title: body.title,
      content: body.content || '',
      category: body.category || '',
      author_id: String(userId),
      tags: body.tags || [],
      scenario: body.scenario || '',
      problem_solved: body.problemSolved || '',
      status: finalStatus,
      view_count: 0,
      bookmark_count: 0,
    };

    // 培训负责人直接approved时，设置审核信息
    if (finalStatus === 'approved') {
      insertData.reviewed_by = userId;
      insertData.reviewed_at = new Date().toISOString();
      insertData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('knowledge_articles')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      article: data,
      reviewStatus: finalStatus === 'pending_review' ? 'pending_review' : 'approved',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/knowledge — 编辑文章（按角色处理status）
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getUserFromCookie(request);
    const role = userInfo?.role || 'trainee';
    const userId = userInfo?.id || null;

    // trainee不能编辑
    if (role === 'trainee') {
      return NextResponse.json({ error: '新人无权编辑文章' }, { status: 403 });
    }

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

    // 处理status：非培训负责人编辑后回到pending_review
    if (body.status !== undefined) {
      if (role === 'training_manager') {
        // 培训负责人可以直接设置任何status
        updateData.status = body.status;
        if (body.status === 'approved') {
          updateData.reviewed_by = userId;
          updateData.reviewed_at = new Date().toISOString();
          updateData.published_at = new Date().toISOString();
        }
      } else {
        // 带教老师/培训老师编辑后回pending_review
        updateData.status = 'pending_review';
        updateData.reviewed_by = null;
        updateData.reviewed_at = null;
      }
    }

    const { data, error } = await supabase
      .from('knowledge_articles')
      .update(updateData)
      .eq('id', body.articleId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      article: data,
      reviewStatus: (updateData.status as string) === 'pending_review' ? 'pending_review' : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/knowledge — 删除文章
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getUserFromCookie(request);
    const role = userInfo?.role || 'trainee';

    // 只有培训负责人可以删除
    if (role !== 'training_manager') {
      return NextResponse.json({ error: '仅培训负责人可删除文章' }, { status: 403 });
    }

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
