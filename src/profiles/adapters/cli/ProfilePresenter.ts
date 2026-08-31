import pc from 'picocolors';

import { renderTable } from '../../../shared-kernel/adapters/renderTable.js';
import type { UserProfile } from '../../domain/UserProfile.js';

const LIST_HEADERS = ['ID', 'NAME', 'AUTH TYPE', 'CREATED AT', 'LAST REFRESHED'] as const;

function authStrategyDetailLines(profile: UserProfile): string[] {
  const { authStrategy } = profile;
  switch (authStrategy.type) {
    case 'none':
      return [];
    case 'storageState':
      return [`  File path: ${authStrategy.filePath}`];
    case 'loginJourney':
      return [
        `  Login journey id: ${authStrategy.journeyId}`,
        `  Storage state path: ${authStrategy.storageStatePath}`,
      ];
    default: {
      const exhaustive: never = authStrategy;
      return [`  ${String(exhaustive)}`];
    }
  }
}

/**
 * Formats `UserProfile` aggregates for the CLI: a padded plain-text table for
 * `profile list`, a detail view for `profile add`/`show`/`refresh`, and a
 * `toJson` path for `--json` mode. Mirrors `JourneyPresenter`'s shape and
 * (deliberately, at this collection's size) its self-contained table
 * rendering rather than sharing a util module with it.
 */
export class ProfilePresenter {
  /** One row per profile, for `profile list`. */
  presentList(profiles: readonly UserProfile[]): string {
    if (profiles.length === 0) {
      return 'No profiles registered yet.';
    }

    const rows = profiles.map((profile) => [
      profile.id,
      profile.name,
      profile.authStrategy.type,
      profile.createdAt.toISOString(),
      profile.authLastRefreshedAt !== undefined ? profile.authLastRefreshedAt.toISOString() : 'never',
    ]);

    return renderTable(LIST_HEADERS, rows);
  }

  /** Full detail view of one profile, for `profile add`/`show`/`refresh`. */
  present(profile: UserProfile): string {
    return [
      `${pc.bold('ID:')} ${profile.id}`,
      `${pc.bold('Name:')} ${profile.name}`,
      `${pc.bold('Auth strategy:')} ${profile.authStrategy.type}`,
      ...authStrategyDetailLines(profile),
      `${pc.bold('Created at:')} ${profile.createdAt.toISOString()}`,
      `${pc.bold('Last refreshed:')} ${
        profile.authLastRefreshedAt !== undefined ? profile.authLastRefreshedAt.toISOString() : 'never'
      }`,
    ].join('\n');
  }

  /** Machine-readable form for `--json`, accepting either a single profile or a list. */
  toJson(value: UserProfile | readonly UserProfile[]): string {
    return JSON.stringify(value, null, 2);
  }
}
