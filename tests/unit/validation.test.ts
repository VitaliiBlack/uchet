import { describe, expect, it } from 'vitest';
import {
  isValidDateKey,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  parseMoney,
  parsePositiveInt,
  sanitizeText,
} from '@/lib/validation';

describe('validation', () => {
  it('normalizes email to trimmed lowercase', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
    expect(normalizeEmail(undefined)).toBe('');
  });

  it('validates emails', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('x'.repeat(250) + '@b.co')).toBe(false);
  });

  it('enforces password length policy', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('x'.repeat(201))).toBe(false);
  });

  it('parses positive integers only', () => {
    expect(parsePositiveInt('5')).toBe(5);
    expect(parsePositiveInt(5)).toBe(5);
    expect(parsePositiveInt('0')).toBeNull();
    expect(parsePositiveInt('-1')).toBeNull();
    expect(parsePositiveInt('5 OR 1=1')).toBeNull();
    expect(parsePositiveInt('abc')).toBeNull();
    expect(parsePositiveInt('')).toBeNull();
    expect(parsePositiveInt(null)).toBeNull();
  });

  it('validates YYYY-MM-DD date keys', () => {
    expect(isValidDateKey('2026-09-20')).toBe(true);
    expect(isValidDateKey('2026-9-2')).toBe(false);
    expect(isValidDateKey('20-09-2026')).toBe(false);
    expect(isValidDateKey('nope')).toBe(false);
    expect(isValidDateKey(123)).toBe(false);
  });

  it('parses money with parseFloat semantics', () => {
    expect(parseMoney('1500.50')).toBeCloseTo(1500.5);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('abc')).toBe(0);
    expect(parseMoney('12abc')).toBeCloseTo(12);
    expect(parseMoney(null)).toBe(0);
    expect(parseMoney('-3.5')).toBeCloseTo(-3.5);
  });

  it('sanitizes text and bounds length', () => {
    expect(sanitizeText('hello')).toBe('hello');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(123 as unknown)).toBe('');
    expect(sanitizeText('abcdef', 3)).toBe('abc');
  });
});
