package com.app.vortex

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Handler
import android.os.Looper
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

    val folderPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree()
    ) { uri: Uri? ->
        if (uri == null) {
            // User canceled
            webViewRef?.evaluateJavascript("window.onFolderSelected({ success: false, canceled: true })", null)
            return@rememberLauncherForActivityResult
        }

        // Convert SAF Uri to absolute File path (Requires MANAGE_EXTERNAL_STORAGE)
        val folderPath = getPathFromUri(uri)

        if (folderPath != null) {
            val resultObj = getFilesfs(folderPath)
            webViewRef?.evaluateJavascript("window.onFolderSelected($resultObj)", null)
        } else {
            webViewRef?.evaluateJavascript("window.onFolderSelected({ success: false, error: 'Could not resolve path' })", null)
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
                    context = ctx,
                    onTriggerPicker = {
                        Handler(Looper.getMainLooper()).post {
                            folderPickerLauncher.launch(null)
                        }
                    }
                )

                addJavascriptInterface(jsInterface, "api")

                loadUrl("file:///android_asset/index.html")
            }
        }
    )
}