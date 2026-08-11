# Android JVM — status and next steps

## Why this matters
You confirmed ARM-MC lets users import real .jar files (Fabric/Paper/Spigot)
on Android, not just its Rust fallback server. That's proof a real JVM CAN
run inside an Android app's own sandbox — this document is the honest,
concrete plan to do the same here, plus exactly what's unverified.

## The plan
Same "jniLibs lib trick" from before, but applied completely this time:
not just one binary, but the full set `java` depends on.

1. Obtain a real ARM64 JVM build. Two realistic sources:
   - Termux's own prebuilt `openjdk-17` package (proven to run on Android
     today, inside Termux's sandbox)
   - Or a from-scratch Android-targeted JDK build (Azul/BellSoft "Liberica"
     publish some Android-compatible builds — worth checking their current
     lineup)
2. Extract EVERY shared library the `java` binary needs (`ldd`-equivalent
   dependency walk: libjvm.so, libjli.so, and the rest — expect 30-80+
   files depending on JDK build), not just the main binary.
3. Rename each into `src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/lib<name>.so`
   so Android's installer extracts them all with the executable bit set.
4. The unresolved risk: some of these binaries may have Termux's install
   path (`/data/data/com.termux/files/usr/...`) hardcoded as their dynamic
   linker search path (`RPATH`/`RUNPATH`). If so, `patchelf` can rewrite
   those paths to point at this app's own `nativeLibraryDir` instead —
   this is a real, standard Linux tool for exactly this problem, but I
   haven't verified it against these specific binaries since I have no
   Android device or network access in this sandbox to test on.

## What I can't verify from here
- Whether `patchelf`-rewriting Termux's JDK binaries actually works
  end-to-end on a real device — I have no way to build/run/test this in
  the current sandbox (no internet, no Android SDK, no device).
- Exact file count/names for the openjdk-17 shared library set — depends
  on the specific build.

## Honest status
`server_manager.rs`'s `resolve_java()` has the Android integration point
ready (`app_data_dir().join("bin/java")`), but the actual binaries are not
bundled yet — that's real, hands-on work on a real machine with a real
Android device to test against, following the steps above.
