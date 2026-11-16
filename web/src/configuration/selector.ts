/**
 * A served value as an ICU `select` key (task-064 review round 1 F-6; shared with task-079, D79-4):
 * ICU keys hold no `-`, so `when-references-done` → `whenReferencesDone`, `sw-life-cycle` →
 * `swLifeCycle`. Each `select` keeps an `other` case that shows the value as given.
 */
export function selectorOf(value: string): string {
  return value.replace(/-(\w)/g, (_m, c: string) => c.toUpperCase());
}
