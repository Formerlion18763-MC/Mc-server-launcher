package com.mclauncher.termux

import android.content.Context
import android.content.Intent

/**
 * Executes shell commands inside Termux from this app, using Termux's own
 * documented RUN_COMMAND intent API. Does NOT bundle or reimplement Termux
 * — the user must have the real Termux + Termux:API apps installed (from
 * F-Droid, not Play Store — Play Store builds have RUN_COMMAND disabled)
 * with "allow-external-apps=true" set, and must grant this app the
 * com.termux.permission.RUN_COMMAND permission when Android prompts for it.
 *
 * Reference: https://github.com/termux/termux-app/wiki/RUN_COMMAND-Intent
 */
object TermuxExecutor {

    private const val TERMUX_SERVICE = "com.termux.app.RunCommandService"
    private const val ACTION_RUN_COMMAND = "com.termux.RUN_COMMAND"

    fun isTermuxInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo("com.termux", 0)
            true
        } catch (e: Exception) {
            false
        }
    }

    fun runCommand(
        context: Context,
        executable: String,
        arguments: Array<String>,
        workDir: String,
        background: Boolean = true,
    ) {
        val intent = Intent()
        intent.setClassName("com.termux", TERMUX_SERVICE)
        intent.action = ACTION_RUN_COMMAND
        intent.putExtra("com.termux.RUN_COMMAND_PATH", executable)
        intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", arguments)
        intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", workDir)
        intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", background)
        intent.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "0")
        context.startForegroundService(intent)
    }

    fun runShell(context: Context, shellCommand: String, workDir: String) {
        runCommand(
            context = context,
            executable = "/data/data/com.termux/files/usr/bin/bash",
            arguments = arrayOf("-c", shellCommand),
            workDir = workDir,
        )
    }
}
