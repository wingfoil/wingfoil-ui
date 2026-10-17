// The root `prepublishOnly` (task-029 D29-8): `wingfoil-ui` is published only by the publish
// pipeline, `.github/workflows/publish.yml` — its gate packs the tarball once, its stage job smokes
// it on a local registry and its promote job stages THAT tarball on npm (`npm stage publish
// <tarball>`, which runs no lifecycle script); the approver makes it live with `npm stage approve`.
// An `npm publish` run from a checkout would skip every gate, so it is refused here, before npm
// packs or sends anything. See docs/publishing.md.
process.stderr.write(
  'wingfoil-ui is published only by .github/workflows/publish.yml (a pushed v* tag, staged on npm, ' +
    'approved by the approver with 2FA); npm publish from a checkout is refused. See docs/publishing.md.\n',
);
process.exit(1);
