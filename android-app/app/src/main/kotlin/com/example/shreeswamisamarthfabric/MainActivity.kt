package com.example.shreeswamisamarthfabric

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import android.provider.Settings
import android.webkit.GeolocationPermissions
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var backPressedTime: Long = 0

    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var latestLocation: Location? = null
    private var locationListener: LocationListener? = null

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        val isGranted = fineGranted || coarseGranted

        // Always invoke callback with retain=true so WebView permanently remembers permission
        try {
            pendingGeoCallback?.invoke(pendingGeoOrigin, isGranted, true)
        } catch (_: Exception) {}
        pendingGeoOrigin = null
        pendingGeoCallback = null

        if (isGranted) {
            startLocationUpdates()
            // Notify JavaScript that Android OS location permission is granted
            webView.post {
                webView.evaluateJavascript(
                    """
                    if (typeof window.onAndroidLocationPermissionGranted === 'function') {
                        window.onAndroidLocationPermissionGranted();
                    }
                    """.trimIndent(),
                    null
                )
            }
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileUploadCallback == null) return@registerForActivityResult
        val results: Array<Uri>? = if (result.resultCode == RESULT_OK) {
            val data = result.data
            if (data?.data != null) {
                arrayOf(data.data!!)
            } else if (data?.clipData != null) {
                val clipData = data.clipData!!
                Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
            } else null
        } else null
        fileUploadCallback?.onReceiveValue(results)
        fileUploadCallback = null
    }

    private val LIVE_URL = "https://shree-swami-samarth-fabric.vercel.app"
    private val OFFLINE_URL = "file:///android_asset/www/index.html"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set status bar color to deep slate brand theme
        window.statusBarColor = 0xFF0F172A.toInt()

        // Root container
        val rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(0xFF0F172A.toInt()) // Deep slate brand background
        }

        // Swipe to Refresh Layout
        swipeRefreshLayout = SwipeRefreshLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setColorSchemeColors(0xFF0284C7.toInt(), 0xFF6366F1.toInt()) // Cyan & Indigo
            setProgressBackgroundColorSchemeColor(0xFF1E293B.toInt()) // Dark slate container
            setOnRefreshListener {
                if (isOnline()) {
                    webView.reload()
                } else {
                    webView.loadUrl(OFFLINE_URL)
                    isRefreshing = false
                }
            }
        }

        // Hardware-accelerated WebView
        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            overScrollMode = View.OVER_SCROLL_NEVER
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
        }

        // Only allow pull-to-refresh when at the top of the page
        webView.viewTreeObserver.addOnScrollChangedListener {
            swipeRefreshLayout.isEnabled = (webView.scrollY == 0)
        }

        // Horizontal progress bar
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                8
            )
            max = 100
            progress = 0
            visibility = View.GONE
        }

        swipeRefreshLayout.addView(webView)
        rootLayout.addView(swipeRefreshLayout)
        rootLayout.addView(progressBar)
        setContentView(rootLayout)

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        setupWebSettings()
        setupClients()
        setupDownloadListener()
        setupBackNavigation()
        setupNetworkListener()

        // Proactively request location permissions early on startup
        checkAndRequestLocationPermission()

        loadApplication()
    }

    fun checkAndRequestLocationPermission() {
        val fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        } else {
            startLocationUpdates()
        }
    }

    @SuppressLint("MissingPermission")
    fun startLocationUpdates() {
        try {
            val fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val coarse = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (!fine && !coarse) return

            // 1. Google Play Services Fused Location Provider (Pinpoint GPS, Cell, Wi-Fi fusion)
            try {
                fusedLocationClient.lastLocation.addOnSuccessListener { loc ->
                    if (loc != null) {
                        if (latestLocation == null || loc.time >= latestLocation!!.time) {
                            latestLocation = loc
                        }
                    }
                }

                fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                    .addOnSuccessListener { loc ->
                        if (loc != null) {
                            latestLocation = loc
                        }
                    }

                if (locationCallback == null) {
                    locationCallback = object : LocationCallback() {
                        override fun onLocationResult(result: LocationResult) {
                            val loc = result.lastLocation ?: return
                            if (latestLocation == null || loc.time >= latestLocation!!.time || (loc.hasAccuracy() && loc.accuracy < (latestLocation?.accuracy ?: 999f))) {
                                latestLocation = loc
                            }
                        }
                    }
                }

                val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
                    .setMinUpdateIntervalMillis(500L)
                    .setMinUpdateDistanceMeters(0f)
                    .setWaitForAccurateLocation(true)
                    .build()

                fusedLocationClient.requestLocationUpdates(req, locationCallback!!, Looper.getMainLooper())
            } catch (e: Exception) {
                e.printStackTrace()
            }

            // 2. Native Hardware LocationManager fallback
            val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            if (lm != null) {
                val gpsLoc = try { lm.getLastKnownLocation(LocationManager.GPS_PROVIDER) } catch (_: Exception) { null }
                val netLoc = try { lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) } catch (_: Exception) { null }
                val candidates = listOfNotNull(latestLocation, gpsLoc, netLoc)
                val best = candidates.maxByOrNull { it.time }
                if (best != null) {
                    latestLocation = best
                }

                if (locationListener == null) {
                    locationListener = object : LocationListener {
                        override fun onLocationChanged(loc: Location) {
                            if (latestLocation == null || loc.time >= latestLocation!!.time || (loc.hasAccuracy() && loc.accuracy < (latestLocation?.accuracy ?: 999f))) {
                                latestLocation = loc
                            }
                        }
                        override fun onProviderEnabled(provider: String) {}
                        override fun onProviderDisabled(provider: String) {}
                        @Deprecated("Deprecated in Java")
                        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                    }
                }

                if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, locationListener!!, Looper.getMainLooper())
                }
                if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 1000L, 0f, locationListener!!, Looper.getMainLooper())
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebSettings() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            @Suppress("DEPRECATION")
            setGeolocationDatabasePath(filesDir.path)
            useWideViewPort = true
            loadWithOverviewMode = true
            allowFileAccess = true
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString = "$userAgentString SSF-Android-App/1.0"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        // Native bridge for web-app coordination
        webView.addJavascriptInterface(WebAppBridge(this), "AndroidBridge")
    }

    private fun setupClients() {
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                    swipeRefreshLayout.isRefreshing = false
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                // Always grant permission in WebView with retain=true so WebView permanently allows the origin
                callback?.invoke(origin, true, true)

                val finePermission = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                val coarsePermission = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                if (finePermission != PackageManager.PERMISSION_GRANTED && coarsePermission != PackageManager.PERMISSION_GRANTED) {
                    pendingGeoOrigin = origin
                    pendingGeoCallback = callback
                    locationPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                } else {
                    startLocationUpdates()
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                    fileUploadCallback = null
                    return false
                }
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefreshLayout.isRefreshing = false
                CookieManager.getInstance().flush()
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleUrl(url)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url == null) return false
                return handleUrl(url)
            }

            private fun handleUrl(url: String): Boolean {
                if (url.startsWith(LIVE_URL) || url.startsWith("file:///android_asset")) {
                    return false
                }
                // External links (tel, mailto, whatsapp, maps, etc.)
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                } catch (e: Exception) {
                    return false
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true && !isOnline()) {
                    webView.loadUrl(OFFLINE_URL)
                }
            }
        }
    }

    private fun setupDownloadListener() {
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                if (url.startsWith("blob:") || url.startsWith("data:")) {
                    // Blob/Data URLs cannot be fetched directly by system DownloadManager.
                    // Read the blob data directly inside WebView JavaScript and pass to AndroidBridge!
                    val effectiveMime = if (!mimeType.isNullOrBlank()) mimeType else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    val filename = URLUtil.guessFileName(url, contentDisposition, effectiveMime)
                    val js = """
                        (function() {
                            fetch('$url')
                                .then(function(res) { return res.blob(); })
                                .then(function(blob) {
                                    var reader = new FileReader();
                                    reader.onloadend = function() {
                                        var result = reader.result || '';
                                        var base64 = result.indexOf(',') !== -1 ? result.split(',')[1] : result;
                                        if (base64 && window.AndroidBridge && window.AndroidBridge.downloadBase64File) {
                                            window.AndroidBridge.downloadBase64File(base64, '$filename', '$effectiveMime');
                                        }
                                    };
                                    reader.readAsDataURL(blob);
                                })
                                .catch(function(err) {
                                    if (window.AndroidBridge && window.AndroidBridge.showToast) {
                                        window.AndroidBridge.showToast('Download error: ' + err);
                                    }
                                });
                        })();
                    """.trimIndent()
                    webView.evaluateJavascript(js, null)
                    return@setDownloadListener
                }

                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimeType)
                    addRequestHeader("User-Agent", userAgent)
                    val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
                    setDescription("Downloading $filename")
                    setTitle(filename)
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                }

                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(this, "Downloading file to Downloads folder...", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "Download failed: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    if (System.currentTimeMillis() - backPressedTime < 2000) {
                        finish()
                    } else {
                        backPressedTime = System.currentTimeMillis()
                        Toast.makeText(this@MainActivity, "Press back again to exit", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun setupNetworkListener() {
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    runOnUiThread {
                        val currentUrl = webView.url
                        if (currentUrl == null || currentUrl.startsWith("file:///android_asset")) {
                            webView.loadUrl(LIVE_URL)
                        }
                    }
                }
            })
        } catch (_: Exception) {}
    }

    private fun loadApplication() {
        if (isOnline()) {
            webView.loadUrl(LIVE_URL)
        } else {
            webView.loadUrl(OFFLINE_URL)
        }
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        CookieManager.getInstance().flush()
        startLocationUpdates()
    }

    override fun onPause() {
        webView.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onDestroy() {
        try {
            locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
            locationListener?.let {
                val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                lm?.removeUpdates(it)
            }
        } catch (_: Exception) {}
        webView.destroy()
        super.onDestroy()
    }

    // JavaScript Bridge for Web-to-App coordination
    inner class WebAppBridge(private val context: Context) {
        @JavascriptInterface
        fun showToast(message: String) {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }

        @JavascriptInterface
        fun isNativeApp(): Boolean {
            return true
        }

        @JavascriptInterface
        fun startTrackingHighAccuracyLocation() {
            runOnUiThread {
                startLocationUpdates()
            }
        }

        @JavascriptInterface
        fun hasLocationPermission(): Boolean {
            val fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val coarse = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            return fine || coarse
        }

        @JavascriptInterface
        fun requestLocationPermission() {
            runOnUiThread {
                checkAndRequestLocationPermission()
            }
        }

        @JavascriptInterface
        fun isLocationServiceEnabled(): Boolean {
            val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return false
            return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        }

        @JavascriptInterface
        fun openLocationSettings() {
            try {
                val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } catch (_: Exception) {
                try {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", packageName, null)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                } catch (_: Exception) {}
            }
        }

        @SuppressLint("MissingPermission")
        @JavascriptInterface
        fun getNativeGPSLocation(): String {
            try {
                val fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                val coarse = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                if (!fine && !coarse) {
                    return ""
                }

                val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager

                val gpsLoc = try { lm?.getLastKnownLocation(LocationManager.GPS_PROVIDER) } catch (_: Exception) { null }
                val netLoc = try { lm?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) } catch (_: Exception) { null }
                val passiveLoc = try { lm?.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER) } catch (_: Exception) { null }

                val candidates = listOfNotNull(latestLocation, gpsLoc, netLoc, passiveLoc)
                val freshCandidates = candidates.filter { (System.currentTimeMillis() - it.time) < 180000 }
                val targetList = if (freshCandidates.isNotEmpty()) freshCandidates else candidates

                val best = targetList.minByOrNull { if (it.hasAccuracy()) it.accuracy else 999f } ?: targetList.maxByOrNull { it.time }

                if (best != null) {
                    val json = JSONObject()
                    json.put("latitude", best.latitude)
                    json.put("longitude", best.longitude)
                    json.put("accuracy", if (best.hasAccuracy()) best.accuracy.toDouble() else 8.0)
                    json.put("timestamp", best.time)
                    return json.toString()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            return ""
        }

        @JavascriptInterface
        fun triggerHaptic() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    vibrator?.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
                }
            } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun downloadBase64File(base64Data: String, fileName: String, mimeType: String) {
            runOnUiThread {
                try {
                    val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                    val cleanFileName = if (fileName.isNotBlank()) fileName else "SSF_Attendance_Report.xlsx"
                    val effectiveMime = if (mimeType.isNotBlank()) mimeType else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    var savedUri: Uri? = null

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val contentValues = ContentValues().apply {
                            put(MediaStore.MediaColumns.DISPLAY_NAME, cleanFileName)
                            put(MediaStore.MediaColumns.MIME_TYPE, effectiveMime)
                            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                        }
                        val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                        if (uri != null) {
                            context.contentResolver.openOutputStream(uri)?.use { os ->
                                os.write(bytes)
                                os.flush()
                            }
                            savedUri = uri
                        }
                    } else {
                        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        if (!downloadsDir.exists()) downloadsDir.mkdirs()
                        val file = File(downloadsDir, cleanFileName)
                        file.outputStream().use { os ->
                            os.write(bytes)
                            os.flush()
                        }
                        val dm = getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
                        dm?.addCompletedDownload(
                            cleanFileName,
                            "Downloaded from Shree Swami Samarth Fabric",
                            true,
                            effectiveMime,
                            file.absolutePath,
                            bytes.size.toLong(),
                            true
                        )
                        savedUri = Uri.fromFile(file)
                    }

                    Toast.makeText(context, "✅ Excel saved to Downloads folder: $cleanFileName", Toast.LENGTH_LONG).show()

                    // Automatically attempt to prompt opening file if a viewer is available
                    savedUri?.let { fileUri ->
                        try {
                            val openIntent = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(fileUri, effectiveMime)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            val chooser = Intent.createChooser(openIntent, "Open Excel sheet with...")
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            context.startActivity(chooser)
                        } catch (_: Exception) {}
                    }
                } catch (e: Exception) {
                    Toast.makeText(context, "Failed to save Excel file: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
