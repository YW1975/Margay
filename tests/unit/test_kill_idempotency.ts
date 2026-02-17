/**
 * Kill Idempotency Pattern Test
 *
 * Validates the doKill() guard pattern used in AcpAgentManager.kill()
 * and GeminiAgentManager.kill(). Both use the same pattern:
 *   let killed = false;
 *   const doKill = () => { if (killed) return; killed = true; ... super.kill(); };
 *
 * Since AcpAgentManager/GeminiAgentManager extend ForkTask (spawns real
 * child processes), we test the pattern in isolation to verify:
 *   1. super.kill() is called exactly once
 *   2. Multiple doKill() invocations are idempotent
 *   3. The hard timeout fires if stop() hangs
 *   4. Errors in stop() are caught (not swallowed silently)
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('Kill Idempotency Pattern', () => {
  /** Drain the microtask queue so promise chains can settle. */
  async function flushMicrotasks(ticks = 10) {
    for (let i = 0; i < ticks; i++) await Promise.resolve();
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Simulate the exact kill() pattern from AcpAgentManager / GeminiAgentManager.
   * Returns tracking objects so tests can assert call counts and timing.
   */
  function createKillSimulation(opts: { gracePeriodMs: number; hardTimeoutMs: number; stopFn?: () => Promise<void> }) {
    const superKillSpy = jest.fn();
    const warnSpy = jest.fn();
    let killed = false;

    const doKill = () => {
      if (killed) return;
      killed = true;
      clearTimeout(hardTimer);
      superKillSpy();
    };

    const hardTimer = setTimeout(doKill, opts.hardTimeoutMs);

    const stopFn = opts.stopFn || (() => Promise.resolve());
    void stopFn()
      .catch((err: unknown) => {
        warnSpy(err);
      })
      .then(() => new Promise<void>((r) => setTimeout(r, opts.gracePeriodMs)))
      .finally(doKill);

    return { superKillSpy, warnSpy, doKill, isKilled: () => killed };
  }

  it('calls super.kill() exactly once on normal stop()', async () => {
    const { superKillSpy } = createKillSimulation({
      gracePeriodMs: 500,
      hardTimeoutMs: 1500,
    });

    // Drain microtask queue: stopFn resolve → .catch passthrough → .then creates setTimeout
    await flushMicrotasks();
    // Advance past grace period setTimeout
    jest.advanceTimersByTime(500);
    // Drain: inner promise resolves → .finally(doKill) runs
    await flushMicrotasks();

    expect(superKillSpy).toHaveBeenCalledTimes(1);

    // Advance past hard timeout — should NOT call again (already killed)
    jest.advanceTimersByTime(1500);
    expect(superKillSpy).toHaveBeenCalledTimes(1);
  });

  it('hard timeout fires if stop() hangs', async () => {
    // stop() that never resolves
    const neverResolve = () => new Promise<void>(() => {});
    const { superKillSpy } = createKillSimulation({
      gracePeriodMs: 300,
      hardTimeoutMs: 1000,
      stopFn: neverResolve,
    });

    // Before hard timeout — should not have killed yet
    jest.advanceTimersByTime(999);
    expect(superKillSpy).toHaveBeenCalledTimes(0);

    // At hard timeout — should fire
    jest.advanceTimersByTime(1);
    expect(superKillSpy).toHaveBeenCalledTimes(1);
  });

  it('stop() error is caught and logged, not swallowed', async () => {
    const testError = new Error('stop failed');
    const { superKillSpy, warnSpy } = createKillSimulation({
      gracePeriodMs: 500,
      hardTimeoutMs: 1500,
      stopFn: () => Promise.reject(testError),
    });

    // Drain: reject → .catch(warnSpy) → .then creates setTimeout
    await flushMicrotasks();

    expect(warnSpy).toHaveBeenCalledWith(testError);

    // Grace period setTimeout
    jest.advanceTimersByTime(500);
    // Drain: inner promise resolves → .finally(doKill)
    await flushMicrotasks();

    // super.kill() should still be called after error recovery
    expect(superKillSpy).toHaveBeenCalledTimes(1);
  });

  it('doKill called multiple times only triggers super.kill() once', () => {
    const { superKillSpy, doKill } = createKillSimulation({
      gracePeriodMs: 500,
      hardTimeoutMs: 1500,
    });

    // Force call doKill multiple times
    doKill();
    doKill();
    doKill();

    expect(superKillSpy).toHaveBeenCalledTimes(1);
  });

  it('ACP timing: 500ms grace, 1500ms hard timeout', async () => {
    const { superKillSpy } = createKillSimulation({
      gracePeriodMs: 500,
      hardTimeoutMs: 1500,
    });

    // Drain: stopFn resolve → .catch → .then creates setTimeout
    await flushMicrotasks();

    // Before grace period ends — still waiting
    jest.advanceTimersByTime(499);
    await flushMicrotasks();
    expect(superKillSpy).toHaveBeenCalledTimes(0);

    // At grace period — doKill fires via .finally
    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(superKillSpy).toHaveBeenCalledTimes(1);
  });

  it('Gemini timing: 300ms grace, 1000ms hard timeout', async () => {
    const neverResolve = () => new Promise<void>(() => {});
    const { superKillSpy } = createKillSimulation({
      gracePeriodMs: 300,
      hardTimeoutMs: 1000,
      stopFn: neverResolve,
    });

    // Before hard timeout
    jest.advanceTimersByTime(999);
    expect(superKillSpy).toHaveBeenCalledTimes(0);

    // At hard timeout
    jest.advanceTimersByTime(1);
    expect(superKillSpy).toHaveBeenCalledTimes(1);
  });
});
