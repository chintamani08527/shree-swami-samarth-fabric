import { describe, it, expect } from 'vitest';
import { loginUser } from '../src/services/auth.service.js';

describe('Authentication & Access Control', () => {
  it('should authenticate admin with valid credentials', async () => {
    const res = await loginUser('vinayak4501', 'swami@4501');

    expect(res).toBeDefined();
    expect(res.token).toBeDefined();
    expect(res.user.role).toBe('ADMIN');
    expect(res.user.workerId).toBe('VINAYAK4501');
    expect(res.user.name).toContain('Vinayak Ginde');
  });

  it('should authenticate worker with valid Worker ID and PIN (case-insensitive)', async () => {
    // lowercase worker ID
    const res = await loginUser('ssf-101', '1001');

    expect(res).toBeDefined();
    expect(res.token).toBeDefined();
    expect(res.user.role).toBe('WORKER');
    expect(res.user.workerId).toBe('SSF-101');
    expect(res.user.name).toBe('Pandurang Shinde');
    expect(res.user.department?.name).toBe('Weaving');
  });

  it('should reject login with incorrect PIN', async () => {
    await expect(loginUser('SSF-101', '9999')).rejects.toThrow('Invalid Worker ID or Password/PIN');
  });

  it('should reject login for non-existent Worker ID', async () => {
    await expect(loginUser('SSF-999', '1234')).rejects.toThrow('Invalid Worker ID or Password/PIN');
  });
});
