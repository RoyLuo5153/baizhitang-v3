import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  // 禁止自助注册 - 所有账号必须由 training_manager 通过 /api/users 创建
  return NextResponse.json({ error: '自助注册已关闭，请联系管理员开通账号' }, { status: 403 });
}
