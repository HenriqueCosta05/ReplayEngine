import type { Locator as PlaywrightLocator, Page } from 'playwright';

import type { Locator } from '../../domain/Locator.js';

/** Playwright's own ARIA role union, taken from the signature rather than re-declared. */
type AriaRole = Parameters<Page['getByRole']>[0];

/**
 * Turns a domain `Locator` into a live Playwright locator on `page`.
 *
 * Pure in the sense that matters: it only *builds* a locator handle, it never
 * queries the DOM, so it performs no I/O and can be reasoned about (and
 * asserted on) without a page load.
 *
 * `options.exact` is passed to every strategy that accepts it; `options.name`
 * only to `getByRole`, the sole factory with an accessible-name filter (the
 * mapper already rejects `name` on any other strategy, so an out-of-band
 * value cannot silently disappear here). `options.nth` is applied last, as a
 * refinement of whatever the strategy matched - `-1` addresses the last match,
 * which is how `CodegenActionMapper` encodes a recorded `.last()`.
 */
export function resolveLocator(page: Page, locator: Locator): PlaywrightLocator {
  const { strategy, value, options } = locator;
  const exactOption = options?.exact !== undefined ? { exact: options.exact } : {};

  let resolved: PlaywrightLocator;
  switch (strategy) {
    case 'role':
      resolved = page.getByRole(value as AriaRole, {
        ...exactOption,
        ...(options?.name !== undefined ? { name: options.name } : {}),
      });
      break;
    case 'testId':
      resolved = page.getByTestId(value);
      break;
    case 'text':
      resolved = page.getByText(value, exactOption);
      break;
    case 'label':
      resolved = page.getByLabel(value, exactOption);
      break;
    case 'placeholder':
      resolved = page.getByPlaceholder(value, exactOption);
      break;
    case 'altText':
      resolved = page.getByAltText(value, exactOption);
      break;
    case 'title':
      resolved = page.getByTitle(value, exactOption);
      break;
    case 'css':
      resolved = page.locator(value);
      break;
    default: {
      // Compile-time exhaustiveness: adding a ninth `LocatorStrategy` without
      // handling it here is a type error, not a runtime surprise.
      const exhaustive: never = strategy;
      throw new Error(`Unsupported locator strategy: ${String(exhaustive)}`);
    }
  }

  return options?.nth !== undefined ? resolved.nth(options.nth) : resolved;
}
