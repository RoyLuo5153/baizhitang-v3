import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// 文件类型和大小限制
const ALLOWED_TYPES = [
  { mime: 'image/jpeg', maxSize: 5 * 1024 * 1024 },
  { mime: 'image/png', maxSize: 5 * 1024 * 1024 },
  { mime: 'image/gif', maxSize: 5 * 1024 * 1024 },
  { mime: 'image/webp', maxSize: 5 * 1024 * 1024 },
  { mime: 'audio/mpeg', maxSize: 20 * 1024 * 1024 },
  { mime: 'audio/wav', maxSize: 20 * 1024 * 1024 },
  { mime: 'audio/webm', maxSize: 20 * 1024 * 1024 },
  { mime: 'audio/x-m4a', maxSize: 20 * 1024 * 1024 },
  { mime: 'video/mp4', maxSize: 100 * 1024 * 1024 },
  { mime: 'video/webm', maxSize: 100 * 1024 * 1024 },
  { mime: 'application/pdf', maxSize: 20 * 1024 * 1024 },
  { mime: 'application/msword', maxSize: 20 * 1024 * 1024 },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', maxSize: 20 * 1024 * 1024 },
  { mime: 'application/vnd.ms-excel', maxSize: 10 * 1024 * 1024 },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', maxSize: 10 * 1024 * 1024 },
  { mime: 'text/csv', maxSize: 10 * 1024 * 1024 },
];

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// POST /api/upload — 上传文件到 Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const userInfo = getAuthFromHeaders(request);
    const role = userInfo?.role || 'trainee';

    // trainee不能上传
    if (role === 'trainee') {
      return NextResponse.json({ error: '新人无权上传文件' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '缺少文件' }, { status: 400 });
    }

    // 校验文件类型
    const rule = ALLOWED_TYPES.find(r => r.mime === file.type);
    if (!rule) {
      return NextResponse.json({ error: `不支持的文件类型: ${file.type}` }, { status: 400 });
    }

    // 校验文件大小
    if (file.size > rule.maxSize) {
      const maxMB = (rule.maxSize / (1024 * 1024)).toFixed(0);
      return NextResponse.json({ error: `文件过大，最大支持 ${maxMB}MB` }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 500 });
    }

    // 文件名加UUID前缀避免冲突
    const fileName = `${generateUUID()}-${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('knowledge-attachments')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from('knowledge-attachments')
      .getPublicUrl(fileName);

    return NextResponse.json({
      url: urlData.publicUrl,
      key: fileName,
      type: file.type,
      name: file.name,
      size: file.size,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
