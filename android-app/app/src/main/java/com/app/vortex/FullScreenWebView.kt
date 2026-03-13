package com.app.vortex

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun FullScreenWebView(modifier: Modifier = Modifier) {
    val context = LocalContext.current

    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    var currentFolderId by remember { mutableStateOf<Int?>(null) }
    val selectFolderLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree()
    ) { uri: Uri? ->
        val id = currentFolderId ?: return@rememberLauncherForActivityResult
        // Clear immediately to prevent stale ID if another picker is launched
        currentFolderId = null

        if (uri == null) {
            // User canceled
            webViewRef?.evaluateJavascript("window.resolvePromise($id, { success: false, error: 'Canceled' })", null)
            return@rememberLauncherForActivityResult
        }
//
        // Convert SAF Uri to absolute File path (Requires MANAGE_EXTERNAL_STORAGE)
        val folderPath = getPathFromUri(uri)

        if (folderPath != null) {
            val resultObj = getFilesfs(folderPath)
            webViewRef?.evaluateJavascript("window.resolvePromise($id, $resultObj)", null)
        } else {
            webViewRef?.evaluateJavascript("window.resolvePromise($id, { success: false, error: 'Could not resolve path' })", null)
        }
    }

    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = { ctx ->
            WebView(ctx).apply {
                webViewRef = this

                webViewClient = WebViewClient()
                settings.javaScriptEnabled = true

                val jsInterface = WebAppInterface(
                    webViewRef = this,
                    context = ctx,
                    onSelectFolder = { id ->
                        currentFolderId = id
                        Handler(Looper.getMainLooper()).post {
                            selectFolderLauncher.launch(null)
                        }
                    }
                )

                addJavascriptInterface(jsInterface, "android")

                loadUrl("file:///android_asset/test_index.html")
            }
        }
    )
}