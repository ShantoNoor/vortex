package com.app.vortex

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.app.vortex.ui.theme.VortexTheme
import androidx.core.graphics.toColorInt
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : ComponentActivity() {
    private var isReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        splashScreen.setKeepOnScreenCondition { !isReady }

        setContent {
            VortexTheme {
                Scaffold(modifier = Modifier.fillMaxSize()
                    .background(Color("#222222".toColorInt()))
                ) { innerPadding ->
                    Vortex(
                        modifier = Modifier.padding(innerPadding),
                        onReady = { isReady = true }
                    )
                }
            }
        }
    }
}







