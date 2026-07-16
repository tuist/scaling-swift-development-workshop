#!/usr/bin/env bash
set -euo pipefail

# Regenerates app/RockyFeed.xcodeproj from maintainer/rockyfeed.project.yml.
#
# Participants never run this. The workshop hands them a plain, checked-in Xcode
# project on purpose — see the header of rockyfeed.project.yml for why.
#
# The spec is copied into app/ only for the duration of generation, so that no
# generator manifest is ever left sitting next to the sample project.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/app"
SPEC_SRC="${ROOT_DIR}/maintainer/rockyfeed.project.yml"
SPEC_TMP="${APP_DIR}/project.yml"

cleanup() {
  rm -f "${SPEC_TMP}"
}
trap cleanup EXIT

cp "${SPEC_SRC}" "${SPEC_TMP}"

echo "==> Generating RockyFeed.xcodeproj"
(
  cd "${APP_DIR}"
  mise x aqua:yonaskolb/XcodeGen@2.46.0 -- xcodegen generate --spec project.yml
)

echo "==> Done. app/RockyFeed.xcodeproj is regenerated and the spec was removed."
