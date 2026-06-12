import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/knowledge/categories — 获取分类列表
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    const { data, error } = await supabase
      .from('knowledge_categories')
      .select('*')
      .eq('status', status)
      .order('sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Count articles per category
    const { data: articleCounts } = await supabase
      .from('knowledge_articles')
      .select('category_id');

    const countMap: Record<number, number> = {};
    (articleCounts || []).forEach((a: { category_id: number | null }) => {
      if (a.category_id) {
        countMap[a.category_id] = (countMap[a.category_id] || 0) + 1;
      }
    });

    const categories = (data || []).map((c: { id: number; name: string; parent_id: number | null; sort_order: number; status: string; created_at: string }) => ({
      id: c.id,
      name: c.name,
      parentId: c.parent_id,
      sortOrder: c.sort_order,
      status: c.status,
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

    // trainee不能创建分类
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

    // Get max sort_order
    const { data: siblings } = await supabase
      .from('knowledge_categories')
      .select('sort_order')
      .eq('parent_id', parentId || null)
      .order('sort_order', { ascending: false })
      .limit(1);

    const maxSort = siblings && siblings.length > 0 ? (siblings[0] as { sort_order: number }).sort_order : 0;

    const { data, error } = await supabase
      .from('knowledge_categories')
      .insert({
        name: name.trim(),
        parent_id: parentId || null,
        sort_order: maxSort + 1,
        status,
        created_by: userInfo?.id || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: data, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/knowledge/categories — 更新分类（重命名、移动、排序、审核、归档）
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getAuthFromHeaders(request);
    const role = userInfo?.role || 'trainee';

    if (role === 'trainee') {
      return NextResponse.json({ error: '新人无权编辑分类' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, parentId, sortOrder, status } = body;

    if (!id) return NextResponse.json({ error: '缺少分类ID' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) updateData.parent_id = parentId || null;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;
    if (status !== undefined) {
      // 只有培训负责人可以改status
      if (role !== 'training_manager') {
        return NextResponse.json({ error: '仅培训负责人可审核/归档分类' }, { status: 403 });
      }
      updateData.status = status;
    }

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

// DELETE /api/knowledge/categories — 删除分类
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userInfo = getAuthFromHeaders(request);
    const role = userInfo?.role || 'trainee';

    if (role !== 'training_manager') {
      return NextResponse.json({ error: '仅培训负责人可删除分类' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少分类ID' }, { status: 400 });

    // Check for child categories
    const { data: children } = await supabase
      .from('knowledge_categories')
      .select('id')
      .eq('parent_id', id);

    if (children && children.length > 0) {
      return NextResponse.json({ error: '该分类下有子分类，请先删除子分类' }, { status: 400 });
    }

    // Check for articles in this category
    const { data: articles } = await supabase
      .from('knowledge_articles')
      .select('id')
      .eq('category_id', id);

    if (articles && articles.length > 0) {
      return NextResponse.json({ error: '该分类下有文章，请先移动或删除文章' }, { status: 400 });
    }

    const { error } = await supabase.from('knowledge_categories').delete().eq('id', Number(id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
