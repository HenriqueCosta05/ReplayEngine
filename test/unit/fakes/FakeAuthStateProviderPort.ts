import type { UserProfile } from '../../../src/profiles/domain/UserProfile.js';
import type {
  AuthStateProviderPort,
  ResolvedAuthState,
} from '../../../src/profiles/application/ports/AuthStateProviderPort.js';

/**
 * Scriptable `AuthStateProviderPort` fake. `resolveResult` configures what
 * `resolve` returns (default `{ storageStatePath: null }`); `refreshError`,
 * when set, makes `refresh` reject with it instead of resolving. `resolveCalls`
 * / `refreshCalls` record every profile passed through, so tests can assert
 * on call shape without a real browser or file system.
 */
export class FakeAuthStateProviderPort implements AuthStateProviderPort {
  readonly resolveCalls: UserProfile[] = [];
  readonly refreshCalls: UserProfile[] = [];
  private resolveResult: ResolvedAuthState = { storageStatePath: null };
  private refreshError: Error | undefined;

  setResolveResult(result: ResolvedAuthState): void {
    this.resolveResult = result;
  }

  setRefreshError(error: Error): void {
    this.refreshError = error;
  }

  async resolve(profile: UserProfile): Promise<ResolvedAuthState> {
    this.resolveCalls.push(profile);
    return this.resolveResult;
  }

  async refresh(profile: UserProfile): Promise<void> {
    this.refreshCalls.push(profile);
    if (this.refreshError !== undefined) {
      throw this.refreshError;
    }
  }
}
