import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

// ─── 文件类型限制配置 ─────────────────────────────────────
const FILE_LIMITS: Record<string, { exts: string[]; maxSize: number }> = {
  image: { exts: ['jpg', 'jpeg', 'png', 'gif', 'webp'], maxSize: 5 * 1024 * 1024 },
  audio: { exts: ['mp3', 'wav', 'webm', 'm4a'], maxSize: 20 * 1024 * 1024 },
  video: { exts: ['mp4', 'webm'], maxSize: 100 * 1024 * 1024 },
  document: { exts: ['pdf', 'doc', 'docx'], maxSize: 20 * 1024 * 1024 },
  spreadsheet: { exts: ['xlsx', 'xls', 'csv'], maxSize: 10 * 1024 * 1024 },
};

const ALL_ALLOWED_EXTS = Object.values(FILE_LIMITS).flatMap(l => l.exts);

function getFileCategory(ext: string): string | null {
  for (const [category, config] of Object.entries(FILE_LIMITS)) {
    if (config.exts.includes(ext)) return category;
  }
  return null;
}

function getMaxSizeForExt(ext: string): number {
  const category = getFileCategory(ext);
  if (!category) return 0;
  return FILE_LIMITS[category].maxSize;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

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

// POST /api/upload — 上传文件到对象存储
export async function POST(request: NextRequest) {
  try {
    // 1. 鉴权：新人无权上传
    const userInfo = getUserFromCookie(request);
    const role = userInfo?.role || 'trainee';
    if (role === 'trainee') {
      return NextResponse.json({ error: '新人无权上传文件' }, { status: 403 });
    }

    // 2. 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: '未选择文件' }, { status: 400 });
    }

    // 3. 后端格式校验
    const originalName = file.name;
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    if (!ALL_ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的文件格式 .${ext}，允许：${ALL_ALLOWED_EXTS.join(', ')}` },
        { status: 400 }
      );
    }

    // 4. 大小校验
    const maxSize = getMaxSizeForExt(ext);
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `文件过大（${formatFileSize(file.size)}），${getFileCategory(ext)}类最大 ${formatFileSize(maxSize)}` },
        { status: 400 }
      );
    }

    // 5. 上传到对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const category = getFileCategory(ext) || 'other';
    const storageKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName: `knowledge-attachments/${category}/${originalName}`,
      contentType: file.type || 'application/octet-stream',
    });

    // 6. 返回元信息（存key，不存URL）
    return NextResponse.json({
      key: storageKey,
      type: category,
      name: originalName,
      size: file.size,
    });
  } catch (e) {
    console.error('[Upload API] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
