#!/bin/bash
set -euo pipefail

# Stamps the current git commit into the app bundle.
#
# This script used to be a catalogue of build-phase sins. What changed:
#
#   1. It declared no inputs and no outputs, so Xcode could not reason about it
#      and ran it on EVERY build — including no-op ones. The manifest now declares
#      both, and drops `basedOnDependencyAnalysis: false`, which had been
#      explicitly telling Xcode not to think.
#
#   2. It read git state that the build system could not see. It still does, but
#      the manifest now names .git/HEAD as an input, so a commit change is a
#      reason to re-run and nothing else is.
#
#   3. It wrote into BUILT_PRODUCTS_DIR without declaring it. The output is now
#      declared, so dependency tracking knows the file exists and who made it.
#
#   4. It embedded a timestamp. Two builds of identical source produced different
#      bundles, forever, by design — which breaks the one sentence every cache in
#      this workshop depends on: same inputs, same output. The clock is gone.
#
# If you want to know when a build ran, ask whatever scheduled it. That is a fact
# about the run, not about the source, and it has no business in the artefact.

RESOURCES_DIR="${BUILT_PRODUCTS_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
mkdir -p "${RESOURCES_DIR}"

COMMIT=$(git -C "${SRCROOT}" rev-parse --short HEAD 2>/dev/null || echo "unknown")

cat > "${RESOURCES_DIR}/BuildStamp.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>commit</key>
	<string>${COMMIT}</string>
</dict>
</plist>
PLIST

echo "note: Stamped build info (commit ${COMMIT})"
