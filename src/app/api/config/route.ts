import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders, requireRoles, ROLES } from '@/lib/auth/api-auth';

// 内存缓存
const configCache = new Map<string, { value: string; type: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

function getFromCache(key: string): { value: string; type: string } | null {
  const entry = configCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) {
    return { value: entry.value, type: entry.type };
  }
  configCache.delete(key);
  return null;
}

function setCache(key: string, value: string, type: string) {
  configCache.set(key, { value, type, ts: Date.now() });
}

function convertValue(raw: string, type: string): string | number | boolean | object {
  switch (type) {
    case 'number': return Number(raw);
    case 'boolean': return raw === 'true';
    case 'json': return JSON.parse(raw);
    default: return raw;
  }
}

// GET /api/config — 查询配置
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const key = searchParams.get('key');

    const supabase = getSupabaseClient();

    // 单个配置项
    if (key) {
      const cached = getFromCache(key);
      if (cached) {
        return NextResponse.json({ key, value: convertValue(cached.value, cached.type), valueType: cached.type });
      }

      const { data, error } = await supabase.rpc('get_config_dict', { cfg_key: key });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (!data) {
        return NextResponse.json({ error: '配置项不存在' }, { status: 404 });
      }

      setCache(key, data.config_value, data.value_type);
      return NextResponse.json({ key, value: convertValue(data.config_value, data.value_type), valueType: data.value_type });
    }

    // 按分类查询
    const { data, error } = await supabase.rpc('get_config_dict', { cat: category || null, cfg_key: null });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (Array.isArray(data) ? data : []).map((item: { category: string; config_key: string; config_value: string; value_type: string; description: string }) => ({
      category: item.category,
      key: item.config_key,
      value: convertValue(item.config_value, item.value_type),
      valueType: item.value_type,
      description: item.description,
    }));

    return NextResponse.json({ configs: items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/config — 更新配置项
export async function PUT(req: NextRequest) {
  try {
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const denied = requireRoles(auth, ROLES.TRAINING_MANAGER, ROLES.BOSS);
    if (denied) return denied;

    const body = await req.json();
    const { key, value, valueType } = body;

    if (!key) return NextResponse.json({ error: '缺少配置键' }, { status: 400 });

    const supabase = getSupabaseClient();
    const updateData: Record<string, unknown> = {
      config_value: String(value),
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    };
    if (valueType) updateData.value_type = valueType;

    const { data, error } = await supabase
      .from('config_dict')
      .update(updateData)
      .eq('config_key', key)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 清除缓存
    configCache.delete(key);

    return NextResponse.json({ success: true, config: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/config/reload — 重新加载配置缓存
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthFromHeaders(req);
    if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

    configCache.clear();

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_config_dict', { cat: null, cfg_key: null });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const item of (Array.isArray(data) ? data : [])) {
      setCache(item.config_key, item.config_value, item.value_type);
    }

    return NextResponse.json({ success: true, reloaded: (Array.isArray(data) ? data : []).length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
