import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STORAGE } from '../../src/shared/config.js';
import type { ExtensionMessage, ExtensionResponse } from '../../src/shared/types.js';
import { buildRedirectUrl } from '../../src/shared/rules.js';

// Exercise each background's public messages, persistent storage, and navigation rules.
for (const browser of ['chrome', 'firefox'] as const) {
  describe(`${browser} alternative pages`, () => {
    afterEach(() => vi.unstubAllGlobals());

    it('persists destinations, redirects blocked visits, and restores ordinary blocking', async () => {
      vi.resetModules();
      let stored = JSON.parse(JSON.stringify(DEFAULT_STORAGE));
      let listener: (message: ExtensionMessage, sender: object, respond: (response: ExtensionResponse<any>) => void) => void;
      let beforeRequest: (details: { url: string }) => { redirectUrl: string } | undefined;
      let dynamicRules: any[] = [];
      const event = () => ({ addListener: vi.fn() });
      const api = {
        runtime: {
          id: 'test-extension', getURL: (path: string) => `extension://test/${path}`,
          onMessage: { addListener: (handler: typeof listener) => { listener = handler; } },
          onInstalled: event(), onStartup: event(),
        },
        storage: {
          local: {
            get: async () => ({ config: structuredClone(stored) }),
            set: async (value: { config: unknown }) => { stored = structuredClone(value.config); },
          },
          onChanged: event(),
        },
        declarativeNetRequest: {
          RuleActionType: { REDIRECT: 'redirect' }, ResourceType: { MAIN_FRAME: 'main_frame' },
          updateEnabledRulesets: async () => {},
          updateDynamicRules: async ({ addRules }: { addRules: any[] }) => { dynamicRules = addRules; },
        },
        webRequest: { onBeforeRequest: { addListener: (handler: typeof beforeRequest) => { beforeRequest = handler; } } },
        webNavigation: { onHistoryStateUpdated: event() },
        tabs: { update: vi.fn() },
      };
      vi.stubGlobal('chrome', api);
      if (browser === 'chrome') await import('../../src/mv3/background.js');
      else await import('../../src/mv2/background.js');
      const message = (request: ExtensionMessage) => new Promise<ExtensionResponse<any>>(resolve => listener(request, {}, resolve));
      const update = async (platformId: string, kind: string, fields: object) => {
        expect((await message({ type: 'UPDATE_CONFIG', payload: { kind, platformId, ...fields } })).success).toBe(true);
      };
      // Navigation targets on otherwise soft-blocked feeds must reach Firefox's request handler.
      for (const [platformId, source, target] of [
        ['youtube', 'https://www.youtube.com/', '/feed/subscriptions'],
        ['youtube', 'https://www.youtube.com/', 'blocked'],
        ['linkedin', 'https://www.linkedin.com/feed/', '/messaging/'],
      ]) {
        await update(platformId, 'platform-enabled', { enabled: true });
        await update(platformId, 'platform-redirect-target', { redirectTarget: target });
        expect((await message({ type: 'CHECK_URL', payload: source })).data).toMatchObject({ shouldBlock: true, mode: 'hard', redirectUrl: target });
        expect((await message({ type: 'SYNC_CONFIG' })).success).toBe(true);
        if (browser === 'firefox') {
          expect(beforeRequest!({ url: source })?.redirectUrl).toBe(buildRedirectUrl(source, target));
        }
      }
      await update('linkedin', 'platform-enabled', { enabled: false });
      for (const [platformId, blocked, allowed] of [
        ['twitter', 'https://x.com/home', 'https://x.com/messages'],
        ['reddit', 'https://www.reddit.com/r/popular/', 'https://www.reddit.com/r/science/'],
        ['youtube', 'https://www.youtube.com/', 'https://www.youtube.com/watch?v=abc'],
        ['tiktok', 'https://www.tiktok.com/@someone/video/123', null],
      ]) {
        const destination = 'https://example.com/read?topic=science#today';
        await update(platformId!, 'platform-redirect-target', { redirectTarget: 'custom' });
        await update(platformId!, 'platform-custom-settings', { customSettings: { alternativeUrl: destination } });
        expect((await message({ type: 'GET_CONFIG' })).data.platforms[platformId!].customSettings.alternativeUrl).toBe(destination);
        expect((await message({ type: 'CHECK_URL', payload: blocked })).data).toMatchObject({ shouldBlock: true, mode: 'hard', redirectUrl: destination });
        if (allowed) expect((await message({ type: 'CHECK_URL', payload: allowed })).data.shouldBlock).toBe(false);
        if (browser === 'chrome') {
          const matches = dynamicRules.filter(rule => new RegExp(rule.condition.regexFilter).test(blocked!));
          expect(matches.some(rule => rule.priority === 2 && rule.action.redirect.url === destination)).toBe(true);
          if (allowed) expect(dynamicRules.some(rule => new RegExp(rule.condition.regexFilter).test(allowed))).toBe(false);
        } else {
          expect(beforeRequest!({ url: blocked! })?.redirectUrl).toBe(destination);
        }
        await update(platformId!, 'platform-custom-settings', { customSettings: { alternativeUrl: 'https://x.com/home' } });
        expect((await message({ type: 'CHECK_URL', payload: blocked })).data.redirectUrl).toBe('blocked');
        await update(platformId!, 'platform-redirect-target', { redirectTarget: 'blocked' });
        expect((await message({ type: 'CHECK_URL', payload: blocked })).data.redirectUrl).toBe('blocked');
        await update(platformId!, 'platform-enabled', { enabled: false });
        expect((await message({ type: 'CHECK_URL', payload: blocked })).data.shouldBlock).toBe(false);
      }
      expect(buildRedirectUrl('https://x.com/', 'https://example.com/read')).toBe('https://example.com/read');
    });
  });
}
