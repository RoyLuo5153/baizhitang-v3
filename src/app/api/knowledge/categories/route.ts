import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// 从cookie解析用户身份

// GET /api/knowledge/categories — 获取分类列表
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const { data, error } = await supabase
      .from('knowledge_categories')
      .select('*')
      .neq('status', 'archived')
      .order('sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Count articles per category
    const { data: articleCounts } = await supabase
      .from('knowledge_articles')
      .select('category_id')
      .eq('status', 'approved');

    const countMap: Record<number, number> = {};
    (articleCounts || []).forEach((r: { category_id: number | null }) => {
      if (r.category_id) {
        countMap[r.category_id] = (countMap[r.category_id] || 0) + 1;
      }
    });

    const categories = (data || []).map((c: {
      id: number; name: string; parent_id: number | null;
      sort_order: number | null; status: string | null;
      created_by: number | null; created_at: string | null;
    }) => ({
      id: c.id,
      name: c.name,
      parentId: c.parent_id,
      sortOrder: c.sort_order || 0,
      status: c.status,
      createdBy: c.created_by,
      articleCount: countMap[c.id] || 0,
      createdAt: c.created_at,
    }));

    return NextResponse.json({ categories });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/knowledge/categories — 新增分类
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getAuthFromHeaders(request);
    const role = userInfo?.role || 'trainee';
    if (role === 'trainee') {
      return NextResponse.json({ error: '新人无权创建分类' }, { status: 403 });
    }

    const body = await request.json();
    const { name, parentId } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 });
    }

    // 培训负责人直接active，其他角色pending
    const status = role === 'training_manager' ? 'active' : 'pending';

    // Get max sort_order for this parent
    const { data: siblings } = await supabase
      .from('knowledge_categories')
      .select('sort_order')
      .eq('parent_id', parentId || null)
      .order('sort_order', { ascending: false })
      .limit(1);

    const maxSort = siblings && siblings.length > 0
      ? (siblings[0] as { sort_order: number }).sort_order
      : 0;

    const { data, error } = await supabase
      .from('knowledge_categories')
      .insert({
        name: name.trim(),
        parent_id: parentId || null,
        sort_order: maxSort + 1,
        created_by: userInfo?.id || null,
        status,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const reviewStatus = status === 'active' ? '已直接启用' : '已提交审核';
    return NextResponse.json({ category: data, reviewStatus, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/knowledge/categories — 编辑分类
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getAuthFromHeaders(request);
    const role = userInfo?.role || 'trainee';
    if (role !== 'training_manager') {
      return NextResponse.json({ error: '仅培训负责人可编辑分类' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, parentId, sortOrder } = body;
    if (!id) return NextResponse.json({ error: '缺少分类ID' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) updateData.parent_id = parentId || null;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;

    const { data, error } = await supabase
      .from('knowledge_categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: data, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/knowledge/categories — 归档分类（不物理删除）
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getAuthFromHeaders(request);
    const role = userInfo?.role || 'trainee';
    if (role !== 'training_manager') {
      return NextResponse.json({ error: '仅培训负责人可归档分类' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少分类ID' }, { status: 400 });

    // 归档而非物理删除
    const { data, error } = await supabase
      .from('knowledge_categories')
      .update({ status: 'archived' })
      .eq('id', Number(id))
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: data, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
