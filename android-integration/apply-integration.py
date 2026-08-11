#!/usr/bin/env python3
"""
Runs in CI after `tauri android init` has generated the real Android Studio
project under src-tauri/gen/android/. That folder doesn't exist in this
repo as committed source — Tauri generates it fresh each build — so this
script patches it afterward rather than us hand-editing files that won't
exist until CI creates them.

What it does:
1. Copies TermuxExecutor.kt / MinecraftServerLauncher.kt into the generated
   project's Kotlin source tree.
2. Inserts the RUN_COMMAND permission + Termux package visibility query
   into the generated AndroidManifest.xml.

Best-effort by design: Tauri's generated project layout could change
between versions. If step 2's insertion point isn't found, it prints a
clear warning rather than silently doing nothing or crashing the build —
check the Actions log if that happens.
"""
import os
import shutil
import sys

GEN_ANDROID = "src-tauri/gen/android"
KOTLIN_DEST = f"{GEN_ANDROID}/app/src/main/java/com/mclauncher/termux"
MANIFEST_PATH = f"{GEN_ANDROID}/app/src/main/AndroidManifest.xml"
INTEGRATION_DIR = "android-integration"

def main():
    if not os.path.isdir(GEN_ANDROID):
        print(f"ERROR: {GEN_ANDROID} doesn't exist — did 'tauri android init' run first?")
        sys.exit(1)

    os.makedirs(KOTLIN_DEST, exist_ok=True)
    for fname in ["TermuxExecutor.kt", "MinecraftServerLauncher.kt"]:
        src = os.path.join(INTEGRATION_DIR, fname)
        dst = os.path.join(KOTLIN_DEST, fname)
        shutil.copy(src, dst)
        print(f"Copied {fname} -> {dst}")

    if not os.path.isfile(MANIFEST_PATH):
        print(f"WARNING: {MANIFEST_PATH} not found — skipping manifest patch. "
              f"Termux permission/query won't be present; add manually if needed.")
        return

    with open(MANIFEST_PATH, "r") as f:
        manifest = f.read()

    with open(os.path.join(INTEGRATION_DIR, "manifest-additions.xml")) as f:
        additions = f.read()

    if "com.termux.permission.RUN_COMMAND" in manifest:
        print("Manifest already contains the Termux permission — skipping (already patched).")
        return

    marker = "</manifest>"
    if marker not in manifest:
        print(f"WARNING: couldn't find '{marker}' in the generated manifest — skipping patch. "
              f"Add the contents of {INTEGRATION_DIR}/manifest-additions.xml manually.")
        return

    patched = manifest.replace(marker, additions + marker)
    with open(MANIFEST_PATH, "w") as f:
        f.write(patched)
    print(f"Patched {MANIFEST_PATH} with Termux permission + package query.")

if __name__ == "__main__":
    main()
