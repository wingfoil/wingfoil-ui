/**
 * The WingFoil version as the progress texts show it (task-065 D65-6; T-15.1 "needs WingFoil 0.3"):
 * a release version whose patch is zero loses it ("0.3.0" → "0.3"); any other version — a patch, a
 * pre-release, a text that is not a version — is shown as written. Display only: nothing compares
 * versions here (the server decides the reason, spec-001 §6).
 */
export function majorMinor(version: string): string {
  const m = /^(\d+)\.(\d+)\.0$/.exec(version);
  return m ? `${m[1]}.${m[2]}` : version;
}
