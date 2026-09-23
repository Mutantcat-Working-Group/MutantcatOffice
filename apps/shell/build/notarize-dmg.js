// electron-builder afterAllArtifactBuild: finish the dmg after electron-builder
// produces it. Two modes:
//
//   1. GENOFFICE_MAC_ADHOC=1 — sign the dmg with the ad-hoc identity ("-"),
//      which electron-builder's dmg step deliberately does not do (it only
//      picks real certificate identities). This is the GitHub Release CI
//      path: it publishes without Apple Developer credentials.
//
//   2. Default — notarize + staple the dmg itself (the .app inside was
//      already notarized before the dmg was built).
//
// Credentials, in priority order:
//   1. APPLE_KEYCHAIN_PROFILE                    — local builds (dist:mac)
//   2. APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD +
//      APPLE_TEAM_ID                             — release CI secrets
// With neither present the step is skipped, which is the normal path for
// contributor builds: `npm run dist:mac` then yields an unsigned dmg.
const { execFileSync } = require('child_process')

exports.default = function (result) {
  if (process.platform !== 'darwin') return []
  if (process.env.GENOFFICE_MAC_ADHOC === '1') {
    for (const file of result.artifactPaths.filter((p) => p.endsWith('.dmg'))) {
      execFileSync('codesign', ['--force', '--sign', '-', file], { stdio: 'inherit' })
    }
    return []
  }
  const { APPLE_KEYCHAIN_PROFILE, APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } =
    process.env
  let credArgs
  if (APPLE_KEYCHAIN_PROFILE) {
    credArgs = ['--keychain-profile', APPLE_KEYCHAIN_PROFILE]
  } else if (APPLE_ID && APPLE_APP_SPECIFIC_PASSWORD && APPLE_TEAM_ID) {
    credArgs = [
      '--apple-id', APPLE_ID,
      '--password', APPLE_APP_SPECIFIC_PASSWORD,
      '--team-id', APPLE_TEAM_ID
    ]
  } else {
    console.warn('[notarize] no Apple credentials in the environment — dmg left un-notarized')
    return []
  }
  for (const file of result.artifactPaths.filter((p) => p.endsWith('.dmg'))) {
    execFileSync('xcrun', ['notarytool', 'submit', file, ...credArgs, '--wait'], {
      stdio: 'inherit'
    })
    execFileSync('xcrun', ['stapler', 'staple', file], { stdio: 'inherit' })
  }
  return []
}
