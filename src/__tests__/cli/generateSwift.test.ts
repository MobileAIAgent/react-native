/**
 * generate-swift tests.
 *
 * Covers: App Shortcut phrase interpolation, Swift string escaping,
 * identifier sanitizing, shorthand string params, and the file-based API.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  renderSwiftCode,
  generateSwiftCode,
  escapeSwiftString,
  toSwiftIdentifier,
  toIntentStructName,
} from '../../cli/generate-swift';

describe('generate-swift', () => {
  describe('App Shortcut phrases', () => {
    it('emits a real \\(.applicationName) interpolation (single backslash)', () => {
      const swift = renderSwiftCode(
        [
          {
            name: 'track_order',
            description: 'Track an order',
            parameters: {},
          },
        ],
        'myapp'
      );

      const phraseLine = swift
        .split('\n')
        .find((l) => l.includes('AppShortcut(intent:'));

      expect(phraseLine).toBe(
        '        AppShortcut(intent: TrackOrderIntent(), phrases: ["\\(.applicationName) track order"])'
      );
      // A double backslash would be a literal "\(" in Swift and fail the
      // Xcode check that every phrase contains the application name.
      expect(phraseLine).not.toContain('\\\\(');
    });

    it('omits the shortcuts provider when there are no intents', () => {
      const swift = renderSwiftCode([], 'myapp');
      expect(swift).not.toContain('AppShortcutsProvider');
    });
  });

  describe('string escaping', () => {
    it('escapes quotes, backslashes and newlines', () => {
      expect(escapeSwiftString('Say "hi"')).toBe('Say \\"hi\\"');
      expect(escapeSwiftString('a\\b')).toBe('a\\\\b');
      expect(escapeSwiftString('line1\nline2')).toBe('line1\\nline2');
      expect(escapeSwiftString(undefined)).toBe('');
    });

    it('escapes parameter titles (previously produced invalid Swift)', () => {
      const swift = renderSwiftCode(
        [
          {
            name: 'send_note',
            description: 'Send a "quick" note',
            parameters: { note: { type: 'string', description: 'Say "hi"' } },
          },
        ],
        'myapp'
      );

      expect(swift).toContain('@Parameter(title: "Say \\"hi\\"")');
      expect(swift).toContain('IntentDescription("Send a \\"quick\\" note")');
    });
  });

  describe('identifiers', () => {
    it('backticks Swift reserved words and keeps the original query key', () => {
      const swift = renderSwiftCode(
        [
          {
            name: 'set_mode',
            description: 'Set mode',
            parameters: {
              default: { type: 'boolean', description: 'Use default' },
            },
          },
        ],
        'myapp'
      );

      expect(swift).toContain('var `default`: Bool?');
      expect(swift).toContain('if let val = `default` {');
      expect(swift).toContain('URLQueryItem(name: "default"');
    });

    it('sanitizes invalid characters and leading digits', () => {
      expect(toSwiftIdentifier('order-id')).toBe('order_id');
      expect(toSwiftIdentifier('2fa')).toBe('_2fa');
      expect(toSwiftIdentifier('amount')).toBe('amount');
    });

    it('builds PascalCase struct names from snake/kebab case', () => {
      expect(toIntentStructName('checkout_cart')).toBe('CheckoutCartIntent');
      expect(toIntentStructName('cancel-last-order')).toBe(
        'CancelLastOrderIntent'
      );
      expect(toIntentStructName('3d_view')).toBe('_3dViewIntent');
    });
  });

  describe('parameters', () => {
    it('maps types to Swift types', () => {
      const swift = renderSwiftCode(
        [
          {
            name: 'checkout_cart',
            description: 'Process checkout',
            parameters: {
              amount: { type: 'number', description: 'Total amount' },
              currency: { type: 'string', description: 'Currency code' },
              isExpress: { type: 'boolean', description: 'Express checkout' },
            },
          },
        ],
        'shop'
      );

      expect(swift).toContain('var amount: Double?');
      expect(swift).toContain('var currency: String?');
      expect(swift).toContain('var isExpress: Bool?');
      expect(swift).toContain('components.scheme = "shop"');
      expect(swift).toContain('components.path = "/checkout_cart"');
    });

    it('supports the useAction shorthand where a param is a plain string', () => {
      const swift = renderSwiftCode(
        [
          {
            name: 'search',
            description: 'Search',
            parameters: { query: 'Search text' },
          },
        ],
        'myapp'
      );

      expect(swift).toContain('@Parameter(title: "Search text")');
      expect(swift).toContain('var query: String?');
    });
  });

  it('generateSwiftCode reads a manifest file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mobileai-swift-'));
    const manifest = path.join(dir, 'intent-manifest.json');
    fs.writeFileSync(
      manifest,
      JSON.stringify([
        { name: 'open_cart', description: 'Open cart', parameters: {} },
      ])
    );

    const swift = generateSwiftCode(manifest, 'myapp');

    expect(swift).toContain('struct OpenCartIntent: AppIntent');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
