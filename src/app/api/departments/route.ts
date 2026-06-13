import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders, requireRoles, ROLES } from '@/lib/auth/api-auth';

// GET /api/departments — 获取部门列表
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ departments: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/departments — 添加部门
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const body = await req.json();
    const { name, positions } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '部门名称不能为空' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('departments')
      .insert({ name: name.trim(), positions: positions || [] })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '部门名称已存在' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, department: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/departments — 更新部门
export async function PUT(req: NextRequest) {
  try {
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const body = await req.json();
    const { id, name, positions } = body;

    if (!id) return NextResponse.json({ error: '缺少部门ID' }, { status: 400 });

    const supabase = getSupabaseClient();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name.trim();
    if (positions !== undefined) updateData.positions = positions;

    const { data, error } = await supabase
      .from('departments')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '部门名称已存在' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, department: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/departments — 删除部门
export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少部门ID' }, { status: 400 });

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
