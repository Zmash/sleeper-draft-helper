import { describe, expect, it, vi } from 'vitest';
import { createTapCounter, EGG_TAP_COUNT, EGG_TAP_WINDOW_MS } from './easterEgg.js';

describe('createTapCounter (Football Easter Egg)', () => {
  it(`loest nach ${EGG_TAP_COUNT} schnellen Taps aus`, () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const onTrigger = vi.fn();
    const tap = createTapCounter(EGG_TAP_COUNT, EGG_TAP_WINDOW_MS, onTrigger);

    for (let i = 0; i < EGG_TAP_COUNT - 1; i++) {
      tap();
      expect(onTrigger).not.toHaveBeenCalled();
      vi.setSystemTime(Date.now() + 200);
    }
    tap();
    expect(onTrigger).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('loest nicht aus, wenn die Taps zu weit auseinander liegen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const onTrigger = vi.fn();
    const tap = createTapCounter(EGG_TAP_COUNT, EGG_TAP_WINDOW_MS, onTrigger);

    for (let i = 0; i < EGG_TAP_COUNT; i++) {
      tap();
      vi.setSystemTime(Date.now() + EGG_TAP_WINDOW_MS);
    }
    expect(onTrigger).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('setzt den Zaeher nach dem Ausloesen zurueck', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const onTrigger = vi.fn();
    const tap = createTapCounter(EGG_TAP_COUNT, EGG_TAP_WINDOW_MS, onTrigger);

    for (let i = 0; i < EGG_TAP_COUNT; i++) tap();
    expect(onTrigger).toHaveBeenCalledTimes(1);
    tap();
    expect(onTrigger).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
