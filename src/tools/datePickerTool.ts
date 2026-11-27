/**
 * Date Picker Tool — Set date/time picker values.
 *
 * Pattern from Detox: setDatePickerDate(dateString, dateFormat)
 *
 * In JS: calls onChange(event, date) with a Date object.
 * The event parameter mimics the native event shape: { nativeEvent: { timestamp } }
 */

import { walkFiberTree } from '../core/FiberTreeWalker';
import type { AgentTool, ToolContext } from './types';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse an ISO 8601 string into a Date.
 *
 * `new Date('2025-03-25')` is parsed as UTC midnight, which is the previous
 * calendar day for anyone west of UTC (e.g. Mar 24, 8 PM in New York). Users
 * mean a local calendar day, so date-only strings are built in local time.
 * Date-time strings without an offset are already local per the ES spec.
 */
export function parseLocalDate(input: string): Date {
  const match = DATE_ONLY_RE.exec(String(input).trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    // Reject overflow like 2025-02-30 (which JS silently turns into Mar 2).
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return new Date(NaN);
    }
    return date;
  }
  return new Date(input);
}

export function createDatePickerTool(context: ToolContext): AgentTool {
  return {
    name: 'set_date',
    description: 'Set the value of a date/time picker. Provide the date in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss).',
    parameters: {
      index: { type: 'number', description: 'The index of the date picker element', required: true },
      date: { type: 'string', description: 'Date in ISO 8601 format, e.g., "2025-03-25" or "2025-03-25T14:30:00"', required: true },
    },
    execute: async (args) => {
      const { interactives: elements } = walkFiberTree(context.getRootRef(), context.getWalkConfig());
      const element = elements.find(el => el.index === args.index);
      if (!element) {
        return `❌ Element with index ${args.index} not found.`;
      }

      // Parse the date string
      const dateObj = parseLocalDate(args.date);
      if (isNaN(dateObj.getTime())) {
        return `❌ Invalid date format: "${args.date}". Use ISO 8601 format (e.g., "2025-03-25" or "2025-03-25T14:30:00").`;
      }

      // Find onChange handler (DateTimePicker's primary callback)
      const onChange = element.props.onChange || element.props.onDateChange || element.props.onConfirm;
      if (!onChange || typeof onChange !== 'function') {
        return `❌ Element [${args.index}] "${element.label}" is not a date picker (no onChange/onDateChange handler).`;
      }

      try {
        // Mimic native event shape (like DateTimePicker's native event)
        const syntheticEvent = {
          type: 'set',
          nativeEvent: {
            timestamp: dateObj.getTime(),
            utcOffset: 0,
          },
        };

        onChange(syntheticEvent, dateObj);
        await new Promise(resolve => setTimeout(resolve, 500));

        const formattedDate = dateObj.toLocaleDateString();
        return `✅ Set date picker [${args.index}] "${element.label}" to ${formattedDate}`;
      } catch (error: any) {
        return `❌ Error setting date: ${error.message}`;
      }
    },
  };
}
