#!/bin/bash
set -euo pipefail

# Stamps the current git commit and a timestamp into the app bundle.
#
# ⚠️ This script is a catalogue of build-phase sins, on purpose:
#
#   1. It declares no input files and no output files, so Xcode cannot reason
#      about it. It therefore runs on EVERY build — even a no-op incremental one.
#   2. It shells out to `git`, an undeclared input living outside the sandbox.
#      The build result depends on repository state Xcode never sees.
#   3. It writes into $BUILT_PRODUCTS_DIR without telling the build system, so
#      the output is invisible to dependency tracking.
#   4. It embeds a timestamp, which means two builds of identical source produce
#      different bundles. The build is not reproducible.
#
# We fix this later in the workshop.

RESOURCES_DIR="${BUILT_PRODUCTS_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
mkdir -p "${RESOURCES_DIR}"

COMMIT=$(git -C "${SRCROOT}" rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILT_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "${RESOURCES_DIR}/BuildStamp.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>commit</key>
	<string>${COMMIT}</string>
	<key>builtAt</key>
	<string>${BUILT_AT}</string>
</dict>
</plist>
PLIST

echo "note: Stamped build info (commit ${COMMIT})"
