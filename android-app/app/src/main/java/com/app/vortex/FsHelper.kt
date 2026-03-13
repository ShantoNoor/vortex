package com.app.vortex

import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

fun getFilesfs(folderPath: String): JSONObject {
    val response = JSONObject()
    try {
        val files = readDirRecursive(folderPath)
        response.put("success", true)
        response.put("tree", files)
        response.put("path", folderPath)
    } catch (e: Exception) {
        response.put("success", false)
        response.put("error", e.message)
    }
    return response
}

fun readDirRecursive(dirPath: String): JSONArray {
    val dir = File(dirPath)
    val result = JSONArray()

    if (!dir.exists() || !dir.isDirectory) return result

    val items = dir.listFiles() ?: return result

    for (item in items) {
        val name = item.name

        if (name.startsWith(".") || name == "images") continue

        if (item.isDirectory) {
            val children = readDirRecursive(item.absolutePath)
            val targetName = "$name.json"
            var foundTarget = false

            for (i in 0 until children.length()) {
                val child = children.optJSONObject(i)
                if (child != null && child.optString("name") == targetName) {
                    foundTarget = true
                    break
                }
            }

            if (foundTarget) {
                val obj = JSONObject()
                obj.put("name", name)
                obj.put("path", item.absolutePath)
                result.put(obj)
            } else {
                val arr = JSONArray()
                arr.put(name)
                for (i in 0 until children.length()) {
                    arr.put(children.get(i))
                }
                result.put(arr)
            }
        } else {
            if (name.endsWith(".json")) {
                val obj = JSONObject()
                obj.put("name", name)
                obj.put("path", item.absolutePath)
                result.put(obj)
            }
        }
    }
    return result
}

fun getPathFromUri(uri: Uri): String? {
    try {
        val docId = DocumentsContract.getTreeDocumentId(uri)
        val split = docId.split(":")
        val type = split[0]
        if ("primary".equals(type, ignoreCase = true)) {
            return Environment.getExternalStorageDirectory().toString() + "/" + split[1]
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
    return null
}