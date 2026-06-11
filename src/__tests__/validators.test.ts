import { describe, it, expect } from 'vitest';

// --- keepChineseOnly ---

function keepChineseOnly(value: string) {
  const CHINESE_ONLY_PATTERN = /^[\u4e00-\u9fff]*$/;
  return Array.from(value).filter((char) => CHINESE_ONLY_PATTERN.test(char)).join('');
}

describe('keepChineseOnly', () => {
  it('keeps only Chinese characters from a mixed string', () => {
    expect(keepChineseOnly('三江校区东园')).toBe('三江校区东园');
  });

  it('removes ASCII letters and digits', () => {
    expect(keepChineseOnly('abc123校区')).toBe('校区');
  });

  it('removes punctuation', () => {
    expect(keepChineseOnly('你好，世界！')).toBe('你好世界');
  });

  it('returns empty string when no Chinese characters present', () => {
    expect(keepChineseOnly('hello 123 !@#')).toBe('');
  });

  it('handles empty string', () => {
    expect(keepChineseOnly('')).toBe('');
  });
});

// --- validateAccount ---

function validateAccount(identifier: string) {
  const ACCOUNT_PATTERN = /^[A-Za-z0-9\u4e00-\u9fff]{1,60}$/;
  if (!identifier) throw new Error('请输入账号');
  if (!ACCOUNT_PATTERN.test(identifier)) throw new Error('账号只能使用中文、英文、数字，且不超过 60 个字符');
}

describe('validateAccount', () => {
  it('accepts a valid alphanumeric identifier', () => {
    expect(() => validateAccount('拾遗用户A9K2')).not.toThrow();
  });

  it('accepts a short identifier', () => {
    expect(() => validateAccount('a')).not.toThrow();
  });

  it('rejects empty string', () => {
    expect(() => validateAccount('')).toThrow('请输入账号');
  });

  it('rejects string with special characters', () => {
    expect(() => validateAccount('hello@world')).toThrow('账号只能使用中文、英文、数字，且不超过 60 个字符');
  });

  it('rejects string with whitespace', () => {
    expect(() => validateAccount('user name')).toThrow('账号只能使用中文、英文、数字，且不超过 60 个字符');
  });

  it('rejects string exceeding 60 characters', () => {
    expect(() => validateAccount('a'.repeat(61))).toThrow('账号只能使用中文、英文、数字，且不超过 60 个字符');
  });

  it('rejects identifier with only punctuation', () => {
    expect(() => validateAccount('!!!')).toThrow('账号只能使用中文、英文、数字，且不超过 60 个字符');
  });
});

// --- formatPrice ---

function formatPrice(priceCents: number) {
  return `¥${(priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2)}`;
}

describe('formatPrice', () => {
  it('formats integer yuan without decimals', () => {
    expect(formatPrice(3500)).toBe('¥35');
  });

  it('formats price with jiao', () => {
    expect(formatPrice(3550)).toBe('¥35.50');
  });

  it('formats price with fen', () => {
    expect(formatPrice(3555)).toBe('¥35.55');
  });

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('¥0');
  });

  it('handles single cent', () => {
    expect(formatPrice(1)).toBe('¥0.01');
  });
});

// --- formatDate ---

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2026-06-08T08:30:00.000Z');
    expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });
});

// --- maskName ---

function maskName(name: string) {
  return name.length <= 1 ? name : `${name.slice(0, 1)}*`;
}

describe('maskName', () => {
  it('masks a two-character name', () => {
    expect(maskName('林同')).toBe('林*');
  });

  it('masks a three-character name', () => {
    expect(maskName('林同学')).toBe('林*');
  });

  it('does not mask a single character', () => {
    expect(maskName('林')).toBe('林');
  });

  it('handles empty string', () => {
    expect(maskName('')).toBe('');
  });
});

// --- contactType ---

function contactType(contact: string) {
  if (/^1\d{10}$/.test(contact)) return 'phone';
  if (contact.includes('@')) return 'email';
  if (/wx|wechat/i.test(contact)) return 'wechat';
  return 'other';
}

describe('contactType', () => {
  it('detects a mobile phone number', () => {
    expect(contactType('13800001234')).toBe('phone');
  });

  it('detects an email address', () => {
    expect(contactType('user@example.com')).toBe('email');
  });

  it('detects wechat id', () => {
    expect(contactType('wxid_abc')).toBe('wechat');
  });

  it('detects wechat in mixed case', () => {
    expect(contactType('WeChat123')).toBe('wechat');
  });

  it('returns other for unrecognized contact', () => {
    expect(contactType('qq:12345')).toBe('other');
  });
});

// --- classifyGoogleCategory ---

function classifyGoogleCategory(categories?: string[]) {
  const text = (categories || []).join(' ').toLowerCase();
  if (/fiction|novel|文学|小说/.test(text)) return 'novel';
  if (/education|textbook|教材|课程/.test(text)) return 'textbook';
  if (/exam|reference|study|考试|教辅|参考/.test(text)) return 'reference';
  return 'other';
}

describe('classifyGoogleCategory', () => {
  it('classifies fiction as novel', () => {
    expect(classifyGoogleCategory(['Fiction', 'Literary'])).toBe('novel');
  });

  it('classifies textbook category', () => {
    expect(classifyGoogleCategory(['Education', 'Textbooks'])).toBe('textbook');
  });

  it('classifies reference category', () => {
    expect(classifyGoogleCategory(['Study Aids', 'Reference'])).toBe('reference');
  });

  it('falls back to other for uncategorized', () => {
    expect(classifyGoogleCategory(['Computers', 'Technology'])).toBe('other');
  });

  it('handles undefined categories', () => {
    expect(classifyGoogleCategory(undefined)).toBe('other');
  });
});

// --- createId ---

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

describe('createId', () => {
  it('prepends the given prefix', () => {
    const id = createId('book');
    expect(id).toMatch(/^book_/);
  });

  it('includes a timestamp', () => {
    const id = createId('book');
    const parts = id.split('_');
    expect(parts.length).toBe(3);
    expect(Number(parts[1])).toBeGreaterThan(0);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId('test')));
    expect(ids.size).toBe(100);
  });
});

// --- locationPath ---

function locationPath(values: { campus?: string; department?: string; college?: string; major?: string }) {
  return [values.campus, values.department, values.college, values.major].filter(Boolean).join(' / ');
}

describe('locationPath', () => {
  it('joins all levels with separator', () => {
    expect(locationPath({ campus: '三江校区东园', department: '人工智能学部', college: '信息工程学院', major: '通信工程' }))
      .toBe('三江校区东园 / 人工智能学部 / 信息工程学院 / 通信工程');
  });

  it('omits undefined or empty values', () => {
    expect(locationPath({ campus: '三江校区东园', department: '', college: undefined, major: '通信工程' }))
      .toBe('三江校区东园 / 通信工程');
  });

  it('returns empty string for all undefined', () => {
    expect(locationPath({})).toBe('');
  });
});

// --- uniqueValues ---

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[];
}

describe('uniqueValues', () => {
  it('deduplicates and filters undefined values', () => {
    expect(uniqueValues(['a', 'b', 'a', undefined, '', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace', () => {
    expect(uniqueValues(['  hello  ', 'hello', 'world'])).toEqual(['hello', 'world']);
  });

  it('returns empty array for no valid values', () => {
    expect(uniqueValues([undefined, '', '  '])).toEqual([]);
  });
});

// --- hasInvalidLocationField ---

function hasInvalidLocationField(values: Record<string, string>) {
  const CHINESE_ONLY_PATTERN = /^[\u4e00-\u9fff]*$/;
  const locationFieldLabels = {
    campus: '校区',
    department: '学部',
    college: '学院',
    major: '专业',
  } as const;
  return (Object.keys(locationFieldLabels) as Array<keyof typeof locationFieldLabels>).find((key) => !CHINESE_ONLY_PATTERN.test(values[key].trim()));
}

describe('hasInvalidLocationField', () => {
  it('returns undefined when all fields are valid Chinese', () => {
    expect(hasInvalidLocationField({ campus: '三江校区', department: '人工智能学部', college: '信息工程学院', major: '通信工程' }))
      .toBeUndefined();
  });

  it('returns field key when field contains non-Chinese', () => {
    expect(hasInvalidLocationField({ campus: 'Sanjiang', department: '人工智能学部', college: '信息工程学院', major: '通信工程' }))
      .toBe('campus');
  });

  it('returns field key for empty field (empty is valid as it matches ^$)', () => {
    expect(hasInvalidLocationField({ campus: '', department: '', college: '', major: '' }))
      .toBeUndefined();
  });

  it('returns field key when field contains digits', () => {
    expect(hasInvalidLocationField({ campus: '校区1', department: '学部', college: '学院', major: '专业' }))
      .toBe('campus');
  });
});