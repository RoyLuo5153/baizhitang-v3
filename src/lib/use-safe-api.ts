'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from './api-client';

/**
 * 结构性防错 Hook：类型安全的 API 请求
 * 
 * 自动处理：
 * 1. loading 状态
 * 2. 错误处理（不抛出，不崩溃）
 * 3. 数组字段空值保护（sanitizeArrays）
 * 
 * 使用示例：
 * ```tsx
 * const { data: plans, loading } = useSafeApi<PlansResponse>('/api/empower', { plans: [] });
 * // plans.plans 永远是数组，不可能为 undefined
 * ```
 */
export function useSafeApi<T>(url: string | null, defaultValue: T) {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await apiGet<T>(url, defaultValue);
    setData(result);
    setLoading(false);
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * 手动触发安全 API 调用
 * 适用于按钮点击、表单提交等场景
 */
export function useSafeAction<TReq, TRes>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback(async (url: string, body: TReq, defaultValue: TRes): Promise<TRes> => {
    setLoading(true);
    setError(null);
    const result = await apiPost<TReq, TRes>(url, body, defaultValue);
    setLoading(false);
    return result;
  }, []);

  const put = useCallback(async (url: string, body: TReq, defaultValue: TRes): Promise<TRes> => {
    setLoading(true);
    setError(null);
    const result = await apiPut<TReq, TRes>(url, body, defaultValue);
    setLoading(false);
    return result;
  }, []);

  const del = useCallback(async (url: string, defaultValue: TRes): Promise<TRes> => {
    setLoading(true);
    setError(null);
    const result = await apiDelete<TRes>(url, defaultValue);
    setLoading(false);
    return result;
  }, []);

  return { post, put, del, loading, error };
}
