package com.vpnbrowser.ui

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
import android.net.VpnService
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import android.widget.PopupMenu
import com.vpnbrowser.R
import com.vpnbrowser.core.*
import com.vpnbrowser.service.SimpleProxyManager
import com.vpnbrowser.service.XrayVpnService
import kotlinx.coroutines.*
import java.net.URLDecoder

/**
 * Chrome风格VPN浏览器Activity
 */
class ChromeStyleActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var urlEditText: EditText
    private lateinit var backButton: Button
    private lateinit var forwardButton: Button
    private lateinit var refreshButton: Button
    private lateinit var homeButton: Button
    private lateinit var menuButton: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var securityIndicator: TextView
    private lateinit var pageTitle: TextView
    
    // 全屏视频播放相关
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var originalOrientation: Int = 0
    private var originalSystemUiVisibility: Int = 0
    
    // 新VPN系统组件
    private lateinit var nodePool: NodePool
    private lateinit var loadBalancer: LoadBalancer
    private lateinit var healthChecker: HealthChecker
    private lateinit var failoverManager: FailoverManager
    
    // 协程作用域
    private val activityScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    // VPN相关常量
    private val VPN_REQUEST_CODE = 1001
    
    // 隐藏功能相关
    private var statusClickCount = 0
    private var lastStatusClickTime = 0L
    private val CLICK_TIMEOUT = 2000L // 2秒内的点击才计数
    private val HIDDEN_CLICK_COUNT = 5 // 连续点击5次进入高级设置

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chrome_style)

        initViews()
        setupWebView()
        setupButtons()
        
        // 初始化新VPN系统
        initializeVpnSystem()
        
        // 启动VPN服务
        startVpnServiceIfNeeded()
        
        updateUI()
        
        // 加载默认页面 - 针对视频浏览优化
        loadUrl("https://www.youtube.com")
    }
    
    override fun onResume() {
        super.onResume()
        updateUI()
    }
    
    override fun onDestroy() {
        // 清理WebView
        webView.destroy()
        
        // 清理VPN系统资源
        activityScope.cancel()
        if (::healthChecker.isInitialized) {
            healthChecker.destroy()
        }
        if (::failoverManager.isInitialized) {
            failoverManager.destroy()
        }
        if (::nodePool.isInitialized) {
            nodePool.destroy()
        }
        
        super.onDestroy()
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == VPN_REQUEST_CODE) {
            if (resultCode == RESULT_OK) {
                // VPN权限获得，启动VPN服务
                startXrayVpnService()
            } else {
                // VPN权限被拒绝
                Toast.makeText(this, "需要VPN权限才能正常使用", Toast.LENGTH_LONG).show()
                // 回退到简单代理模式
                loadProxyConfig()
            }
        }
    }
    
    private fun loadProxyConfig() {
        val config = SimpleProxyManager.loadProxyConfig(this)
        config?.let {
            SimpleProxyManager.setProxyConfig(it)
        }
    }
    
    private fun toggleProxy() {
        if (SimpleProxyManager.isProxyEnabled()) {
            SimpleProxyManager.disableProxy()
            Toast.makeText(this, "代理已禁用", Toast.LENGTH_SHORT).show()
        } else {
            if (SimpleProxyManager.getCurrentProxy() != null) {
                SimpleProxyManager.enableProxy()
                Toast.makeText(this, "代理已启用", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "代理配置不可用", Toast.LENGTH_SHORT).show()
            }
        }
        updateUI()
    }

    private fun initViews() {
        webView = findViewById(R.id.webview)
        urlEditText = findViewById(R.id.url_edit_text)
        backButton = findViewById(R.id.btn_back)
        forwardButton = findViewById(R.id.btn_forward)
        refreshButton = findViewById(R.id.btn_refresh)
        homeButton = findViewById(R.id.btn_home)
        menuButton = findViewById(R.id.btn_menu)
        progressBar = findViewById(R.id.progress_bar)
        securityIndicator = findViewById(R.id.security_indicator)
        pageTitle = findViewById(R.id.page_title)
        
        // 设置状态指示器的点击和长按监听
        setupStatusIndicator()
    }
    
    /**
     * 设置状态指示器的交互功能
     */
    private fun setupStatusIndicator() {
        // 点击监听（连续点击5次进入高级设置）
        securityIndicator.setOnClickListener {
            val currentTime = System.currentTimeMillis()
            
            if (currentTime - lastStatusClickTime > CLICK_TIMEOUT) {
                statusClickCount = 1
            } else {
                statusClickCount++
            }
            
            lastStatusClickTime = currentTime
            
            if (statusClickCount >= HIDDEN_CLICK_COUNT) {
                statusClickCount = 0
                showAdvancedSettings()
            } else if (statusClickCount >= 3) {
                // 给用户提示
                Toast.makeText(this, "再点击${HIDDEN_CLICK_COUNT - statusClickCount}次进入高级设置", Toast.LENGTH_SHORT).show()
            }
        }
        
        // 长按监听（显示一键修复或状态信息）
        securityIndicator.setOnLongClickListener {
            when (securityIndicator.text.toString()) {
                "🔴" -> showOneClickFix()
                "🟡" -> showStatusInfo("正在优化连接，请稍候...")
                "🟢" -> showStatusInfo("连接正常，一切运行良好")
                else -> showStatusInfo("状态未知")
            }
            true
        }
    }
    
    /**
     * 初始化VPN系统
     */
    private fun initializeVpnSystem() {
        try {
            // 初始化组件
            nodePool = NodePool(this)
            loadBalancer = LoadBalancer()
            healthChecker = HealthChecker(this)
            
            failoverManager = FailoverManager(this, nodePool, loadBalancer, healthChecker)
            failoverManager.setCallback(object : FailoverManager.FailoverCallback {
                override fun onNodeChanged(oldNode: ProxyNode?, newNode: ProxyNode?) {
                    runOnUiThread {
                        updateUI()
                        Toast.makeText(this@ChromeStyleActivity, 
                            "已切换到: ${newNode?.name ?: "无"}", Toast.LENGTH_SHORT).show()
                    }
                }
                
                override fun onSwitchStarted(reason: String) {
                    runOnUiThread {
                        securityIndicator.text = "🟡"
                        pageTitle.text = "正在切换节点..."
                    }
                }
                
                override fun onSwitchCompleted(success: Boolean, newNode: ProxyNode?) {
                    runOnUiThread {
                        updateUI()
                        if (success) {
                            pageTitle.text = "VPN浏览器"
                        }
                    }
                }
                
                override fun onSwitchFailed(reason: String) {
                    runOnUiThread {
                        securityIndicator.text = "🔴"
                        pageTitle.text = "连接失败"
                        Toast.makeText(this@ChromeStyleActivity, 
                            "切换失败: $reason", Toast.LENGTH_SHORT).show()
                    }
                }
            })
            
            // 加载内置节点
            val builtinNodes = DefaultNodes.getBuiltinNodes()
            nodePool.addNodes(builtinNodes)
            
            Log.i("ChromeStyleActivity", "VPN系统初始化完成")
            
        } catch (e: Exception) {
            Log.e("ChromeStyleActivity", "VPN系统初始化失败", e)
            Toast.makeText(this, "VPN系统初始化失败", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * 启动VPN服务（如果需要）
     */
    private fun startVpnServiceIfNeeded() {
        if (XrayVpnService.isServiceRunning) {
            Log.i("ChromeStyleActivity", "VPN服务已在运行")
            updateUI()
            return
        }
        
        // 检查VPN权限
        val intent = VpnService.prepare(this)
        if (intent != null) {
            // 需要请求VPN权限
            startActivityForResult(intent, VPN_REQUEST_CODE)
        } else {
            // 已有VPN权限，直接启动服务
            startXrayVpnService()
        }
    }
    
    /**
     * 启动Xray VPN服务
     */
    private fun startXrayVpnService() {
        try {
            Log.i("ChromeStyleActivity", "准备启动Xray VPN服务")
            
            // 先显示加载状态
            securityIndicator.text = "🟡"
            pageTitle.text = "正在启动VPN..."
            
            val intent = Intent(this, XrayVpnService::class.java).apply {
                action = XrayVpnService.ACTION_START
            }
            
            // 使用普通的startService而不是startForegroundService
            startService(intent)
            
            // 延迟更新UI状态
            activityScope.launch {
                delay(3000) // 等待3秒让服务完全启动
                runOnUiThread {
                    updateUI()
                    pageTitle.text = "VPN浏览器"
                }
            }
            
            Log.i("ChromeStyleActivity", "Xray VPN服务启动请求已发送")
            
        } catch (e: Exception) {
            Log.e("ChromeStyleActivity", "启动VPN服务失败", e)
            runOnUiThread {
                securityIndicator.text = "🔴"
                pageTitle.text = "VPN启动失败"
                Toast.makeText(this@ChromeStyleActivity, "启动VPN服务失败: ${e.message}", Toast.LENGTH_LONG).show()
                
                // 回退到简单代理模式
                loadProxyConfig()
            }
        }
    }
    
    private fun updateUI() {
        // 更新VPN代理状态指示器
        if (XrayVpnService.isServiceRunning) {
            // 使用新VPN系统
            val currentNode = if (::failoverManager.isInitialized) {
                failoverManager.getCurrentNode()
            } else null
            
            securityIndicator.text = if (currentNode != null) "🟢" else "🟡"
            
        } else {
            // 回退到简单代理模式
            val isProxyEnabled = SimpleProxyManager.isProxyEnabled()
            securityIndicator.text = if (isProxyEnabled) "🟢" else "🔴"
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        // 启用硬件加速（重要：视频播放性能）
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = true
            displayZoomControls = false
            setSupportZoom(true)
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            
            // 视频播放优化设置
            javaScriptCanOpenWindowsAutomatically = true  // 允许弹窗（视频播放器需要）
            loadsImagesAutomatically = true
            blockNetworkImage = false
            blockNetworkLoads = false
            
            // 媒体播放设置
            mediaPlaybackRequiresUserGesture = false  // 允许自动播放
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            
            // 数据库和存储
            databaseEnabled = true
            
            // 手机版User Agent - 优化移动端网页显示
            userAgentString = "Mozilla/5.0 (Linux; Android 12; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                
                // 处理百度App协议
                if (url.startsWith("baiduboxapp://")) {
                    val realUrl = extractRealUrlFromBaiduApp(url)
                    if (realUrl != null) {
                        view?.loadUrl(realUrl)
                        return true
                    }
                }
                
                // 处理其他自定义协议
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    // 忽略非HTTP协议
                    return true
                }
                
                return false
            }
            
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                progressBar.progress = 0
                
                // 不显示当前网址，保持地址栏为空
                updateNavigationButtons()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                updateNavigationButtons()
                
                // 更新页面标题
                pageTitle.text = view?.title ?: "VPN浏览器"
                
                // 不显示当前网址，保持地址栏为空
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                progressBar.visibility = View.GONE
                
                // 如果是网络错误，尝试重定向到搜索
                val url = request?.url?.toString()
                if (url != null && error?.errorCode == WebViewClient.ERROR_HOST_LOOKUP) {
                    handleUrlError(url)
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                progressBar.progress = newProgress
                if (newProgress == 100) {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onReceivedTitle(view: WebView?, title: String?) {
                super.onReceivedTitle(view, title)
                pageTitle.text = title ?: "VPN浏览器"
            }
            
            // 全屏视频播放支持
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    onHideCustomView()
                    return
                }
                
                customView = view
                customViewCallback = callback
                
                // 保存原始状态
                originalOrientation = requestedOrientation
                originalSystemUiVisibility = window.decorView.systemUiVisibility
                
                // 设置全屏
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )
                
                // 添加自定义视图到根布局
                val rootView = findViewById<ViewGroup>(android.R.id.content)
                val params = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                rootView.addView(customView, params)
                
                // 隐藏WebView
                webView.visibility = View.GONE
            }
            
            override fun onHideCustomView() {
                if (customView == null) return
                
                // 恢复原始状态
                requestedOrientation = originalOrientation
                window.decorView.systemUiVisibility = originalSystemUiVisibility
                
                // 移除自定义视图
                val rootView = findViewById<ViewGroup>(android.R.id.content)
                rootView.removeView(customView)
                
                // 显示WebView
                webView.visibility = View.VISIBLE
                
                // 清理
                customView = null
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null
            }
            
            // 支持文件上传（某些视频网站需要）
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                // 这里可以添加文件选择逻辑，暂时返回false使用默认处理
                return false
            }
        }
    }

    private fun setupButtons() {
        backButton.setOnClickListener {
            if (webView.canGoBack()) {
                webView.goBack()
            }
        }

        forwardButton.setOnClickListener {
            if (webView.canGoForward()) {
                webView.goForward()
            }
        }

        refreshButton.setOnClickListener {
            webView.reload()
        }
        
        homeButton.setOnClickListener {
            val prefs = getSharedPreferences("app_settings", MODE_PRIVATE)
            val homepageUrl = prefs.getString("homepage_url", "https://www.youtube.com")
            loadUrl(homepageUrl ?: "https://www.youtube.com")
        }
        
        menuButton.setOnClickListener {
            showMenu()
        }

        urlEditText.setOnKeyListener { _, keyCode, event ->
            if (keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN) {
                val url = urlEditText.text.toString()
                loadUrl(url)
                // 清空地址栏输入
                urlEditText.setText("")
                return@setOnKeyListener true
            }
            false
        }
    }
    
    private fun showMenu() {
        val popup = PopupMenu(this, menuButton)
        popup.menuInflater.inflate(R.menu.simple_menu, popup.menu)
        
        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_my_account -> {
                    openMyAccount()
                    true
                }
                R.id.action_set_homepage -> {
                    setCurrentPageAsHomepage()
                    true
                }
                R.id.action_refresh_config -> {
                    refreshConfiguration()
                    true
                }
                R.id.action_reset_data -> {
                    showResetDataDialog()
                    true
                }
                else -> false
            }
        }
        
        popup.show()
    }
    
    /**
     * 打开我的账户页面
     */
    private fun openMyAccount() {
        try {
            AccountActivity.start(this)
        } catch (e: Exception) {
            Log.e("ChromeStyleActivity", "Failed to open account page", e)
            Toast.makeText(this, "无法打开账户页面", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * 设置当前页面为主页
     */
    private fun setCurrentPageAsHomepage() {
        val currentUrl = webView.url
        if (!currentUrl.isNullOrEmpty()) {
            val prefs = getSharedPreferences("app_settings", MODE_PRIVATE)
            prefs.edit().putString("homepage_url", currentUrl).apply()
            Toast.makeText(this, "已设为主页", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * 刷新配置 - 更新VPN节点和技术支持信息
     */
    private fun refreshConfiguration() {
        Toast.makeText(this, "正在刷新配置...", Toast.LENGTH_SHORT).show()
        
        activityScope.launch {
            try {
                var successCount = 0
                var errorMessages = mutableListOf<String>()
                
                // 1. 刷新技术支持信息
                val techSupportConfig = TechSupportConfig(this@ChromeStyleActivity)
                val apiService = com.vpnbrowser.api.ApiService(this@ChromeStyleActivity)
                
                val supportResult = techSupportConfig.updateFromServer(apiService)
                if (supportResult) {
                    successCount++
                    Log.i("ChromeStyleActivity", "技术支持信息刷新成功")
                } else {
                    errorMessages.add("技术支持信息刷新失败")
                }
                
                // 2. 刷新节点配置
                if (::nodePool.isInitialized) {
                    val nodeAutoFetcher = NodeAutoFetcher(this@ChromeStyleActivity)
                    val nodeResult = nodeAutoFetcher.forceRefreshNodes(apiService, nodePool, replaceExisting = false)
                    when (nodeResult) {
                        is FetchResult.Success -> {
                            successCount++
                            Log.i("ChromeStyleActivity", "节点配置刷新成功，新增${nodeResult.nodeCount}个节点")
                        }
                        is FetchResult.Error -> {
                            errorMessages.add("节点配置刷新失败: ${nodeResult.message}")
                        }
                    }
                } else {
                    errorMessages.add("节点池未初始化")
                }
                
                // 3. 显示结果
                runOnUiThread {
                    when {
                        successCount >= 2 -> {
                            Toast.makeText(this@ChromeStyleActivity, 
                                "配置刷新完成！", Toast.LENGTH_LONG).show()
                        }
                        successCount > 0 -> {
                            Toast.makeText(this@ChromeStyleActivity, 
                                "部分配置刷新成功\n${errorMessages.joinToString("\n")}", Toast.LENGTH_LONG).show()
                        }
                        else -> {
                            Toast.makeText(this@ChromeStyleActivity, 
                                "配置刷新失败\n${errorMessages.joinToString("\n")}", Toast.LENGTH_LONG).show()
                        }
                    }
                }
                
            } catch (e: Exception) {
                Log.e("ChromeStyleActivity", "刷新配置异常", e)
                runOnUiThread {
                    Toast.makeText(this@ChromeStyleActivity, 
                        "刷新配置异常: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
    
    /**
     * 显示重置数据确认对话框
     */
    private fun showResetDataDialog() {
        AlertDialog.Builder(this)
            .setTitle("🗑️ 一键重置")
            .setMessage("确定要重置所有浏览数据吗？\n\n将清理以下内容：\n• 浏览历史记录\n• 网页缓存数据\n• Cookie和登录状态\n• 本地存储数据\n• 表单数据\n\n注意：VPN节点配置和用户登录状态将保留")
            .setPositiveButton("🗑️ 确定重置") { _, _ ->
                performDataReset()
            }
            .setNegativeButton("取消", null)
            .show()
    }
    
    /**
     * 执行数据重置
     */
    private fun performDataReset() {
        Toast.makeText(this, "正在重置数据...", Toast.LENGTH_SHORT).show()
        
        activityScope.launch {
            try {
                runOnUiThread {
                    // 清理WebView数据
                    webView.clearCache(true)
                    webView.clearHistory()
                    webView.clearFormData()
                    
                    // 清理Cookie
                    val cookieManager = CookieManager.getInstance()
                    cookieManager.removeAllCookies(null)
                    cookieManager.flush()
                    
                    // 清理WebView存储
                    val webStorage = WebStorage.getInstance()
                    webStorage.deleteAllData()
                    
                    // 清理数据库
                    val webViewDatabase = WebViewDatabase.getInstance(this@ChromeStyleActivity)
                    webViewDatabase.clearFormData()
                    webViewDatabase.clearHttpAuthUsernamePassword()
                    
                    Log.i("ChromeStyleActivity", "数据重置完成")
                    Toast.makeText(this@ChromeStyleActivity, "数据重置完成！", Toast.LENGTH_LONG).show()
                }
                
            } catch (e: Exception) {
                Log.e("ChromeStyleActivity", "数据重置异常", e)
                runOnUiThread {
                    Toast.makeText(this@ChromeStyleActivity, 
                        "重置失败: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
    
    
    /**
     * 显示一键修复对话框
     */
    private fun showOneClickFix() {
        val dialog = android.app.AlertDialog.Builder(this)
            .setTitle("🔧 网络修复")
            .setMessage("检测到网络连接异常，是否尝试自动修复？\n\n修复内容：\n• 重新选择最优节点\n• 重置网络配置\n• 清理缓存数据")
            .setPositiveButton("🔧 一键修复") { _, _ ->
                performOneClickFix()
            }
            .setNegativeButton("取消", null)
            .create()
        dialog.show()
    }
    
    /**
     * 执行一键修复
     */
    private fun performOneClickFix() {
        securityIndicator.text = "🟡"
        pageTitle.text = "正在修复网络..."
        
        activityScope.launch {
            try {
                // 1. 重新选择节点
                if (::failoverManager.isInitialized) {
                    failoverManager.switchToOptimalNode()
                }
                
                delay(1000)
                
                // 2. 重置VPN连接
                if (XrayVpnService.isServiceRunning) {
                    val intent = Intent(this@ChromeStyleActivity, XrayVpnService::class.java).apply {
                        action = XrayVpnService.ACTION_SWITCH_NODE
                    }
                    startService(intent)
                }
                
                delay(2000)
                
                // 3. 刷新当前页面
                runOnUiThread {
                    webView.reload()
                    updateUI()
                    pageTitle.text = "VPN浏览器"
                    Toast.makeText(this@ChromeStyleActivity, "网络修复完成", Toast.LENGTH_SHORT).show()
                }
                
            } catch (e: Exception) {
                Log.e("ChromeStyleActivity", "一键修复失败", e)
                runOnUiThread {
                    securityIndicator.text = "🔴"
                    pageTitle.text = "修复失败"
                    Toast.makeText(this@ChromeStyleActivity, "修复失败，请尝试重启应用", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
    
    /**
     * 显示状态信息
     */
    private fun showStatusInfo(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
    
    /**
     * 显示高级设置
     */
    private fun showAdvancedSettings() {
        val intent = Intent(this, AdvancedSettingsActivity::class.java)
        startActivity(intent)
    }

    private fun loadUrl(url: String) {
        var finalUrl = url
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            // 如果不是URL，当作搜索处理
            finalUrl = if (url.contains(" ") || !url.contains(".")) {
                "https://www.google.com/search?q=${url.replace(" ", "+")}"
            } else {
                "https://$url"
            }
        }
        webView.loadUrl(finalUrl)
    }

    private fun updateNavigationButtons() {
        backButton.isEnabled = webView.canGoBack()
        forwardButton.isEnabled = webView.canGoForward()
        
        backButton.alpha = if (webView.canGoBack()) 1.0f else 0.3f
        forwardButton.alpha = if (webView.canGoForward()) 1.0f else 0.3f
    }

    override fun onBackPressed() {
        // 如果在全屏视频模式，先退出全屏
        if (customView != null) {
            (webView.webChromeClient as? WebChromeClient)?.onHideCustomView()
            return
        }
        
        // 正常的返回逻辑
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
    
    /**
     * 从百度App协议中提取真实URL
     */
    private fun extractRealUrlFromBaiduApp(baiduUrl: String): String? {
        try {
            val uri = Uri.parse(baiduUrl)
            val urlParam = uri.getQueryParameter("url")
            if (urlParam != null) {
                return URLDecoder.decode(urlParam, "UTF-8")
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }
    
    /**
     * 清理显示URL，移除过长的参数
     */
    private fun cleanDisplayUrl(url: String?): String {
        if (url == null) return ""
        
        try {
            val uri = Uri.parse(url)
            val host = uri.host ?: return url
            val path = uri.path ?: ""
            
            // 如果URL过长，只显示域名和路径
            return if (url.length > 50) {
                "https://$host$path"
            } else {
                url
            }
        } catch (e: Exception) {
            return url
        }
    }
    
    /**
     * 处理URL错误
     */
    private fun handleUrlError(url: String) {
        // 如果是复杂的重定向URL，尝试提取真实URL
        if (url.contains("baidu.com") && url.contains("%")) {
            try {
                val decoded = URLDecoder.decode(url, "UTF-8")
                if (decoded != url && decoded.startsWith("http")) {
                    webView.loadUrl(decoded)
                    return
                }
            } catch (e: Exception) {
                // 忽略解码错误
            }
        }
        
        // 显示错误提示
        Toast.makeText(this, "网页无法打开，请检查网址", Toast.LENGTH_SHORT).show()
    }
}
