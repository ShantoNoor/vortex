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

class WebAppInterface(private val webViewRef: WebView,
                      private val context: Context,
                      private val onSelectFolder: (id: Int) -> Unit
) {
    private val scope = CoroutineScope(Dispatchers.Main)

    private fun resolvePromise(callbackId: Int, data: Any) {
        scope.launch(Dispatchers.Main) {
            // Ensure data is properly formatted for JS evaluation
            val jsData = if (data is String) "\"$data\"" else data.toString()
            webViewRef.evaluateJavascript("window.resolvePromise($callbackId, $jsData)") {}
        }
    }

    @JavascriptInterface
    fun toast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    // --- FS Handlers ---

    @JavascriptInterface
    fun selectFolder(id: Int) {
        onSelectFolder(id)
    }

    @JavascriptInterface
    fun getFiles(folderPath: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val dbPath = File(folderPath, "${File(folderPath).name}.db").absolutePath
            DbManager.initDB(dbPath)
            DbManager.cleanupDeletedFolders(folderPath)

            val result = getFilesfs(folderPath)
            resolvePromise(callbackId, result)
        }
    }

    @JavascriptInterface
    fun openFile(payloadStr: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val payload = JSONObject(payloadStr)
            val activeFolder = payload.getString("activeFolder")
            val savePath = payload.getString("savePath")
            val isActive = payload.optBoolean("isActive", false)

            val result = openFileFs(activeFolder, savePath, isActive)
            resolvePromise(callbackId, result)
        }
    }

    @JavascriptInterface
    fun saveFile(payloadStr: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val payload = JSONObject(payloadStr)

            val activeFolder = payload.optString("activeFolder", "")
            val elements = payload.optJSONArray("elements") ?: org.json.JSONArray()
            val appState = payload.optJSONObject("appState") ?: JSONObject()
            val fileList = payload.optJSONArray("fileList") ?: org.json.JSONArray()

            val result = saveFileFs(activeFolder, elements, appState, fileList)
            resolvePromise(callbackId, result)
        }
    }

    // --- Database Handlers ---

    @JavascriptInterface
    fun dbCreate(payloadStr: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val p = JSONObject(payloadStr)
            val id = DbManager.createRecord(
                p.getString("element"), p.getString("tag"),
                p.getString("activeFolder"), p.getString("savePath")
            )
            resolvePromise(callbackId, id)
        }
    }

    @JavascriptInterface
    fun dbGet(id: Int, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val record = DbManager.getRecord(id)
            resolvePromise(callbackId, record ?: "null")
        }
    }

    @JavascriptInterface
    fun dbAll(callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            resolvePromise(callbackId, DbManager.getAllRecords())
        }
    }

    @JavascriptInterface
    fun dbUpdate(id: Int, payloadStr: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val p = JSONObject(payloadStr)
            val success = DbManager.updateRecord(
                id, p.getString("element"), p.getString("tag"),
                p.getString("activeFolder"), p.getString("savePath")
            )
            resolvePromise(callbackId, success)
        }
    }

    @JavascriptInterface
    fun dbDelete(id: Int, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            resolvePromise(callbackId, DbManager.deleteRecord(id))
        }
    }

    @JavascriptInterface
    fun dbGetByTag(tag: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            resolvePromise(callbackId, DbManager.getByTag(tag))
        }
    }

    @JavascriptInterface
    fun dbGetByElement(element: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            resolvePromise(callbackId, DbManager.getByElement(element))
        }
    }

    @JavascriptInterface
    fun dbGetByFolder(payloadStr: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val p = JSONObject(payloadStr)
            val res = DbManager.getByFolder(p.getString("activeFolder"), p.getString("savePath"))
            resolvePromise(callbackId, res)
        }
    }

    @JavascriptInterface
    fun dbSearchTag(text: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            resolvePromise(callbackId, DbManager.searchTagContains(text))
        }
    }

    @JavascriptInterface
    fun dbSearchTagActiveFolder(payloadStr: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val p = JSONObject(payloadStr)
            val res = DbManager.searchTagInActiveFolder(
                p.getString("text"), p.getString("activeFolder"), p.getString("savePath")
            )
            resolvePromise(callbackId, res)
        }
    }

    // --- Path Handlers ---

    @JavascriptInterface
    fun pathJoin(pathsJsonArrStr: String, callbackId: Int) {
        scope.launch(Dispatchers.Default) {
            val arr = org.json.JSONArray(pathsJsonArrStr)
            val parts = mutableListOf<String>()
            for (i in 0 until arr.length()) parts.add(arr.getString(i))

            val joined = parts.joinToString(File.separator) { it.trim(File.separatorChar) }
            resolvePromise(callbackId, joined)
        }
    }

    @JavascriptInterface
    fun pathRelative(savePath: String, activeFolder: String, callbackId: Int) {
        scope.launch(Dispatchers.Default) {
            val rel = DbManager.getRelativePath(savePath, activeFolder)
            resolvePromise(callbackId, rel)
        }
    }
}
