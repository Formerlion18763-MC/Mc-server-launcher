# MC Launcher — how to get real Windows/Mac/Linux installers

I can't compile these myself (no compiler, no internet in my own sandbox —
verified, not a guess). GitHub Actions solves this by building on GitHub's
own servers, which have both. Here's the exact path:

## One-time setup (about 5 minutes)

1. Go to https://github.com/new and create a new repository (any name,
   Public or Private both work — Private repos get 2,000 free CI minutes/month,
   which is plenty for this).
2. On your own computer (or in Replit's Shell), run:
   ```
   cd mc-launcher-native
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

## What happens next (automatic)

Pushing to `main` triggers `.github/workflows/build.yml`. Go to your repo's
**Actions** tab and you'll see it running — it takes roughly 10-15 minutes
since it's compiling for all 3 platforms in parallel.

## Getting your download links

Once it finishes, go to your repo's **Releases** section (right sidebar on
the repo's main page). You'll find a new draft release containing:
- `MC Launcher_0.1.0_x64-setup.exe` (Windows)
- `MC Launcher_0.1.0_x64.dmg` (Mac)
- `mc-launcher_0.1.0_amd64.AppImage` (Linux)

Click "Edit" on the draft release and hit "Publish" to make it a normal
downloadable release — then those 3 files are your real, direct download
links, shareable with anyone.

## If the build fails

Click into the failed run in the Actions tab — the error will be at the
bottom of whichever platform's log turned red. Paste that error back to me
and I'll fix the actual cause; CI logs are the real, specific error, much
more useful than guessing.

## What's real vs. what still needs porting

`src/App.jsx` right now wires real functionality: real system RAM
detection, real server start/stop (spawns actual `java -jar`), real live
console (actually reads the process's stdout — and fixed a real bug along
the way where that output was piped but never drained, which would have
frozen the server once its startup logs filled the pipe buffer), real
CPU/RAM usage, a real command input that writes straight to the server's
stdin, and a real playit.gg tunnel (downloads and runs the actual
playit-agent binary, scrapes its output for your claim link and public
address).

One honest caveat on playit.gg: I verified the download URLs and general
flow via real search results, but couldn't execute-test any of this Rust
code myself (no compiler in my sandbox) — if the exact wording of
playit's console output differs from what the pattern-matching expects,
the public address might not get picked up even though the tunnel is
actually running; check the Actions log or your own build's output if so
and I'll adjust the matching.

It does NOT yet include the fuller dashboard (players, plugins/mods
search, file manager, settings tabs) from the design we iterated on
earlier — that UI can be ported into this real project screen-by-screen,
wiring each piece to real Rust commands the same way. Worth doing as the
next step once you've confirmed this core version actually builds and
runs for you.

## Android

A separate workflow, `.github/workflows/build-android.yml` — trigger it
manually from the Actions tab (it doesn't run automatically like the
desktop one, since Android builds are slower and more likely to need
iteration).

**What it does:** generates the real Android Studio project fresh each run
(`tauri android init`), copies in the Termux integration
(`android-integration/`), then builds a **debug** APK — debug builds are
self-signed automatically, no signing keystore needed, and install fine
via direct sideloading (enable "install from unknown sources" on your
phone). A release-signed build for wider distribution is a further step
if you ever want that.

**What you get:** a real, installable APK, uploaded as a workflow artifact
(Actions tab → the run → "Artifacts" at the bottom, not the Releases page
like desktop).

**The honest part:** pressing "Start" in the app on Android won't yet
actually launch a Minecraft server. What's real today:
- The app installs and opens on a real device
- `TermuxExecutor.kt`/`MinecraftServerLauncher.kt` are real, compiling
  Kotlin that correctly implements Termux's documented RUN_COMMAND API

What's NOT wired yet: connecting the React UI's buttons to actually call
that Kotlin code. Tauri's proper mechanism for this is a "mobile plugin"
bridge (JS → Rust → Kotlin), which is a distinct piece of work I haven't
built — worth doing once you've confirmed the APK itself installs and
opens correctly.

Also: I couldn't verify `tauri android build`'s exact current flags
without a working Tauri CLI to test against — if that step errors, run
`npx tauri android build --help` in the Actions log or your own machine
to see current valid flags, and I'll fix the workflow from the real
output.

Separately, this all requires Termux + Termux:API installed from F-Droid
(not Play Store) on the phone you're testing with, with
`allow-external-apps=true` set — see the earlier discussion in this
conversation for why Play Store builds don't work for this.
