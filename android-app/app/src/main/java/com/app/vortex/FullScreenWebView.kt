package com.app.vortex

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
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
import java.io.File

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun FullScreenWebView(modifier: Modifier = Modifier) {
    val context = LocalContext.current

    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    // File upload handling
    var fileUploadCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    // For single file selection (e.g., <input type="file"> without "multiple")
    val singleImageLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        fileUploadCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        fileUploadCallback = null
    }
    // For multiple file selection (e.g., <input type="file" multiple>)
    val multipleImagesLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        fileUploadCallback?.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
        fileUploadCallback = null
    }

    var currentFolderId by remember { mutableStateOf<Int?>(null) }
    val folderPickerLauncher = rememberLauncherForActivityResult(
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

        // Convert SAF Uri to absolute File path (Requires MANAGE_EXTERNAL_STORAGE)
        val folderPath = getPathFromUri(uri)

        if (folderPath != null) {
            val folder = File(folderPath)
            val contents = folder.listFiles()

            if (contents == null) {
                // Unable to list contents (permission issue?)
                webViewRef?.evaluateJavascript("window.resolvePromise($id, { success: false, error: 'Cannot read folder contents' })", null)
                return@rememberLauncherForActivityResult
            }

            webViewRef?.evaluateJavascript("window.resolvePromise($id, { success: true, path: '$folderPath', isEmpty: ${contents.isEmpty()} })", null)
        } else {
            webViewRef?.evaluateJavascript("window.resolvePromise($id, { success: false, error: 'Could not resolve path' })", null)
        }
    }

    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = { ctx ->
            WebView(ctx).apply {
                webViewRef = this

                webViewClient = object : WebViewClient() {
                    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                        Log.e("WebView", "Error: ${error.description} for ${request.url}")
                    }
                }

                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                        Log.d("WebView", "${message.message()} -- line ${message.lineNumber()} from ${message.sourceId()}")
                        return true
                    }

                    override fun onShowFileChooser(
                        webView: WebView?,
                        filePathCallback: ValueCallback<Array<Uri>>?,
                        fileChooserParams: FileChooserParams?
                    ): Boolean {
                        fileUploadCallback = filePathCallback

                        // Get the accept types from the input element (e.g., "image/*", ".svg", etc.)
                        val acceptTypes = fileChooserParams?.acceptTypes ?: arrayOf("*/*")

                        // Convert any file extensions or invalid strings to a proper MIME type
                        val validMimeType = acceptTypes.firstOrNull { it.contains('/') } ?: "*/*"

                        val mode = fileChooserParams?.mode ?: FileChooserParams.MODE_OPEN

                        if (mode == FileChooserParams.MODE_OPEN_MULTIPLE) {
                            multipleImagesLauncher.launch(validMimeType)
                        } else {
                            singleImageLauncher.launch(validMimeType)
                        }
                        return true
                    }

                    override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
                        AlertDialog.Builder(context)
                            .setTitle("Alert")
                            .setMessage(message)
                            .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                            .setOnCancelListener { result.cancel() }
                            .show()
                        return true
                    }

                    override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                        AlertDialog.Builder(context)
                            .setTitle("Confirm")
                            .setMessage(message)
                            .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                            .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                            .setOnCancelListener { result.cancel() }
                            .show()
                        return true
                    }

                    override fun onJsPrompt(
                        view: WebView,
                        url: String,
                        message: String,
                        defaultValue: String,
                        result: JsPromptResult
                    ): Boolean {
                        val input = EditText(context).apply { setText(defaultValue) }
                        AlertDialog.Builder(context)
                            .setTitle("Prompt")
                            .setMessage(message)
                            .setView(input)
                            .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm(input.text.toString()) }
                            .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                            .setOnCancelListener { result.cancel() }
                            .show()
                        return true
                    }
                }

                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true

                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )

                val jsInterface = WebAppInterface(
                    webViewRef = this,
                    context = ctx,
                    onFolderPicker = { id ->
                        currentFolderId = id
                        Handler(Looper.getMainLooper()).post {
                            folderPickerLauncher.launch(null)
                        }
                    }
                )

                addJavascriptInterface(jsInterface, "android")

                loadUrl("file:///android_asset/index.html")
            }
        }
    )
}