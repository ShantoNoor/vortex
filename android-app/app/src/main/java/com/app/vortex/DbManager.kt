package com.app.vortex

import android.database.sqlite.SQLiteDatabase
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object DbManager {
    private var db: SQLiteDatabase? = null

    fun initDB(dbPath: String) {
        try {
            // Close existing DB if open
            db?.close()
            Log.d("DbManager", "DB Path: $dbPath")

            db = SQLiteDatabase.openOrCreateDatabase(File(dbPath), null)
            db?.rawQuery("PRAGMA journal_mode=WAL", null)?.close()
            db?.execSQL("""
                CREATE TABLE IF NOT EXISTS items (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  element TEXT NOT NULL,
                  tag TEXT NOT NULL,
                  activeFolder TEXT NOT NULL
                )
            """.trimIndent())
            Log.d("DbManager", "Init DB: $dbPath")
        } catch (e: Exception) {
            Log.e("DbManager", "Failed to init DB: ${e.message}")
        }
    }

    fun createRecord(element: String, tag: String, activeFolder: String, savePath: String): Long {
        val relative = getRelativePath(savePath, activeFolder)
        val statement = db?.compileStatement("INSERT INTO items (element, tag, activeFolder) VALUES (?, ?, ?)")
        statement?.bindString(1, element)
        statement?.bindString(2, tag)
        statement?.bindString(3, relative)
        return statement?.executeInsert() ?: -1L
    }

    fun getRecord(id: Int): JSONObject? {
        val cursor = db?.rawQuery("SELECT * FROM items WHERE id = ?", arrayOf(id.toString()))
        return cursor?.use {
            if (it.moveToFirst()) cursorRowToJson(it) else null
        }
    }

    fun getAllRecords(): JSONArray {
        val result = JSONArray()
        val cursor = db?.rawQuery("SELECT * FROM items ORDER BY tag ASC", null)
        cursor?.use {
            while (it.moveToNext()) {
                result.put(cursorRowToJson(it))
            }
        }
        return result
    }

    fun updateRecord(id: Int, element: String, tag: String, activeFolder: String, savePath: String): Int {
        val relative = getRelativePath(savePath, activeFolder)
        val statement = db?.compileStatement("UPDATE items SET element = ?, tag = ?, activeFolder = ? WHERE id = ?")
        statement?.bindString(1, element)
        statement?.bindString(2, tag)
        statement?.bindString(3, relative)
        statement?.bindLong(4, id.toLong())
        return (statement?.executeUpdateDelete() ?: 0)
    }

    fun deleteRecord(id: Int): Boolean {
        val statement = db?.compileStatement("DELETE FROM items WHERE id = ?")
        statement?.bindLong(1, id.toLong())
        return (statement?.executeUpdateDelete() ?: 0) > 0
    }

    fun getByTag(tag: String): JSONArray {
        return queryToJsonArray("SELECT * FROM items WHERE tag = ?", arrayOf(tag))
    }

    fun getByElement(element: String): JSONArray {
        return queryToJsonArray("SELECT * FROM items WHERE element = ?", arrayOf(element))
    }

    fun getByFolder(activeFolder: String, savePath: String): JSONArray {
        val relative = getRelativePath(savePath, activeFolder)
        return queryToJsonArray("SELECT * FROM items WHERE activeFolder = ? ORDER BY tag ASC", arrayOf(relative))
    }

    fun searchTagContains(text: String): JSONArray {
        val groups = parseSearchText(text)
        if (groups.isEmpty()) return JSONArray()

        val orBlocks = groups.joinToString(" OR ") { groupWords ->
            val andBlock = groupWords.joinToString(" AND ") { "LOWER(tag) LIKE ?" }
            "($andBlock)"
        }

        val flatWords = groups.flatten().toTypedArray()
        return queryToJsonArray("SELECT * FROM items WHERE $orBlocks ORDER BY LOWER(tag) ASC", flatWords)
    }

    fun searchTagInActiveFolder(text: String, activeFolder: String, savePath: String): JSONArray {
        val relative = getRelativePath(savePath, activeFolder)
        val groups = parseSearchText(text)
        if (groups.isEmpty()) return JSONArray()

        val orBlocks = groups.joinToString(" OR ") { groupWords ->
            val andBlock = groupWords.joinToString(" AND ") { "LOWER(tag) LIKE ?" }
            "($andBlock)"
        }

        val flatWords = arrayOf(relative) + groups.flatten().toTypedArray()
        return queryToJsonArray("SELECT * FROM items WHERE activeFolder = ? AND ($orBlocks) ORDER BY LOWER(tag) ASC", flatWords)
    }

    fun cleanupDeletedFolders(savePath: String) {
        val cursor = db?.rawQuery("SELECT DISTINCT activeFolder FROM items", null)
        val deleteStmt = db?.compileStatement("DELETE FROM items WHERE activeFolder = ?")

        cursor?.use {
            while (it.moveToNext()) {
                val folderName = it.getString(it.getColumnIndexOrThrow("activeFolder")) ?: continue
                val folderPath = File(savePath, folderName)
                if (!folderPath.exists()) {
                    deleteStmt?.bindString(1, folderName)
                    deleteStmt?.executeUpdateDelete()
                }
            }
        }
    }

    fun cleanupFolderElements(savePath: String, activeFolder: String, allElementIds: List<String>) {
        val relative = getRelativePath(savePath, activeFolder)
        val cursor = db?.rawQuery("SELECT DISTINCT element FROM items WHERE activeFolder = ?", arrayOf(relative))

        val deleteStmt = db?.compileStatement("DELETE FROM items WHERE activeFolder = ? AND element = ?")

        cursor?.use {
            while (it.moveToNext()) {
                val element = it.getString(it.getColumnIndexOrThrow("element"))
                if (!allElementIds.contains(element)) {
                    deleteStmt?.bindString(1, relative)
                    deleteStmt?.bindString(2, element)
                    deleteStmt?.executeUpdateDelete()
                }
            }
        }
    }

    // --- Helpers ---
    private fun parseSearchText(text: String): List<List<String>> {
        return text.split("||")
            .map { group ->
                group.trim().split("\\s+".toRegex()).map { "%${it.lowercase()}%" }
            }
            .filter { it.isNotEmpty() && it[0] != "%%" }
    }

    private fun queryToJsonArray(query: String, args: Array<String>): JSONArray {
        val result = JSONArray()
        db?.rawQuery(query, args)?.use {
            while (it.moveToNext()) result.put(cursorRowToJson(it))
        }
        return result
    }

    private fun cursorRowToJson(cursor: android.database.Cursor): JSONObject {
        val obj = JSONObject()
        for (i in 0 until cursor.columnCount) {
            val colName = cursor.getColumnName(i)
            when (cursor.getType(i)) {
                android.database.Cursor.FIELD_TYPE_INTEGER -> obj.put(colName, cursor.getLong(i))
                android.database.Cursor.FIELD_TYPE_FLOAT -> obj.put(colName, cursor.getDouble(i))
                android.database.Cursor.FIELD_TYPE_STRING -> obj.put(colName, cursor.getString(i))
                android.database.Cursor.FIELD_TYPE_NULL -> obj.put(colName, JSONObject.NULL)
            }
        }
        return obj
    }

    fun getRelativePath(base: String, target: String): String {
        val baseFile = File(base)
        val targetFile = File(target)
        return targetFile.toRelativeString(baseFile)
    }
}