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

fun saveFileFs(activeFolder: String, elements: JSONArray, appState: JSONObject, fileList: JSONArray): JSONObject {
    val response = JSONObject()
    try {
        val activeFolderFile = File(activeFolder)
        val folderName = activeFolderFile.name
        val filePath = File(activeFolderFile, "$folderName.json")

        appState.put("name", folderName)

        val fileContent = JSONObject().apply {
            put("elements", elements)
            put("appState", appState)
        }

        filePath.writeText(fileContent.toString(2))
//        addFiles(fileList, activeFolder)

        response.put("success", true)
        response.put("activeFolder", activeFolder)
    } catch (e: Exception) {
        response.put("success", false)
        response.put("error", e.message)
    }
    return response
}

fun openFileFs(activeFolder: String, savePath: String, isActive: Boolean): JSONObject {
    val response = JSONObject()
    try {
        val activeFolderFile = File(activeFolder)
        val folderName = activeFolderFile.name
        val filePath = File(activeFolderFile, "$folderName.json")

        val fileContent = filePath.readText()
        val data = JSONObject(fileContent)

        val allElements = data.optJSONArray("elements") ?: JSONArray()
        val appState = data.optJSONObject("appState") ?: JSONObject()

        val elements = JSONArray()
        val allElementIds = mutableListOf<String>()
        val idList = mutableListOf<String>()

        for (i in 0 until allElements.length()) {
            val el = allElements.getJSONObject(i)
            if (!el.optBoolean("isDeleted", false)) {
                elements.put(el)
                allElementIds.add(el.optString("id"))

                if (el.optString("type") == "image") {
                    idList.add(el.optString("fileId"))
                }
            }
        }

        DbManager.cleanupFolderElements(savePath, activeFolder, allElementIds)
        deleteUnwantedImages(idList, activeFolder, isActive)

        response.put("success", true)
        response.put("elements", elements)
        response.put("appState", appState)
        response.put("files", JSONArray())
        response.put("idList", JSONArray(idList))

    } catch (e: Exception) {
        response.put("success", false)
        response.put("error", e.message)
    }
    return response
}

fun addFiles(fileList: JSONArray, activeFolder: String): JSONObject {
    val response = JSONObject()

    val imagesDir = File(activeFolder, "images")
    if (!imagesDir.exists()) imagesDir.mkdirs()

    for (i in 0 until fileList.length()) {
        try {
            val fileObj = fileList.getJSONObject(i)
            val fileId = fileObj.getString("id")
            val imageFile = File(imagesDir, "$fileId.json")
            imageFile.writeText(fileObj.toString(2))
        } catch (e: Exception) {
            e.printStackTrace()
            response.put("success", false)
            response.put("error", e.message)
            return response
        }
    }

    response.put("success", true)
    return response
}

fun deleteUnwantedImages(idList: List<String>, activeFolder: String, isActive: Boolean) {
    val imagesDir = File(activeFolder, "images")
    val allowedFiles = idList.map { "$it.json" }

    if (!isActive) {
        if (imagesDir.exists() && imagesDir.isDirectory) {
            imagesDir.listFiles()?.forEach { file ->
                if (!allowedFiles.contains(file.name)) {
                    file.delete()
                }
            }
        }
    }
}
fun getImagesFs(idList: List<String>, activeFolder: String, isActive: Boolean): JSONArray {
    val imagesDir = File(activeFolder, "images")
    val results = JSONArray()

    for (fileId in idList) {
        try {
            val file = File(imagesDir, "$fileId.json")
            if (file.exists()) {
                results.put(JSONObject(file.readText()))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    return results
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