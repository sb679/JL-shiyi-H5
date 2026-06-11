import { describe, it, expect } from 'vitest';

// --- type guards (mirrors src/types.ts) ---

type BookCategory = 'textbook' | 'novel' | 'reference' | 'other';
type BookCondition = 'new' | 'like_new' | 'annotated' | 'worn';
type BookStatus = 'available' | 'reserved' | 'sold' | 'removed';
type InterestStatus = 'active' | 'cancelled' | 'chosen';

function isValidBookCategory(value: unknown): value is BookCategory {
  return ['textbook', 'novel', 'reference', 'other'].includes(value as string);
}

function isValidBookCondition(value: unknown): value is BookCondition {
  return ['new', 'like_new', 'annotated', 'worn'].includes(value as string);
}

function isValidBookStatus(value: unknown): value is BookStatus {
  return ['available', 'reserved', 'sold', 'removed'].includes(value as string);
}

function isValidInterestStatus(value: unknown): value is InterestStatus {
  return ['active', 'cancelled', 'chosen'].includes(value as string);
}

// --- validateAppData (full shape check) ---

function validateAppData(data: unknown) {
  if (!data || typeof data !== 'object') throw new Error('AppData must be an object');
  const obj = data as Record<string, unknown>;

  // users
  if (!Array.isArray(obj.users)) throw new Error('users must be an array');
  for (const [i, u] of obj.users.entries()) {
    if (!u || typeof u !== 'object') throw new Error(`users[${i}] must be an object`);
    const user = u as Record<string, unknown>;
    expect(user.id, `users[${i}].id`).toBeTypeOf('string');
    expect(user.loginIdentifier, `users[${i}].loginIdentifier`).toBeTypeOf('string');
    expect(user.nickname, `users[${i}].nickname`).toBeTypeOf('string');
  }

  // books
  if (!Array.isArray(obj.books)) throw new Error('books must be an array');
  for (const [i, b] of obj.books.entries()) {
    if (!b || typeof b !== 'object') throw new Error(`books[${i}] must be an object`);
    const book = b as Record<string, unknown>;
    expect(book.id, `books[${i}].id`).toBeTypeOf('string');
    expect(book.sellerId, `books[${i}].sellerId`).toBeTypeOf('string');
    expect(book.title, `books[${i}].title`).toBeTypeOf('string');
    expect(book.author, `books[${i}].author`).toBeTypeOf('string');
    expect(book.priceCents, `books[${i}].priceCents`).toBeTypeOf('number');
    expect(Number.isFinite(book.priceCents)).toBe(true);
    expect((book.priceCents as number) >= 0, `books[${i}].priceCents should be >= 0`).toBe(true);
    expect(book.quantity, `books[${i}].quantity`).toBeTypeOf('number');
    expect(Number.isInteger(book.quantity)).toBe(true);
    expect((book.quantity as number) >= 1, `books[${i}].quantity should be >= 1`).toBe(true);
    expect(book.contact, `books[${i}].contact`).toBeTypeOf('string');
    expect(book.contactType, `books[${i}].contactType`).toBeTypeOf('string');
    expect(isValidBookCategory(book.category), `books[${i}].category`).toBe(true);
    expect(isValidBookCondition(book.condition), `books[${i}].condition`).toBe(true);
    expect(isValidBookStatus(book.status), `books[${i}].status`).toBe(true);
    expect(Array.isArray(book.images), `books[${i}].images must be array`).toBe(true);
    for (const [j, img] of (book.images as unknown[]).entries()) {
      const image = img as Record<string, unknown>;
      expect(image.id, `books[${i}].images[${j}].id`).toBeTypeOf('string');
      expect(image.url, `books[${i}].images[${j}].url`).toBeTypeOf('string');
      expect(image.sortOrder, `books[${i}].images[${j}].sortOrder`).toBeTypeOf('number');
    }
    // createdAt / updatedAt
    expect(book.createdAt, `books[${i}].createdAt`).toBeTypeOf('string');
    expect(book.updatedAt, `books[${i}].updatedAt`).toBeTypeOf('string');
    expect(isFinite(Date.parse(book.createdAt as string)), `books[${i}].createdAt should parse as date`).toBe(true);
    expect(isFinite(Date.parse(book.updatedAt as string)), `books[${i}].updatedAt should parse as date`).toBe(true);

    // status-specific
    if (book.status === 'sold') {
      expect(book.soldAt, `books[${i}].soldAt required when sold`).toBeTypeOf('string');
      expect(isFinite(Date.parse(book.soldAt as string)), `books[${i}].soldAt should parse as date`).toBe(true);
    }
  }

  // interests
  if (!Array.isArray(obj.interests)) throw new Error('interests must be an array');
  for (const [i, interest] of obj.interests.entries()) {
    const it = interest as Record<string, unknown>;
    expect(it.id, `interests[${i}].id`).toBeTypeOf('string');
    expect(it.bookId, `interests[${i}].bookId`).toBeTypeOf('string');
    expect(it.buyerId, `interests[${i}].buyerId`).toBeTypeOf('string');
    expect(isValidInterestStatus(it.status), `interests[${i}].status`).toBe(true);
    expect(it.createdAt, `interests[${i}].createdAt`).toBeTypeOf('string');
    expect(isFinite(Date.parse(it.createdAt as string)), `interests[${i}].createdAt should parse as date`).toBe(true);
  }

  // messages
  if (!Array.isArray(obj.messages)) throw new Error('messages must be an array');
  for (const [i, msg] of obj.messages.entries()) {
    const m = msg as Record<string, unknown>;
    expect(m.id, `messages[${i}].id`).toBeTypeOf('string');
    expect(m.bookId, `messages[${i}].bookId`).toBeTypeOf('string');
    expect(m.fromUserId, `messages[${i}].fromUserId`).toBeTypeOf('string');
    expect(m.content, `messages[${i}].content`).toBeTypeOf('string');
    expect(m.createdAt, `messages[${i}].createdAt`).toBeTypeOf('string');
    expect(isFinite(Date.parse(m.createdAt as string)), `messages[${i}].createdAt should parse as date`).toBe(true);
  }

  // evaluations
  if (!Array.isArray(obj.evaluations)) throw new Error('evaluations must be an array');
  for (const [i, ev] of obj.evaluations.entries()) {
    const e = ev as Record<string, unknown>;
    expect(e.id, `evaluations[${i}].id`).toBeTypeOf('string');
    expect(e.bookId, `evaluations[${i}].bookId`).toBeTypeOf('string');
    expect(e.fromUserId, `evaluations[${i}].fromUserId`).toBeTypeOf('string');
    expect(e.toUserId, `evaluations[${i}].toUserId`).toBeTypeOf('string');
    expect(e.rating, `evaluations[${i}].rating`).toBeTypeOf('number');
    expect(Number.isInteger(e.rating)).toBe(true);
    const rating = e.rating as number;
    expect(rating >= 1 && rating <= 5, `evaluations[${i}].rating should be 1-5`).toBe(true);
    expect(['buyer', 'seller'].includes(e.fromRole as string), `evaluations[${i}].fromRole`).toBe(true);
    expect(Array.isArray(e.tags), `evaluations[${i}].tags must be array`).toBe(true);
    expect(e.createdAt, `evaluations[${i}].createdAt`).toBeTypeOf('string');
    expect(isFinite(Date.parse(e.createdAt as string)), `evaluations[${i}].createdAt should parse as date`).toBe(true);
  }

  // reports
  if (!Array.isArray(obj.reports)) throw new Error('reports must be an array');
  for (const [i, rp] of obj.reports.entries()) {
    const r = rp as Record<string, unknown>;
    expect(r.id, `reports[${i}].id`).toBeTypeOf('string');
    expect(r.targetType, `reports[${i}].targetType`).toBeTypeOf('string');
    expect(r.targetId, `reports[${i}].targetId`).toBeTypeOf('string');
    expect(r.reporterId, `reports[${i}].reporterId`).toBeTypeOf('string');
    expect(r.reason, `reports[${i}].reason`).toBeTypeOf('string');
    expect(['pending', 'reviewing', 'resolved', 'rejected'].includes(r.status as string), `reports[${i}].status`).toBe(true);
    expect(r.createdAt, `reports[${i}].createdAt`).toBeTypeOf('string');
    expect(isFinite(Date.parse(r.createdAt as string)), `reports[${i}].createdAt should parse as date`).toBe(true);
  }
}

// --- Tests ---

import { seedData } from '../mockData';

describe('data format validation', () => {
  it('validates complete seedData matches AppData shape', () => {
    expect(() => validateAppData(seedData)).not.toThrow();
  });

  it('rejects non-object input', () => {
    expect(() => validateAppData(null)).toThrow('AppData must be an object');
    expect(() => validateAppData(42)).toThrow('AppData must be an object');
    expect(() => validateAppData('hello')).toThrow('AppData must be an object');
  });

  it('rejects missing arrays', () => {
    expect(() => validateAppData({})).toThrow('users must be an array');
    expect(() => validateAppData({ users: [] })).toThrow('books must be an array');
  });

  it('enforces book priceCents is a non-negative finite number', () => {
    const badBook = { ...seedData.books[0], priceCents: -100 };
    const badData = { ...seedData, books: [badBook] };
    expect(() => validateAppData(badData)).toThrow('>= 0');
  });

  it('enforces book quantity is a positive integer', () => {
    const badBook = { ...seedData.books[0], quantity: 0 };
    const badData = { ...seedData, books: [badBook] };
    expect(() => validateAppData(badData)).toThrow('>= 1');
  });

  it('enforces rating range 1-5 for evaluations', () => {
    const badEval = { ...seedData.evaluations[0], rating: 0 };
    const badData = { ...seedData, evaluations: [badEval] };
    expect(() => validateAppData(badData)).toThrow('1-5');
  });

  it('rejects invalid book category', () => {
    const badBook = { ...seedData.books[0], category: 'science' };
    expect(() => validateAppData({ ...seedData, books: [badBook] })).toThrow('category');
  });

  it('rejects invalid book status', () => {
    const badBook = { ...seedData.books[0], status: 'deleted' };
    expect(() => validateAppData({ ...seedData, books: [badBook] })).toThrow('status');
  });

  it('rejects invalid interest status', () => {
    const badInterest = { ...seedData.interests[0], status: 'expired' };
    expect(() => validateAppData({ ...seedData, interests: [badInterest] })).toThrow('status');
  });

  it('rejects invalid report status', () => {
    const badReport = {
      id: 'r1',
      targetType: 'book',
      targetId: 'b1',
      reporterId: 'u1',
      reason: 'spam',
      status: 'done',
      createdAt: new Date().toISOString(),
    };
    expect(() => validateAppData({ ...seedData, reports: [badReport] })).toThrow('status');
  });

  it('validates empty seed arrays do not throw', () => {
    const emptyData = { users: [], books: [], interests: [], messages: [], evaluations: [], reports: [] };
    expect(() => validateAppData(emptyData)).not.toThrow();
  });
});