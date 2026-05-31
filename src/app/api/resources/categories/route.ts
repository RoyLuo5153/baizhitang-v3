import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/resources/categories — 获取分类树
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('resource_categories')
      .select('*')
      .order('sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Count resources per category
    const { data: resourceCounts } = await supabase
      .from('resources')
      .select('category_id')
      .eq('is_active', true);

    const countMap: Record<number, number> = {};
    (resourceCounts || []).forEach((r: { category_id: number | null }) => {
      if (r.category_id) {
        countMap[r.category_id] = (countMap[r.category_id] || 0) + 1;
      }
    });

    // Build tree
    const categories = (data || []).map((c: { id: number; name: string; parent_id: number | null; sort_order: number | null; icon: string | null; created_at: string | null }) => ({
      id: c.id,
      name: c.name,
      parentId: c.parent_id,
      sortOrder: c.sort_order || 0,
      icon: c.icon,
      resourceCount: countMap[c.id] || 0,
      createdAt: c.created_at,
    }));

    return NextResponse.json({ categories });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/resources/categories — 新增分类
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { name, parentId, icon } = body;

    if (!name) return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 });

    // Get max sort_order for this parent
    const { data: siblings } = await supabase
      .from('resource_categories')
      .select('sort_order')
      .eq('parent_id', parentId || null)
      .order('sort_order', { ascending: false })
      .limit(1);

    const maxSort = siblings && siblings.length > 0 ? (siblings[0] as { sort_order: number }).sort_order : 0;

    const { data, error } = await supabase
      .from('resource_categories')
      .insert({
        name,
        parent_id: parentId || null,
        sort_order: maxSort + 1,
        icon: icon || 'FolderTree',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: data, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/resources/categories — 更新分类（重命名、移动、排序）
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { id, name, parentId, sortOrder, icon } = body;

    if (!id) return NextResponse.json({ error: '缺少分类ID' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) updateData.parent_id = parentId || null;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;
    if (icon !== undefined) updateData.icon = icon;

    const { data, error } = await supabase
      .from('resource_categories')
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

// DELETE /api/resources/categories — 删除分类
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少分类ID' }, { status: 400 });

    // Check for child categories
    const { data: children } = await supabase
      .from('resource_categories')
      .select('id')
      .eq('parent_id', id);

    if (children && children.length > 0) {
      return NextResponse.json({ error: '该分类下有子分类，请先删除子分类' }, { status: 400 });
    }

    // Check for resources in this category
    const { data: resources } = await supabase
      .from('resources')
      .select('id')
      .eq('category_id', id)
      .eq('is_active', true);

    if (resources && resources.length > 0) {
      return NextResponse.json({ error: '该分类下有资料，请先移动或删除资料' }, { status: 400 });
    }

    const { error } = await supabase.from('resource_categories').delete().eq('id', Number(id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
