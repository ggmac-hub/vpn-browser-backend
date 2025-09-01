package com.vpnbrowser.ui

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.webkit.*
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import com.vpnbrowser.R
import com.vpnbrowser.core.UserTokenManager
import kotlinx.coroutines.*

/**
 * 用户账户管理Activity - 通过WebView集成后台用户端页面
 */
class AccountActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var titleBar: TextView
    private lateinit var backButton: Button
    private lateinit var refreshButton: Button
    private lateinit var progressBar: ProgressBar
    
    private lateinit var userTokenManager: UserTokenManager
    
    // 协程作用域
    private val activityScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    // 后台服务器地址 - 在实际部署时需要修改为真实地址
    private val BASE_URL = "http://10.0.2.2:3000"  // Android模拟器访问本机地址
    // private val BASE_URL = "https://your-domain.com"  // 生产环境地址
    
    companion object {
        private const val TAG = "AccountActivity"
        
        /**
         * 启动账户管理页面
         */
        fun start(context: Context) {
            val intent = Intent(context, AccountActivity::class.java)
            context.startActivity(intent)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account)

        initViews()
        initUserTokenManager()
        setupWebView()
        setupButtons()
        
        // 加载用户端页面
        loadUserDashboard()
    }
    
    override fun onDestroy() {
        webView.destroy()
        activityScope.cancel()
        super.onDestroy()
    }
    
    private fun initViews() {
        webView = findViewById(R.id.account_webview)
        titleBar = findViewById(R.id.account_title)
        backButton = findViewById(R.id.account_back_button)
        refreshButton = findViewById(R.id.account_refresh_button)
        progressBar = findViewById(R.id.account_progress_bar)
        
        titleBar.text = "我的账户"
    }
    
    private fun initUserTokenManager() {
        userTokenManager = UserTokenManager(this)
    }
    
    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            
            // 移动端优化
            userAgentString = "Mozilla/5.0 (Linux; Android 12; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36"
            
            // 数据库和存储
            databaseEnabled = true
        }

        // 添加JavaScript接口，用于Android和Web端通信
        webView.addJavascriptInterface(AndroidWebInterface(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                Log.d(TAG, "Loading URL: $url")
                
                // 只允许加载我们的后台页面
                return if (url.startsWith(BASE_URL)) {
                    false  // 允许加载
                } else {
                    Log.w(TAG, "Blocked external URL: $url")
                    true   // 阻止加载外部链接
                }
            }
            
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                progressBar.progress = 0
                Log.d(TAG, "Page started: $url")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                Log.d(TAG, "Page finished: $url")
                
                // 页面加载完成后，注入用户token
                injectUserToken()
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                progressBar.visibility = View.GONE
                
                val errorMsg = "加载失败: ${error?.description}"
                Log.e(TAG, errorMsg)
                Toast.makeText(this@AccountActivity, errorMsg, Toast.LENGTH_LONG).show()
                
                // 显示错误页面
                showErrorPage()
            }
            
            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                super.onReceivedHttpError(view, request, errorResponse)
                val statusCode = errorResponse?.statusCode ?: 0
                Log.e(TAG, "HTTP Error: $statusCode for ${request?.url}")
                
                if (statusCode == 404) {
                    Toast.makeText(this@AccountActivity, "页面不存在，请检查服务器配置", Toast.LENGTH_LONG).show()
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
                titleBar.text = title ?: "我的账户"
            }
            
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d(TAG, "Console: ${consoleMessage?.message()}")
                return true
            }
        }
    }
    
    private fun setupButtons() {
        backButton.setOnClickListener {
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                finish()
            }
        }
        
        refreshButton.setOnClickListener {
            webView.reload()
        }
    }
    
    /**
     * 加载用户仪表板页面
     */
    private fun loadUserDashboard() {
        val token = userTokenManager.getToken()
        val url = if (token != null) {
            "$BASE_URL/user/dashboard"
        } else {
            "$BASE_URL/user/login"
        }
        
        Log.d(TAG, "Loading user dashboard: $url")
        webView.loadUrl(url)
    }
    
    /**
     * 注入用户token到Web页面
     */
    private fun injectUserToken() {
        val token = userTokenManager.getToken()
        val user = userTokenManager.getUser()
        
        if (token != null) {
            // 注入token到localStorage
            val script = """
                (function() {
                    try {
                        localStorage.setItem('token', '$token');
                        ${if (user != null) "localStorage.setItem('user', '$user');" else ""}
                        console.log('Token injected successfully');
                        
                        // 触发token更新事件
                        window.dispatchEvent(new Event('tokenUpdated'));
                    } catch (e) {
                        console.error('Failed to inject token:', e);
                    }
                })();
            """.trimIndent()
            
            webView.evaluateJavascript(script) { result ->
                Log.d(TAG, "Token injection result: $result")
            }
        } else {
            Log.d(TAG, "No token available, user needs to login")
        }
    }
    
    /**
     * 显示错误页面
     */
    private fun showErrorPage() {
        val errorHtml = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>连接失败</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        background: #f5f5f5; 
                    }
                    .error-container {
                        background: white;
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .error-icon { font-size: 48px; margin-bottom: 20px; }
                    .error-title { font-size: 24px; color: #333; margin-bottom: 10px; }
                    .error-message { color: #666; margin-bottom: 20px; }
                    .retry-button {
                        background: #007AFF;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 6px;
                        font-size: 16px;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-icon">🔌</div>
                    <div class="error-title">连接失败</div>
                    <div class="error-message">
                        无法连接到服务器，请检查：<br>
                        • 网络连接是否正常<br>
                        • 后台服务是否启动<br>
                        • 服务器地址是否正确
                    </div>
                    <button class="retry-button" onclick="window.location.reload()">重试</button>
                </div>
            </body>
            </html>
        """.trimIndent()
        
        webView.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null)
    }
    
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
    
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
    
    /**
     * JavaScript接口，用于Web页面与Android通信
     */
    inner class AndroidWebInterface {
        
        @JavascriptInterface
        fun getToken(): String? {
            return userTokenManager.getToken()
        }
        
        @JavascriptInterface
        fun setToken(token: String) {
            userTokenManager.saveToken(token)
            Log.d(TAG, "Token saved from web")
        }
        
        @JavascriptInterface
        fun getUser(): String? {
            return userTokenManager.getUser()
        }
        
        @JavascriptInterface
        fun setUser(user: String) {
            userTokenManager.saveUser(user)
            Log.d(TAG, "User info saved from web")
        }
        
        @JavascriptInterface
        fun clearAuth() {
            userTokenManager.clearAuth()
            Log.d(TAG, "Auth cleared from web")
        }
        
        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(this@AccountActivity, message, Toast.LENGTH_SHORT).show()
            }
        }
        
        @JavascriptInterface
        fun closeAccount() {
            runOnUiThread {
                finish()
            }
        }
        
        @JavascriptInterface
        fun getDeviceId(): String {
            return userTokenManager.getDeviceId()
        }
        
        @JavascriptInterface
        fun log(message: String) {
            Log.d(TAG, "WebView Log: $message")
        }
    }
}
