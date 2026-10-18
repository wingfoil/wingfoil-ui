// The root `prepublishOnly` (task-029 D29-8): `wingfoil-ui` is published only by the publish
// pipeline, `.github/workflows/publish.yml` — its gate packs the tarball once, its stage job smokes
// it on a local registry and its promote job stages THAT tarball on npm (`npm stage publish
// <tarball>`, which runs no lifecycle script); the approver makes it live with `npm stage approve`.
// An `npm publish` run from a checkout would skip every gate, so it stops here, before npm packs or
// sends anything. A guard against mistakes only: `npm publish --ignore-scripts` skips it. The control
// is on the registry — the trusted publisher limited to staging and "Require two-factor
// authentication and disallow tokens" (docs/publishing.md, approver checklist).
process.stderr.write(
  'wingfoil-ui is published only by .github/workflows/publish.yml (a pushed v* tag, staged on npm, ' +
    'approved by the approver with 2FA); npm publish from a checkout is refused. See docs/publishing.md.\n',
);
process.exit(1);
