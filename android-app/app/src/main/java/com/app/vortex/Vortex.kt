package com.app.vortex

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

@Composable
fun Vortex(modifier: Modifier = Modifier) {
    var hasPermission by remember {
        mutableStateOf(checkStoragePermission())
    }

    val settingsLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) {
        hasPermission = checkStoragePermission()
    }

    if (hasPermission) {
        FullScreenWebView(modifier = modifier)
    } else {
        RequestFileSystemPermission(modifier = modifier, settingsLauncher = settingsLauncher)
    }
}
