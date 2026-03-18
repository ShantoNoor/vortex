package com.app.vortex

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.File

class WebAppInterface(private val webViewRef: WebView,
                      private val context: Context,
                      private val onFolderPicker: (id: Int) -> Unit
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
    fun folderPicker(id: Int) {
        onFolderPicker(id)
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

    @JavascriptInterface
    fun getImage(payloadStr: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val payload = JSONObject(payloadStr)

            val activeFolder = payload.optString("activeFolder", "")

            val idListJsonArray = payload.optJSONArray("idList") ?: JSONArray()
            val idList = mutableListOf<String>()
            for (i in 0 until idListJsonArray.length()) {
                val fileId = idListJsonArray.getString(i)
                idList.add((fileId))
            }

            val isActive = payload.optBoolean("isActive", false)

            val result = getImagesFs(idList, activeFolder, isActive)
            resolvePromise(callbackId, result)
        }
    }

    @JavascriptInterface
    fun saveImage(payloadStr: String, callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            val payload = JSONObject(payloadStr)

            val activeFolder = payload.optString("activeFolder", "")
            val fileList = payload.optJSONArray("fileList") ?: org.json.JSONArray()

            val result = addFiles(fileList, activeFolder)
            resolvePromise(callbackId, result)
        }
    }

    @JavascriptInterface
    fun clearImageCache(callbackId: Int) {
        scope.launch(Dispatchers.IO) {
            try {
                val cacheFiles = context.cacheDir.listFiles()
                cacheFiles?.forEach { file ->
                    if (file.name.startsWith("img_cache_")) {
                        file.delete()
                    }
                }
                resolvePromise(callbackId, "Cache cleared successfully")
            } catch (e: Exception) {
                resolvePromise(callbackId, "Failed to clear cache: ${e.message}")
            }
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
            val changes = DbManager.updateRecord(
                id, p.getString("element"), p.getString("tag"),
                p.getString("activeFolder"), p.getString("savePath")
            )
            val response = JSONObject()
            response.put("changes", changes)
            resolvePromise(callbackId, response)
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
    fun joinPath(pathsJsonArrStr: String, callbackId: Int) {
        scope.launch(Dispatchers.Default) {
            try {
                val arr = JSONArray(pathsJsonArrStr)
                val parts = List(arr.length()) { arr.getString(it) }

                val joined = if (parts.isEmpty()) {
                    ""
                } else {
                    // Join with separator and collapse multiple separators into one
                    parts.joinToString(File.separator)
                        .replace(Regex("${File.separator}+"), File.separator)
                }

                resolvePromise(callbackId, joined)
            } catch (e: JSONException) {
                resolvePromise(callbackId, "Invalid JSON array: ${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun relativePath(savePath: String, activeFolder: String, callbackId: Int) {
        scope.launch(Dispatchers.Default) {
            val rel = DbManager.getRelativePath(savePath, activeFolder)
            resolvePromise(callbackId, rel)
        }
    }
}
