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
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.graphics.toColorInt
import java.io.File
import java.io.FileOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.LaunchedEffect
import android.webkit.MimeTypeMap
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun FullScreenWebView(modifier: Modifier = Modifier, onReady: () -> Unit) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    // Cleans up old cached images every time the WebView loads
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            try {
                val cacheFiles = context.cacheDir.listFiles()
                cacheFiles?.forEach { file ->
                    // Only delete files we specifically created for the image picker
                    if (file.name.startsWith("img_cache_")) {
                        file.delete()
                    }
                }
            } catch (e: Exception) {
                Log.e("WebView", "Failed to clear image cache: ${e.message}")
            }
        }
    }

    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    // File upload handling
    var fileUploadCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    // Helper function to safely copy URIs to the app's cache directory
    suspend fun copyUrisToCache(uris: List<Uri>): Array<Uri> {
        return withContext(Dispatchers.IO) {
            uris.mapNotNull { uri ->
                try {
                    val contentResolver = context.contentResolver
                    val inputStream = contentResolver.openInputStream(uri) ?: return@mapNotNull null

                    // 1. Get the actual MIME type (e.g., "image/jpeg") and find its extension
                    val mimeType = contentResolver.getType(uri)
                    val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "jpg" // default to jpg if unknown

                    // 2. Append the extension to the file name
                    val fileName = "img_cache_${System.currentTimeMillis()}.$extension"
                    val tempFile = File(context.cacheDir, fileName)

                    FileOutputStream(tempFile).use { outputStream ->
                        inputStream.copyTo(outputStream)
                    }
                    inputStream.close()

                    Uri.fromFile(tempFile) // Return the permanent local file:// URI
                } catch (e: Exception) {
                    Log.e("WebView", "Failed to copy file to cache: ${e.message}")
                    null
                }
            }.toTypedArray()
        }
    }

    // For single file selection
    val singleImageLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        fileUploadCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        fileUploadCallback = null
    }

    // For multiple file selection
    val multipleImagesLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        if (uris.isNotEmpty()) {
            coroutineScope.launch {
                val cachedUris = copyUrisToCache(uris)
                fileUploadCallback?.onReceiveValue(cachedUris)
                fileUploadCallback = null
            }
        } else {
            fileUploadCallback?.onReceiveValue(null)
            fileUploadCallback = null
        }
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
        modifier = modifier.fillMaxSize().background(Color("#222222".toColorInt())),
        factory = { ctx ->
            WebView(ctx).apply {
                webViewRef = this

                val assetLoader = WebViewAssetLoader.Builder()
                    .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
                    .build()

                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest
                    ): WebResourceResponse? {
                        val url = request.url.toString()

                        if (url == "https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.10.0/dist/pdfium.wasm") {
                            return try {
                                val inputStream = ctx.assets.open("external/pdfium.wasm")

                                // Define the headers required to satisfy the CORS policy
                                val responseHeaders = mapOf(
                                    "Access-Control-Allow-Origin" to "*",
                                    "Access-Control-Allow-Methods" to "GET, OPTIONS",
                                    "Access-Control-Allow-Headers" to "*"
                                )

                                // WebResourceResponse(mimeType, encoding, statusCode, reasonPhrase, responseHeaders, data)
                                WebResourceResponse(
                                    "application/wasm",
                                    null, // Encoding
                                    200,  // Status Code
                                    "OK", // Reason Phrase
                                    responseHeaders,
                                    inputStream
                                )
                            } catch (e: Exception) {
                                Log.e("WebView", "Error loading local WASM: ${e.message}")
                                null
                            }
                        }

                        return assetLoader.shouldInterceptRequest(request.url)
                    }

                    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                        Log.e("WebView", "Error: ${error.description} for ${request.url}")
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)

                        Handler(Looper.getMainLooper()).postDelayed({
                            onReady()
                        }, 300)
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
                settings.allowFileAccess = true

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

                loadUrl("https://appassets.androidplatform.net/assets/index.html")
            }
        }
    )
}