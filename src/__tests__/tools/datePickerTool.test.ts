/**
 * datePickerTool tests.
 *
 * Covers: local-date parsing (no off-by-one west of UTC), date-time strings,
 * invalid dates, handler fallbacks, element not found, non-date elements.
 */

import {
  createDatePickerTool,
  parseLocalDate,
} from '../../tools/datePickerTool';
import type { ToolContext } from '../../tools/types';

jest.mock('../../core/FiberTreeWalker', () => ({
  walkFiberTree: jest.fn(),
}));

import { walkFiberTree } from '../../core/FiberTreeWalker';
const mockWalkFiberTree = walkFiberTree as jest.MockedFunction<
  typeof walkFiberTree
>;

function createMockContext(): ToolContext {
  return {
    getRootRef: () => ({}),
    getWalkConfig: () => ({}),
    getCurrentScreenName: () => 'Booking',
  };
}

function mockElements(elements: any[]) {
  mockWalkFiberTree.mockReturnValue({
    elementsText: '',
    interactives: elements,
  } as any);
}

describe('datePickerTool', () => {
  // Run in a timezone west of UTC: this is where `new Date('YYYY-MM-DD')`
  // lands on the previous calendar day.
  const originalTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseLocalDate', () => {
    it('parses a date-only string as that LOCAL calendar day', () => {
      const d = parseLocalDate('2025-03-25');
      expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([
        2025, 3, 25,
      ]);
      expect(d.getHours()).toBe(0);
    });

    it('keeps date-time strings as local time', () => {
      const d = parseLocalDate('2025-03-25T14:30:00');
      expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([25, 14, 30]);
    });

    it('respects an explicit UTC offset', () => {
      const d = parseLocalDate('2025-03-25T00:00:00Z');
      expect(d.toISOString()).toBe('2025-03-25T00:00:00.000Z');
    });

    it('rejects impossible calendar dates instead of rolling over', () => {
      expect(isNaN(parseLocalDate('2025-02-30').getTime())).toBe(true);
      expect(isNaN(parseLocalDate('not a date').getTime())).toBe(true);
    });
  });

  it('calls onChange with the requested local day', async () => {
    const onChange = jest.fn();
    mockElements([
      {
        index: 0,
        type: 'pressable',
        label: 'Check-in',
        props: { onChange },
        fiberNode: {},
      },
    ]);

    const result = await createDatePickerTool(createMockContext()).execute({
      index: 0,
      date: '2025-03-25',
    });

    expect(result).toContain('✅');
    const [event, date] = onChange.mock.calls[0];
    expect(event.type).toBe('set');
    expect(event.nativeEvent.timestamp).toBe(date.getTime());
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([
      2025, 3, 25,
    ]);
  });

  it('falls back to onDateChange / onConfirm handlers', async () => {
    const onConfirm = jest.fn();
    mockElements([
      {
        index: 0,
        type: 'pressable',
        label: 'When',
        props: { onConfirm },
        fiberNode: {},
      },
    ]);

    await createDatePickerTool(createMockContext()).execute({
      index: 0,
      date: '2025-12-01',
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('returns an error for an invalid date without calling the handler', async () => {
    const onChange = jest.fn();
    mockElements([
      {
        index: 0,
        type: 'pressable',
        label: 'Date',
        props: { onChange },
        fiberNode: {},
      },
    ]);

    const result = await createDatePickerTool(createMockContext()).execute({
      index: 0,
      date: '2025-02-30',
    });

    expect(result).toContain('❌');
    expect(result).toContain('Invalid date');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('returns an error when the element is not a date picker', async () => {
    mockElements([
      {
        index: 0,
        type: 'pressable',
        label: 'Button',
        props: { onPress: jest.fn() },
        fiberNode: {},
      },
    ]);

    const result = await createDatePickerTool(createMockContext()).execute({
      index: 0,
      date: '2025-03-25',
    });

    expect(result).toContain('not a date picker');
  });

  it('returns an error when the index does not exist', async () => {
    mockElements([]);

    const result = await createDatePickerTool(createMockContext()).execute({
      index: 3,
      date: '2025-03-25',
    });

    expect(result).toContain('not found');
  });
});
