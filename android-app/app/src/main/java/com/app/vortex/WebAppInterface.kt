package com.app.vortex

import android.content.Context
import android.os.Environment
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

class WebAppInterface(private val webViewRef: WebView, private val context: Context, private val onSelectFolder: (id: Int) -> Unit) {
    private val scope = CoroutineScope(Dispatchers.Main)

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
    fun selectFolder(id: Int) {
        onSelectFolder(id)
    }

    @JavascriptInterface
    fun getFiles(folderPath: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val result = getFilesfs(folderPath)

            withContext(Dispatchers.Main) {
                webViewRef.evaluateJavascript("window.resolvePromise($callbackId, $result)") {}
            }
        }
    }
}
