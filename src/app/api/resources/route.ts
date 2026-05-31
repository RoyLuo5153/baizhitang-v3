import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// GET /api/resources — 获取资料列表
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const fileType = searchParams.get('fileType');

    let query = supabase
      .from('resources')
      .select('*, resource_categories(name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (categoryId) {
      // Get all descendant category IDs
      const { data: allCats } = await supabase.from('resource_categories').select('id, parent_id');
      const catIds = getDescendantIds(Number(categoryId), allCats || []);
      query = query.in('category_id', catIds.length > 0 ? catIds : [Number(categoryId)]);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get tags for each resource
    const resourceIds = (data || []).map((r: { id: number }) => r.id);
    let tagMap: Record<number, string[]> = {};
    if (resourceIds.length > 0) {
      const { data: tagMaps } = await supabase
        .from('resource_tag_map')
        .select('resource_id, resource_tags(name)')
        .in('resource_id', resourceIds);
      (tagMaps || []).forEach((tm: { resource_id: number; resource_tags: { name: any }[] }) => {
        if (tm.resource_tags && tm.resource_tags.length > 0) {
          if (!tagMap[tm.resource_id]) tagMap[tm.resource_id] = [];
          tm.resource_tags.forEach((t: { name: any }) => {
            tagMap[tm.resource_id].push(String(t.name));
          });
        }
      });
    }

    const resources = (data || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      categoryId: r.category_id,
      categoryName: (r.resource_categories as { name: string } | null)?.name || r.category,
      fileType: r.file_type,
      fileUrl: r.file_url,
      description: r.description,
      uploadedBy: r.uploaded_by,
      viewCount: r.view_count || 0,
      downloadCount: r.download_count || 0,
      tags: tagMap[r.id as number] || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({ resources });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/resources — 上传/创建资料
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { title, category, categoryId, fileType, fileUrl, description, uploadedBy, tags } = body;

    if (!title) return NextResponse.json({ error: '标题不能为空' }, { status: 400 });

    const { data, error } = await supabase
      .from('resources')
      .insert({
        title,
        category: category || '',
        category_id: categoryId || null,
        file_type: fileType || 'document',
        file_url: fileUrl || null,
        description: description || '',
        uploaded_by: uploadedBy || null,
        is_active: true,
        view_count: 0,
        download_count: 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Handle tags
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tagName of tags) {
        // Upsert tag
        const { data: tagData } = await supabase
          .from('resource_tags')
          .upsert({ name: tagName }, { onConflict: 'name' })
          .select('id')
          .single();
        if (tagData) {
          await supabase.from('resource_tag_map').insert({ resource_id: data.id, tag_id: tagData.id });
        }
      }
    }

    return NextResponse.json({ resource: data, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/resources — 更新资料
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { id, title, category, categoryId, fileType, fileUrl, description, tags } = body;

    if (!id) return NextResponse.json({ error: '缺少资料ID' }, { status: 400 });

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (categoryId !== undefined) updateData.category_id = categoryId;
    if (fileType !== undefined) updateData.file_type = fileType;
    if (fileUrl !== undefined) updateData.file_url = fileUrl;
    if (description !== undefined) updateData.description = description;

    const { data, error } = await supabase
      .from('resources')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Handle tags update
    if (tags && Array.isArray(tags)) {
      await supabase.from('resource_tag_map').delete().eq('resource_id', id);
      for (const tagName of tags) {
        const { data: tagData } = await supabase
          .from('resource_tags')
          .upsert({ name: tagName }, { onConflict: 'name' })
          .select('id')
          .single();
        if (tagData) {
          await supabase.from('resource_tag_map').insert({ resource_id: id, tag_id: tagData.id });
        }
      }
    }

    return NextResponse.json({ resource: data, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/resources — 删除资料
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少资料ID' }, { status: 400 });

    // Soft delete
    const { error } = await supabase
      .from('resources')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Helper: get all descendant category IDs
function getDescendantIds(parentId: number, allCats: { id: number; parent_id: number | null }[]): number[] {
  const ids = [parentId];
  const children = allCats.filter(c => c.parent_id === parentId);
  for (const child of children) {
    ids.push(...getDescendantIds(child.id, allCats));
  }
  return ids;
}
