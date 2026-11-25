plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "kz.zhastunulani.faceattend.kiosk"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "kz.zhastunulani.faceattend.kiosk"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
        // Әдепкі сервер; әкімші мәзірінен өзгертуге болады
        buildConfigField("String", "DEFAULT_SERVER", "\"https://face-attent.zhastunulani.kz\"")
    }

    buildTypes {
        release {
            optimization {
                enable = false
            }
            // Ішкі қолдану үшін: release-ті debug кілтімен қол қою (бір ұйымның құрылғылары)
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
}
