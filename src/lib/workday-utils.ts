import { pgQueryOne } from '@/storage/database/pg-client';

/**
 * 判断某天是否是工作日
 * 1. 先查 workday_calendar 表，有记录则以记录为准
 * 2. 无记录时按默认规则：周一~周六=true，周日=false
 */
export async function isWorkday(date: Date): Promise<boolean> {
  const dateStr = date.toISOString().split('T')[0];
  const record = await pgQueryOne<{ is_workday: boolean }>(
    `SELECT is_workday FROM workday_calendar WHERE date = $1`,
    [dateStr]
  );
  if (record) {
    return record.is_workday;
  }
  // 默认规则：周日(0)休息，周一~周六(1-6)上班
  const dow = date.getDay();
  return dow !== 0;
}

/**
 * 从起始日期开始，计算第N个工作日的日期
 * N=1 返回 startDate 本身（入职当天即为D1）
 * N>1 从 startDate 之后开始找第N-1个工作日
 *
 * 举例：
 * - 周三入职：D1=周三, D2=周四, D3=周五, D4=周六, D5=下周一(跳过周日)
 * - 周四入职+下周六国庆：D1=周四, D2=周五, D3=下周一(跳过周六国庆+周日)
 */
export async function getNthWorkday(startDate: Date, n: number): Promise<Date> {
  if (n <= 1) {
    // D1 = 入职日当天（即使是非工作日也当作D1）
    return new Date(startDate);
  }

  let current = new Date(startDate);
  let workdaysFound = 1; // 已计入D1

  while (workdaysFound < n) {
    current = new Date(current.getTime() + 86400000); // +1天
    if (await isWorkday(current)) {
      workdaysFound++;
    }
  }

  return current;
}

/**
 * 获取两个日期之间的工作日数量
 */
export async function countWorkdaysBetween(start: Date, end: Date): Promise<number> {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (await isWorkday(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}
