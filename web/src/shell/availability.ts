/**
 * The reason of an unavailable project as the select argument of the catalogue messages that name
 * it (`projects.switcher.unavailable`, `projects.add.addedUnavailable`).
 */
import type { ProjectListItem } from '@wingfoil-ui/contracts';

/** Availability → `reason` argument. */
export const AVAILABILITY_REASONS: Readonly<Record<Exclude<ProjectListItem['availability'], 'ok'>, string>> = {
  'folder-not-found': 'folderNotFound',
  'not-wingfoil': 'notWingfoil',
  'cli-not-found': 'cliNotFound',
};
