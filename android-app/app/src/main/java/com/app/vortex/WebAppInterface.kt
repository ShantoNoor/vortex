package com.app.vortex

import android.content.Context
import android.os.Environment
import android.webkit.JavascriptInterface
import android.widget.Toast
import org.json.JSONObject
import java.io.File

class WebAppInterface(private val context: Context, private val onTriggerPicker: () -> Unit) {
    @JavascriptInterface
    fun toast(message: String) {
        Toast.makeText(context, message + "\n" + Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun saveHelloToFile() {
        try {
            // Get Downloads directory
            val downloadsDir =
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)

            val file = File(downloadsDir, "hello.txt")

            // Write "hello" to file
            file.writeText("hello")

            Toast.makeText(context, "File saved: ${file.absolutePath}", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    @JavascriptInterface
    fun selectFolder() {
        onTriggerPicker()
    }

    @JavascriptInterface
    fun getFiles(folderPath: String): String {
        return getFilesfs(folderPath).toString()
    }
}
