# Maintainer notes

Not part of the workshop. Attendees never need anything in here.

## `app/RockyFeed.xcodeproj` is hand-maintained

It is the source of truth. There is no generator, and that is the point: the
workshop starts from a checked-in, hand-maintained Xcode project, and
*introducing* generation is something we do later, with Tuist, as an improvement.
A generator manifest sitting on trunk would give away the ending.

So: **edit the project in Xcode**, like the attendees do.

The project was originally bootstrapped with an XcodeGen spec, which was removed
once the sample was calibrated. If you ever want it back — to reshape the sample
wholesale, say — it's in git history:

```bash
git show 1102274:maintainer/rockyfeed.project.yml > app/project.yml
git show 1102274:maintainer/regenerate-sample.sh  > /tmp/regenerate-sample.sh
# ...regenerate, then delete app/project.yml again before committing.
```

Be aware it will rewrite the pbxproj wholesale and drop any hand edits made since.

## `generate-bulk-sources.mjs`

Generates the bulk of RockyFeed's design-system components, services, and feature
views. It exists because the workshop's headline metric — the god-module tax — is
invisible on a toy app: with a dozen files, changing `Core` costs about the same
as changing nothing, and the attendee learns the opposite of the lesson.

The sample is currently calibrated so that a one-line change in `Core` costs
**~11x a no-op build** (19.0s vs 1.7s on an 11-core M3 Pro), which is well clear
of noise without making anyone wait minutes per iteration.

> [!IMPORTANT]
> Now that XcodeGen is gone, this script and the project file are decoupled. It
> writes `.swift` files but **cannot** add them to `RockyFeed.xcodeproj`. If you
> add or remove any file names in its lists, you must reflect that in Xcode by
> hand, or the new files simply won't compile and the calibration won't change.
>
> Editing the *bodies* of existing generated files is safe — the file names don't
> change, so the project doesn't either.

```bash
node maintainer/generate-bulk-sources.mjs
```

After running it, re-measure before trusting any number:

```bash
mise run workshop     # → Task 1 → Measure the baseline
```
