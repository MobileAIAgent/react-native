/**
 * pickerTool tests.
 *
 * Covers: items/options/children option sources, label vs value matching,
 * non-string values from the LLM, unknown values, and non-picker elements.
 */

import { createPickerTool } from '../../tools/pickerTool';
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
    getCurrentScreenName: () => 'Checkout',
  };
}

function mockPicker(props: Record<string, any>, fiberNode: any = {}) {
  mockWalkFiberTree.mockReturnValue({
    elementsText: '',
    interactives: [
      { index: 0, type: 'picker', label: 'Quantity', props, fiberNode },
    ],
  } as any);
}

describe('pickerTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects by value from an items prop', async () => {
    const onValueChange = jest.fn();
    mockPicker({
      onValueChange,
      items: [
        { label: 'Small', value: 's' },
        { label: 'Large', value: 'l' },
      ],
    });

    const result = await createPickerTool(createMockContext()).execute({
      index: 0,
      value: 'l',
    });

    expect(onValueChange).toHaveBeenCalledWith('l', 1);
    expect(result).toContain('✅');
    expect(result).toContain('Large');
  });

  it('selects by label case-insensitively', async () => {
    const onValueChange = jest.fn();
    mockPicker({
      onValueChange,
      items: [
        { label: 'Small', value: 's' },
        { label: 'Large', value: 'l' },
      ],
    });

    await createPickerTool(createMockContext()).execute({
      index: 0,
      value: 'LARGE',
    });

    expect(onValueChange).toHaveBeenCalledWith('l', 1);
  });

  it('accepts a numeric value instead of throwing', async () => {
    const onValueChange = jest.fn();
    mockPicker({
      onValueChange,
      items: [
        { label: 'One', value: 1 },
        { label: 'Two', value: 2 },
      ],
    });

    const result = await createPickerTool(createMockContext()).execute({
      index: 0,
      value: 2,
    });

    expect(onValueChange).toHaveBeenCalledWith(2, 1);
    expect(result).toContain('✅');
  });

  it('prefers an exact value match over a label match on another option', async () => {
    const onValueChange = jest.fn();
    // Option 0's LABEL is "2", option 1's VALUE is "2".
    mockPicker({
      onValueChange,
      items: [
        { label: '2', value: 'two-label' },
        { label: 'Second', value: '2' },
      ],
    });

    await createPickerTool(createMockContext()).execute({
      index: 0,
      value: '2',
    });

    expect(onValueChange).toHaveBeenCalledWith('2', 1);
  });

  it('reads string options from an options prop', async () => {
    const onValueChange = jest.fn();
    mockPicker({ onValueChange, options: ['Red', 'Green'] });

    await createPickerTool(createMockContext()).execute({
      index: 0,
      value: 'green',
    });

    expect(onValueChange).toHaveBeenCalledWith('Green', 1);
  });

  it('reads Picker.Item children from the fiber tree', async () => {
    const onValueChange = jest.fn();
    const second = {
      memoizedProps: { label: 'Express', value: 'express' },
      sibling: null,
    };
    const first = {
      memoizedProps: { label: 'Standard', value: 'standard' },
      sibling: second,
    };
    mockPicker({ onValueChange }, { child: first });

    await createPickerTool(createMockContext()).execute({
      index: 0,
      value: 'Express',
    });

    expect(onValueChange).toHaveBeenCalledWith('express', 1);
  });

  it('lists available options when the value is unknown', async () => {
    const onValueChange = jest.fn();
    mockPicker({ onValueChange, items: [{ label: 'Small', value: 's' }] });

    const result = await createPickerTool(createMockContext()).execute({
      index: 0,
      value: 'XL',
    });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(result).toContain('❌');
    expect(result).toContain('"Small" (s)');
  });

  it('passes the value through when no options can be discovered', async () => {
    const onValueChange = jest.fn();
    mockPicker({ onValueChange });

    const result = await createPickerTool(createMockContext()).execute({
      index: 0,
      value: 'anything',
    });

    expect(onValueChange).toHaveBeenCalledWith('anything', 0);
    expect(result).toContain('✅');
  });

  it('returns an error for elements without onValueChange', async () => {
    mockPicker({ onPress: jest.fn() });

    const result = await createPickerTool(createMockContext()).execute({
      index: 0,
      value: 'x',
    });

    expect(result).toContain('not a picker');
  });
});
