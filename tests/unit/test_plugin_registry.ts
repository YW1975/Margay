/**
 * Plugin Registry Test
 *
 * Tests the descriptor-based plugin registry (src/channels/core/registry.ts).
 * Uses jest.isolateModules to get fresh registry state between tests.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import type { IPluginDescriptor } from '@/channels/types';

/** Helper to create a minimal mock descriptor */
function mockDescriptor(overrides?: Partial<IPluginDescriptor>): IPluginDescriptor {
  return {
    type: 'test-platform',
    displayName: 'Test Platform',
    description: 'A test platform',
    connectionModes: ['polling'],
    defaultConnectionMode: 'polling',
    credentialFields: [{ key: 'token', label: 'Token', required: true, secret: true }],
    testConnection: jest.fn<IPluginDescriptor['testConnection']>().mockResolvedValue({
      success: true,
      botUsername: 'testbot',
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pluginConstructor: class {} as any,
    ...overrides,
  };
}

describe('Plugin Registry', () => {
  // Fresh registry module for each test
  let registerDescriptor: typeof import('@/channels/core/registry').registerDescriptor;
  let getPluginDescriptors: typeof import('@/channels/core/registry').getPluginDescriptors;
  let getDescriptor: typeof import('@/channels/core/registry').getDescriptor;
  let hasValidCredentials: typeof import('@/channels/core/registry').hasValidCredentials;

  beforeEach(() => {
    // Mock descriptor requires so initPluginRegistry() doesn't load real plugins
    jest.mock('../../src/channels/plugins/telegram/descriptor', () => {});
    jest.mock('../../src/channels/plugins/lark/descriptor', () => {});
    jest.mock('../../src/channels/plugins/discord/descriptor', () => {});

    // Isolate to get fresh module-level state (registry Map + initialized flag)
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/channels/core/registry');
      registerDescriptor = mod.registerDescriptor;
      getPluginDescriptors = mod.getPluginDescriptors;
      getDescriptor = mod.getDescriptor;
      hasValidCredentials = mod.hasValidCredentials;
    });
  });

  describe('registerDescriptor', () => {
    it('registers a descriptor that can be retrieved', () => {
      const desc = mockDescriptor({ type: 'telegram' });
      registerDescriptor(desc);

      const result = getDescriptor('telegram');
      expect(result).toBeDefined();
      expect(result!.type).toBe('telegram');
      expect(result!.displayName).toBe('Test Platform');
    });

    it('overwrites existing descriptor with same type', () => {
      registerDescriptor(mockDescriptor({ type: 'lark', displayName: 'Lark v1' }));
      registerDescriptor(mockDescriptor({ type: 'lark', displayName: 'Lark v2' }));

      const result = getDescriptor('lark');
      expect(result!.displayName).toBe('Lark v2');
    });
  });

  describe('getPluginDescriptors', () => {
    it('returns empty array when no descriptors registered', () => {
      const descriptors = getPluginDescriptors();
      expect(descriptors).toEqual([]);
    });

    it('returns all registered descriptors', () => {
      registerDescriptor(mockDescriptor({ type: 'telegram' }));
      registerDescriptor(mockDescriptor({ type: 'lark' }));
      registerDescriptor(mockDescriptor({ type: 'discord' }));

      const descriptors = getPluginDescriptors();
      expect(descriptors).toHaveLength(3);
      const types = descriptors.map((d) => d.type).sort();
      expect(types).toEqual(['discord', 'lark', 'telegram']);
    });

    it('returns a copy (mutations do not affect registry)', () => {
      registerDescriptor(mockDescriptor({ type: 'telegram' }));
      const list1 = getPluginDescriptors();
      list1.push(mockDescriptor({ type: 'fake' }));

      const list2 = getPluginDescriptors();
      expect(list2).toHaveLength(1);
    });
  });

  describe('getDescriptor', () => {
    it('returns undefined for unregistered type', () => {
      expect(getDescriptor('nonexistent')).toBeUndefined();
    });
  });

  describe('hasValidCredentials', () => {
    it('returns true when all required fields are present', () => {
      registerDescriptor(
        mockDescriptor({
          type: 'telegram',
          credentialFields: [{ key: 'token', label: 'Token', required: true, secret: true }],
        })
      );

      expect(hasValidCredentials('telegram', { token: 'abc123' })).toBe(true);
    });

    it('returns false when required field is missing', () => {
      registerDescriptor(
        mockDescriptor({
          type: 'telegram',
          credentialFields: [{ key: 'token', label: 'Token', required: true, secret: true }],
        })
      );

      expect(hasValidCredentials('telegram', {})).toBe(false);
    });

    it('returns false when required field is empty string', () => {
      registerDescriptor(
        mockDescriptor({
          type: 'telegram',
          credentialFields: [{ key: 'token', label: 'Token', required: true, secret: true }],
        })
      );

      expect(hasValidCredentials('telegram', { token: '  ' })).toBe(false);
    });

    it('returns false for unknown descriptor type', () => {
      expect(hasValidCredentials('unknown', { token: 'abc' })).toBe(false);
    });

    it('returns false when credentials is undefined', () => {
      registerDescriptor(mockDescriptor({ type: 'telegram' }));
      expect(hasValidCredentials('telegram', undefined)).toBe(false);
    });

    it('ignores optional fields', () => {
      registerDescriptor(
        mockDescriptor({
          type: 'lark',
          credentialFields: [
            { key: 'appId', label: 'App ID', required: true },
            { key: 'appSecret', label: 'App Secret', required: true, secret: true },
            { key: 'encryptKey', label: 'Encrypt Key', required: false, secret: true },
          ],
        })
      );

      // Only required fields present — should pass
      expect(hasValidCredentials('lark', { appId: 'id1', appSecret: 'secret1' })).toBe(true);
    });

    it('validates multiple required fields', () => {
      registerDescriptor(
        mockDescriptor({
          type: 'lark',
          credentialFields: [
            { key: 'appId', label: 'App ID', required: true },
            { key: 'appSecret', label: 'App Secret', required: true, secret: true },
          ],
        })
      );

      // Only one required field — should fail
      expect(hasValidCredentials('lark', { appId: 'id1' })).toBe(false);
      // Both present — should pass
      expect(hasValidCredentials('lark', { appId: 'id1', appSecret: 'secret1' })).toBe(true);
    });
  });
});
