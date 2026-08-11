package com.mclauncher.termux

import android.content.Context

/**
 * Builds and runs the same server-launch steps as the desktop app's
 * server_manager.rs, but using Termux's own package manager (pkg/apt) and
 * ARM-native binaries — Termux has real prebuilt openjdk packages for
 * Android's ARM architecture, so this sidesteps the unresolved
 * embedded-JVM problem entirely (see ANDROID_JVM.md for why that path is
 * still unverified).
 *
 * LIMITATION: RUN_COMMAND is fire-and-forget — no direct stdout back to
 * this app. The workaround: redirect output to a log file inside Termux's
 * storage and poll it, same pattern as the desktop app's log buffer.
 */
object MinecraftServerLauncher {

    private const val TERMUX_HOME = "/data/data/com.termux/files/home"
    private const val SERVERS_DIR = "$TERMUX_HOME/mc-servers"

    data class ServerConfig(
        val name: String,
        val ramMb: Int,
        val serverJarUrl: String,
    )

    private fun safeName(name: String) = name.replace(Regex("[^a-zA-Z0-9_-]"), "_")

    fun buildLaunchScript(config: ServerConfig): String {
        val dir = "$SERVERS_DIR/${safeName(config.name)}"
        val log = "$dir/launcher.log"
        return """
            set -e
            mkdir -p '$dir'
            cd '$dir'
            echo "[Launcher] Ensuring Java is installed..." >> '$log'
            command -v java >/dev/null 2>&1 || (pkg update -y && pkg install -y openjdk-17)
            if [ ! -f server.jar ]; then
              echo "[Launcher] Downloading server jar..." >> '$log'
              curl -L -o server.jar '${config.serverJarUrl}'
            fi
            echo "eula=true" > eula.txt
            echo "[Launcher] Starting server..." >> '$log'
            java -Xmx${config.ramMb}m -Xms${Math.max(128, config.ramMb / 4)}m -jar server.jar nogui >> '$log' 2>&1
        """.trimIndent()
    }

    fun start(context: Context, config: ServerConfig) {
        TermuxExecutor.runShell(context, buildLaunchScript(config), TERMUX_HOME)
    }

    fun stop(context: Context, serverName: String) {
        val safe = safeName(serverName)
        TermuxExecutor.runShell(context, "pkill -f 'mc-servers/$safe/server.jar' || true", TERMUX_HOME)
    }

    fun logFilePath(serverName: String): String = "$SERVERS_DIR/${safeName(serverName)}/launcher.log"
}
