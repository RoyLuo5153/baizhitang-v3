import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

// PATCH /api/knowledge/review — 审核（仅培训负责人）
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getAuthFromHeaders(request);
    const role = userInfo?.role;
    const userId = userInfo?.id;

    if (role !== 'training_manager') {
      return NextResponse.json({ error: '仅培训负责人可审核文章' }, { status: 403 });
    }

    const body = await request.json();
    const { articleId, action, comment } = body;

    if (!articleId || !action) {
      return NextResponse.json({ error: 'Missing articleId or action' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action, must be approve or reject' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const updateData: Record<string, unknown> = {
      status: newStatus,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'approved') {
      updateData.published_at = new Date().toISOString();
    }

    if (comment) {
      // 可选：存comment到review_comment字段（如果有的话）
      // 目前不存，仅在前端显示
    }

    const { data, error } = await supabase
      .from('knowledge_articles')
      .update(updateData)
      .eq('id', articleId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ article: data, status: newStatus });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/knowledge/review — 获取待审核列表（仅培训负责人）
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getAuthFromHeaders(request);
    const role = userInfo?.role;

    if (role !== 'training_manager') {
      return NextResponse.json({ error: '仅培训负责人可查看待审核列表' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('id, title, category, author_id, status, created_at, updated_at')
      .eq('status', 'pending_review')
      .order('updated_at', { ascending: true });

    if (error) throw error;

    // 获取作者名称
    const authorIds = [...new Set((data || []).map((a: { author_id: string }) => a.author_id).filter(Boolean))];
    let authorMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, real_name')
        .in('id', authorIds);
      (users || []).forEach((u: { id: number; real_name: string }) => {
        authorMap[String(u.id)] = u.real_name;
      });
    }

    const result = (data || []).map((a: Record<string, unknown>) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      authorId: a.author_id,
      authorName: authorMap[String(a.author_id)] || '未知',
      status: a.status,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));

    return NextResponse.json({ articles: result, count: result.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
