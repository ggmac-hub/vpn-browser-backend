package com.vpnbrowser.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import com.vpnbrowser.R
import com.vpnbrowser.core.*
import com.vpnbrowser.ui.ChromeStyleActivity
import kotlinx.coroutines.*
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.InetSocketAddress
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.channels.SocketChannel

/**
 * Xray VPN服务
 * 负责建立VPN隧道，启动Xray内核，处理流量转发
 */
class XrayVpnService : VpnService() {
    companion object {
        private const val TAG = "XrayVpnService"
        const val ACTION_START = "start"
        const val ACTION_STOP = "stop"
        const val ACTION_SWITCH_NODE = "switch_node"
        
        var isServiceRunning = false
            private set
    }
    
    // 服务组件
    private lateinit var nodePool: NodePool
    private lateinit var loadBalancer: LoadBalancer
    private lateinit var healthChecker: HealthChecker
    private lateinit var failoverManager: FailoverManager
    private lateinit var configGenerator: XrayConfigGenerator
    
    // VPN相关
    private var vpnInterface: ParcelFileDescriptor? = null
    private var isRunning = false
    
    // 协程作用域
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    // 通知相关
    private val NOTIFICATION_ID = 1001
    private val CHANNEL_ID = "vpn_service"
    
    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "VPN服务创建")
        
        // 初始化组件
        initializeComponents()
        
        // 创建通知渠道
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START
        
        when (action) {
            ACTION_START -> startVpnService()
            ACTION_STOP -> stopVpnService()
            ACTION_SWITCH_NODE -> switchToOptimalNode()
        }
        
        return START_STICKY
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "VPN服务销毁")
        stopVpnService()
        destroyComponents()
    }
    
    /**
     * 初始化组件
     */
    private fun initializeComponents() {
        nodePool = NodePool(this)
        loadBalancer = LoadBalancer()
        healthChecker = HealthChecker(this)
        configGenerator = XrayConfigGenerator()
        
        failoverManager = FailoverManager(this, nodePool, loadBalancer, healthChecker)
        failoverManager.setCallback(object : FailoverManager.FailoverCallback {
            override fun onNodeChanged(oldNode: ProxyNode?, newNode: ProxyNode?) {
                updateNotification("已切换到: ${newNode?.name ?: "无"}")
            }
            
            override fun onSwitchStarted(reason: String) {
                updateNotification("正在切换节点: $reason")
            }
            
            override fun onSwitchCompleted(success: Boolean, newNode: ProxyNode?) {
                if (success) {
                    updateNotification("切换成功: ${newNode?.name}")
                } else {
                    updateNotification("切换失败")
                }
            }
            
            override fun onSwitchFailed(reason: String) {
                updateNotification("切换失败: $reason")
            }
        })
        
        // 加载内置节点
        loadBuiltinNodes()
    }
    
    /**
     * 加载内置节点
     */
    private fun loadBuiltinNodes() {
        val builtinNodes = DefaultNodes.getBuiltinNodes()
        nodePool.addNodes(builtinNodes)
        Log.i(TAG, "加载了${builtinNodes.size}个内置节点")
    }
    
    /**
     * 启动VPN服务
     */
    private fun startVpnService() {
        if (isRunning) {
            Log.w(TAG, "VPN服务已在运行")
            return
        }
        
        try {
            Log.i(TAG, "启动VPN服务")
            
            // 先启动前台服务避免被系统杀死
            startForeground(NOTIFICATION_ID, createNotification("正在启动VPN..."))
            
            isRunning = true
            isServiceRunning = true
            
            // 在后台协程中执行初始化（简化版本）
            serviceScope.launch {
                try {
                    delay(1000) // 等待1秒确保服务完全启动
                    
                    // 1. 选择最优节点
                    val optimalNode = selectInitialNode()
                    if (optimalNode == null) {
                        Log.e(TAG, "没有可用节点")
                        updateNotification("没有可用节点")
                        return@launch
                    }
                    
                    Log.i(TAG, "选择节点: ${optimalNode.name}")
                    
                    // 2. 建立VPN隧道
                    Log.i(TAG, "尝试建立VPN隧道...")
                    if (!establishVpnTunnel()) {
                        Log.e(TAG, "建立VPN隧道失败")
                        updateNotification("VPN隧道建立失败")
                        return@launch
                    }
                    
                    // 3. 模拟启动Xray内核（暂时跳过实际启动）
                    Log.i(TAG, "模拟启动Xray内核")
                    delay(500)
                    
                    // 4. 设置当前节点
                    failoverManager.setCurrentNode(optimalNode)
                    
                    // 5. 暂时跳过健康检查和流量转发
                    Log.i(TAG, "跳过健康检查和流量转发（测试模式）")
                    
                    // 6. 更新通知
                    updateNotification("VPN已连接: ${optimalNode.name}")
                    
                    Log.i(TAG, "VPN服务启动成功（简化模式）")
                    
                } catch (e: Exception) {
                    Log.e(TAG, "VPN服务初始化失败", e)
                    updateNotification("VPN服务初始化失败: ${e.message}")
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "启动VPN服务失败", e)
            stopSelf()
        }
    }
    
    /**
     * 停止VPN服务
     */
    private fun stopVpnService() {
        if (!isRunning) {
            return
        }
        
        Log.i(TAG, "停止VPN服务")
        
        isRunning = false
        isServiceRunning = false
        
        // 停止健康检查
        healthChecker.stopHealthCheck()
        
        // 停止Xray内核
        stopXrayCore()
        
        // 关闭VPN隧道
        vpnInterface?.close()
        vpnInterface = null
        
        // 停止前台服务
        stopForeground(true)
        
        stopSelf()
    }
    
    /**
     * 选择初始节点
     */
    private suspend fun selectInitialNode(): ProxyNode? {
        // 获取快速节点进行测试
        val fastNodes = DefaultNodes.getFastNodes()
        
        // 并发测试节点
        val healthyNodes = healthChecker.quickCheckNodes(fastNodes)
        
        if (healthyNodes.isEmpty()) {
            Log.w(TAG, "快速节点都不可用，尝试所有节点")
            val allNodes = nodePool.getAllNodes()
            return healthChecker.quickCheckNodes(allNodes).firstOrNull()
        }
        
        // 使用负载均衡器选择最优节点
        return loadBalancer.selectOptimalNode(healthyNodes)
    }
    
    /**
     * 建立VPN隧道
     */
    private fun establishVpnTunnel(): Boolean {
        return try {
            Log.i(TAG, "开始建立VPN隧道")
            
            val builder = Builder()
                .setSession("VPN浏览器")
                .addAddress("10.0.0.2", 24)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("8.8.8.8")
                .addDnsServer("8.8.4.4")
                .setMtu(1500)
                .setBlocking(false)
            
            vpnInterface = builder.establish()
            val success = vpnInterface != null
            
            if (success) {
                Log.i(TAG, "VPN隧道建立成功")
            } else {
                Log.e(TAG, "VPN隧道建立失败：builder.establish()返回null")
            }
            
            success
            
        } catch (e: SecurityException) {
            Log.e(TAG, "VPN权限不足", e)
            false
        } catch (e: Exception) {
            Log.e(TAG, "建立VPN隧道异常", e)
            false
        }
    }
    
    /**
     * 启动Xray内核
     */
    private fun startXrayCore(node: ProxyNode): Boolean {
        return try {
            val config = configGenerator.generateConfig(node)
            Log.d(TAG, "Xray配置: $config")
            
            // TODO: 实际启动Xray内核
            // 这里应该调用Xray的JNI接口或者启动Xray进程
            // XrayCore.start(config)
            
            Log.i(TAG, "Xray内核启动成功 (模拟)")
            true
            
        } catch (e: Exception) {
            Log.e(TAG, "启动Xray内核失败", e)
            false
        }
    }
    
    /**
     * 停止Xray内核
     */
    private fun stopXrayCore() {
        try {
            // TODO: 实际停止Xray内核
            // XrayCore.stop()
            
            Log.i(TAG, "Xray内核已停止 (模拟)")
            
        } catch (e: Exception) {
            Log.e(TAG, "停止Xray内核失败", e)
        }
    }
    
    /**
     * 启动流量转发
     */
    private fun startTrafficForwarding() {
        serviceScope.launch {
            val vpnInput = FileInputStream(vpnInterface!!.fileDescriptor)
            val vpnOutput = FileOutputStream(vpnInterface!!.fileDescriptor)
            
            try {
                val buffer = ByteBuffer.allocate(32767)
                
                while (isRunning) {
                    // 从VPN接口读取数据包
                    val length = vpnInput.channel.read(buffer)
                    if (length > 0) {
                        buffer.flip()
                        
                        // 转发到SOCKS代理
                        forwardToProxy(buffer)
                        
                        buffer.clear()
                    }
                    
                    delay(1) // 避免CPU占用过高
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "流量转发异常", e)
            } finally {
                vpnInput.close()
                vpnOutput.close()
            }
        }
    }
    
    /**
     * 转发数据包到代理
     */
    private suspend fun forwardToProxy(buffer: ByteBuffer) {
        try {
            // 连接到本地SOCKS代理
            val socketChannel = SocketChannel.open()
            socketChannel.connect(InetSocketAddress("127.0.0.1", 10808))
            
            // 转发数据
            socketChannel.write(buffer)
            
            socketChannel.close()
            
        } catch (e: Exception) {
            Log.e(TAG, "转发数据包失败", e)
            
            // 记录失败，可能触发故障切换
            val currentNode = failoverManager.getCurrentNode()
            currentNode?.let { node ->
                failoverManager.handleRequestFailure(node, e.message)
            }
        }
    }
    
    /**
     * 切换到最优节点
     */
    private fun switchToOptimalNode() {
        serviceScope.launch {
            try {
                val success = failoverManager.switchToOptimalNode()
                if (success) {
                    val newNode = failoverManager.getCurrentNode()
                    if (newNode != null) {
                        startXrayCore(newNode)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "切换节点失败", e)
            }
        }
    }
    
    /**
     * 创建通知渠道
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "VPN服务",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "VPN浏览器服务通知"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    /**
     * 创建通知
     */
    private fun createNotification(content: String): Notification {
        val intent = Intent(this, ChromeStyleActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VPN浏览器")
            .setContentText(content)
            .setSmallIcon(R.drawable.ic_vpn_key_24dp)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
    
    /**
     * 更新通知
     */
    private fun updateNotification(content: String) {
        val notification = createNotification(content)
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
    
    /**
     * 销毁组件
     */
    private fun destroyComponents() {
        serviceScope.cancel()
        failoverManager.destroy()
        healthChecker.destroy()
        nodePool.destroy()
    }
}
