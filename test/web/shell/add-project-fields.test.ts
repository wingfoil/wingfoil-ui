// Field checks of the Add project dialog (decision W4-13): the folder path filled and absolute
// (`/`, `~`, `~/…`, a drive letter, UNC), the URL filled and not starting with `-`, the working
// directory filled and absolute. No scheme check: git and the server judge the URL.
import { describe, expect, it } from 'vitest';
import { directoryProblem, pathProblem, urlProblem } from '../../../web/src/shell/add-project-fields.js';

describe('pathProblem', () => {
  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['relative/dir', 'relative'],
    ['./x', 'relative'],
    ['~user/x', 'relative'],
    ['/tmp/does-not-exist', undefined],
    ['  /tmp/x  ', undefined],
    ['~', undefined],
    ['~/projects/kanban', undefined],
    ['C:\\work\\kanban', undefined],
    ['C:/work/kanban', undefined],
    ['\\\\server\\share\\kanban', undefined],
  ])('%j → %s', (value, problem) => {
    expect(pathProblem(value)).toBe(problem);
  });
});

describe('urlProblem', () => {
  it.each([
    ['', 'required'],
    ['  ', 'required'],
    ['--upload-pack=x', 'option'],
    [' -x', 'option'],
    ['file:///srv/remotes/kanban.git', undefined],
    ['git@github.com:acme/kanban.git', undefined],
    ['https://git.invalid/team/project.git', undefined],
    ['kanban.git', undefined],
  ])('%j → %s', (value, problem) => {
    expect(urlProblem(value)).toBe(problem);
  });
});

describe('directoryProblem', () => {
  it.each([
    ['', 'required'],
    ['projects/x', 'relative'],
    ['~/work/kanban-copy', undefined],
    ['/srv/x', undefined],
  ])('%j → %s', (value, problem) => {
    expect(directoryProblem(value)).toBe(problem);
  });
});
