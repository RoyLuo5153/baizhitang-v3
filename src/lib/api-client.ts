/**
 * 结构性防错：API 请求工具层
 * 
 * 解决的问题：前端 fetch → json() 返回 any，.map() 崩溃无法被 TS 编译器拦截
 * 
 * 核心机制：
 * 1. 所有 API 调用必须通过 apiGet/apiPost，禁止裸 fetch
 * 2. 响应必须有 TypeScript 类型定义
 * 3. 数组字段自动 fallback 为空数组（结构性防错，不需要记住判空）
 */

/** 通用 API 响应类型 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 带数组字段的响应自动保护：数组字段不可能为 undefined */
export type ArraySafe<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: NonNullable<T[P]>;
};

/**
 * 类型安全的 GET 请求
 * @param url API 路径
 * @param defaultValue 当请求失败或数据为空时的默认值
 */
export async function apiGet<T>(url: string, defaultValue: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`API GET ${url} returned ${res.status}`);
      return defaultValue;
    }
    const json = await res.json();
    // 如果API返回 {error: ...}，使用默认值
    if (json.error) {
      console.warn(`API GET ${url} error: ${json.error}`);
      return defaultValue;
    }
    return sanitizeArrays(json, defaultValue) as T;
  } catch (err) {
    console.warn(`API GET ${url} failed:`, err);
    return defaultValue;
  }
}

/**
 * 类型安全的 POST 请求
 */
export async function apiPost<TReq, TRes>(
  url: string, 
  body: TReq, 
  defaultValue: TRes
): Promise<TRes> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`API POST ${url} returned ${res.status}`);
      return defaultValue;
    }
    const json = await res.json();
    if (json.error) {
      console.warn(`API POST ${url} error: ${json.error}`);
      return defaultValue;
    }
    return sanitizeArrays(json, defaultValue) as TRes;
  } catch (err) {
    console.warn(`API POST ${url} failed:`, err);
    return defaultValue;
  }
}

/**
 * PUT 请求
 */
export async function apiPut<TReq, TRes>(
  url: string,
  body: TReq,
  defaultValue: TRes
): Promise<TRes> {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`API PUT ${url} returned ${res.status}`);
      return defaultValue;
    }
    const json = await res.json();
    if (json.error) {
      console.warn(`API PUT ${url} error: ${json.error}`);
      return defaultValue;
    }
    return sanitizeArrays(json, defaultValue) as TRes;
  } catch (err) {
    console.warn(`API PUT ${url} failed:`, err);
    return defaultValue;
  }
}

/**
 * DELETE 请求
 */
export async function apiDelete<T>(url: string, defaultValue: T): Promise<T> {
  try {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      console.warn(`API DELETE ${url} returned ${res.status}`);
      return defaultValue;
    }
    const json = await res.json();
    if (json.error) {
      console.warn(`API DELETE ${url} error: ${json.error}`);
      return defaultValue;
    }
    return sanitizeArrays(json, defaultValue) as T;
  } catch (err) {
    console.warn(`API DELETE ${url} failed:`, err);
    return defaultValue;
  }
}

/**
 * 核心防错：将响应中的数组字段与默认值对齐
 * 如果API返回的数组字段为 undefined/null，用默认值的对应数组替换
 * 这是结构性的——调用者不需要记住判空，数组字段不可能为 undefined
 */
function sanitizeArrays<T>(response: Record<string, unknown>, defaultValue: T): T {
  const result = { ...response } as Record<string, unknown>;
  const def = defaultValue as Record<string, unknown>;
  
  for (const key of Object.keys(def)) {
    if (Array.isArray(def[key])) {
      // 默认值是数组 → 确保响应中对应字段也是数组
      if (!Array.isArray(result[key])) {
        result[key] = def[key];
      }
    }
  }
  
  return result as T;
}

// ============= 常用默认值 =============

/** 空分页响应 */
export const EMPTY_PAGINATED = { items: [], total: 0 };

/** 空列表响应 */
export const EMPTY_LIST = { data: [] };

/** 空通知列表 */
export const EMPTY_NOTIFICATIONS = { notifications: [] };

/** 空学员列表 */
export const EMPTY_TRAINEES = { trainees: [] };

/** 空模块列表 */
export const EMPTY_MODULES = { modules: [], progress: [], levels: [] };

/** 空诊断数据 */
export const EMPTY_DIAGNOSIS = { 
  trainees: [], 
  summary: { total: 0, qualified: 0, unqualified: 0 },
  quadrants: { A: 0, B: 0, C: 0, D: 0 }
};
