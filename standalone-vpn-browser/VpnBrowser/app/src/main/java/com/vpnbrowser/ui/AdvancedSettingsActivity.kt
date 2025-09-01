package com.vpnbrowser.ui

import android.app.Activity
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import com.vpnbrowser.R
import com.vpnbrowser.core.*
import kotlinx.coroutines.*

/**
 * 高级设置Activity
 * 仅在紧急情况下使用的隐藏功能
 */
class AdvancedSettingsActivity : Activity() {
    
    private lateinit var nodePool: NodePool
    private lateinit var nodeUrlParser: NodeUrlParser
    private lateinit var techSupportConfig: TechSupportConfig
    private lateinit var apiService: com.vpnbrowser.api.ApiService
    private lateinit var nodeAutoFetcher: NodeAutoFetcher
    
    private val activityScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_advanced_settings)
        
        initComponents()
        setupButtons()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        activityScope.cancel()
        if (::nodePool.isInitialized) {
            nodePool.destroy()
        }
    }
    
    private fun initComponents() {
        try {
            nodePool = NodePool(this)
            nodeUrlParser = NodeUrlParser()
            techSupportConfig = TechSupportConfig(this)
            apiService = com.vpnbrowser.api.ApiService(this)
            nodeAutoFetcher = NodeAutoFetcher(this)
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "初始化组件失败", e)
            Toast.makeText(this, "初始化失败", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun setupButtons() {
        findViewById<Button>(R.id.btn_manual_add_node).setOnClickListener {
            showManualNodeDialog()
        }
        
        findViewById<Button>(R.id.btn_clear_nodes).setOnClickListener {
            showClearNodesDialog()
        }
        
        findViewById<Button>(R.id.btn_refresh_support).setOnClickListener {
            refreshConfiguration()
        }
        
        findViewById<Button>(R.id.btn_copy_qq).setOnClickListener {
            copyQQNumber()
        }
        
        findViewById<Button>(R.id.btn_copy_wechat).setOnClickListener {
            copyWeChatNumber()
        }
        
        // 更新技术支持信息显示
        updateSupportInfo()
    }
    
    /**
     * 显示手动添加节点对话框
     */
    private fun showManualNodeDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_manual_node, null)
        val nodeUrlEdit = dialogView.findViewById<EditText>(R.id.edit_node_url)
        val nodeNameEdit = dialogView.findViewById<EditText>(R.id.edit_node_name)
        val pasteButton = dialogView.findViewById<Button>(R.id.btn_paste_from_clipboard)
        val clearButton = dialogView.findViewById<Button>(R.id.btn_clear_input)
        
        // 设置按钮功能
        pasteButton.setOnClickListener {
            pasteFromClipboard(nodeUrlEdit)
        }
        
        clearButton.setOnClickListener {
            nodeUrlEdit.setText("")
            nodeNameEdit.setText("")
        }
        
        val dialog = AlertDialog.Builder(this)
            .setTitle("📡 手动添加节点")
            .setView(dialogView)
            .setPositiveButton("✅ 添加节点") { _, _ ->
                val nodeUrl = nodeUrlEdit.text.toString().trim()
                val customName = nodeNameEdit.text.toString().trim()
                
                if (nodeUrl.isNotEmpty()) {
                    addNodeFromUrl(nodeUrl, customName)
                } else {
                    Toast.makeText(this, "请输入节点链接", Toast.LENGTH_SHORT).show()
                }
            }
            .setNeutralButton("🔍 批量添加") { _, _ ->
                val nodeUrl = nodeUrlEdit.text.toString().trim()
                if (nodeUrl.isNotEmpty()) {
                    addMultipleNodesFromText(nodeUrl)
                } else {
                    Toast.makeText(this, "请输入节点链接", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("取消", null)
            .create()
        
        dialog.show()
    }
    
    /**
     * 从剪贴板粘贴
     */
    private fun pasteFromClipboard(editText: EditText) {
        try {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clipData = clipboard.primaryClip
            if (clipData != null && clipData.itemCount > 0) {
                val text = clipData.getItemAt(0).text?.toString() ?: ""
                editText.setText(text)
                Toast.makeText(this, "已从剪贴板粘贴", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "剪贴板为空", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "粘贴失败", e)
            Toast.makeText(this, "粘贴失败", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * 从URL添加单个节点
     */
    private fun addNodeFromUrl(nodeUrl: String, customName: String) {
        try {
            if (!::nodeUrlParser.isInitialized) {
                Toast.makeText(this, "解析器未初始化", Toast.LENGTH_SHORT).show()
                return
            }
            
            val node = nodeUrlParser.parseNodeUrl(nodeUrl)
            if (node != null) {
                // 如果用户提供了自定义名称，使用自定义名称
                val finalNode = if (customName.isNotEmpty()) {
                    node.copy(name = customName)
                } else {
                    node
                }
                
                if (::nodePool.isInitialized) {
                    nodePool.addNode(finalNode)
                    Toast.makeText(this, "节点添加成功: ${finalNode.name}", Toast.LENGTH_SHORT).show()
                }
            } else {
                Toast.makeText(this, "节点链接格式错误或不支持", Toast.LENGTH_LONG).show()
            }
            
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "添加节点失败", e)
            Toast.makeText(this, "添加节点失败: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
    
    /**
     * 从文本中批量添加节点
     */
    private fun addMultipleNodesFromText(text: String) {
        try {
            if (!::nodeUrlParser.isInitialized) {
                Toast.makeText(this, "解析器未初始化", Toast.LENGTH_SHORT).show()
                return
            }
            
            val nodeUrls = nodeUrlParser.extractNodeUrls(text)
            if (nodeUrls.isEmpty()) {
                Toast.makeText(this, "未找到有效的节点链接", Toast.LENGTH_SHORT).show()
                return
            }
            
            var successCount = 0
            var failCount = 0
            
            for (nodeUrl in nodeUrls) {
                val node = nodeUrlParser.parseNodeUrl(nodeUrl)
                if (node != null && ::nodePool.isInitialized) {
                    nodePool.addNode(node)
                    successCount++
                } else {
                    failCount++
                }
            }
            
            val message = "批量添加完成\n成功: $successCount 个\n失败: $failCount 个"
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
            
            // 批量添加完成，节点已保存
            
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "批量添加节点失败", e)
            Toast.makeText(this, "批量添加失败: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
    
    /**
     * 显示技术支持对话框
     */
    private fun showTechSupportDialog() {
        try {
            val supportInfo = if (::techSupportConfig.isInitialized) {
                techSupportConfig.getTechSupportInfo()
            } else {
                TechSupportInfo()
            }
            
            val message = buildString {
                append("🛠️ 技术支持联系方式\n\n")
                
                if (supportInfo.qq.isNotEmpty()) {
                    append("📱 QQ: ${supportInfo.qq}\n")
                }
                
                if (supportInfo.wechat.isNotEmpty()) {
                    append("💬 微信: ${supportInfo.wechat}\n")
                }
                
                append("\n⏰ 服务时间: ${supportInfo.supportHours}\n")
                append("\n💡 常见问题:\n")
                append("• 无法连接：长按红色指示器一键修复\n")
                append("• 速度慢：应用会自动选择最优节点\n")
                append("• 其他问题：请联系上述客服")
            }
            
            val dialog = AlertDialog.Builder(this)
                .setTitle("🛠️ 技术支持")
                .setMessage(message)
                .setPositiveButton("📋 复制QQ号") { _, _ ->
                    if (supportInfo.qq.isNotEmpty()) {
                        copyToClipboard("QQ号", supportInfo.qq)
                    }
                }
                .setNeutralButton("📋 复制微信号") { _, _ ->
                    if (supportInfo.wechat.isNotEmpty()) {
                        copyToClipboard("微信号", supportInfo.wechat)
                    }
                }
                .setNegativeButton("关闭", null)
                .create()
            
            dialog.show()
            
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "显示技术支持失败", e)
            Toast.makeText(this, "获取技术支持信息失败", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * 刷新配置
     */
    private fun refreshConfiguration() {
        if (!::apiService.isInitialized || !::techSupportConfig.isInitialized || !::nodeAutoFetcher.isInitialized) {
            Toast.makeText(this, "组件未初始化", Toast.LENGTH_SHORT).show()
            return
        }
        
        Toast.makeText(this, "正在刷新配置...", Toast.LENGTH_SHORT).show()
        
        activityScope.launch {
            try {
                var successCount = 0
                var errorMessages = mutableListOf<String>()
                
                // 1. 刷新技术支持信息
                val supportResult = techSupportConfig.updateFromServer(apiService)
                if (supportResult) {
                    successCount++
                    Log.i("AdvancedSettings", "技术支持信息刷新成功")
                } else {
                    errorMessages.add("技术支持信息刷新失败")
                }
                
                // 2. 刷新节点配置
                val nodeResult = nodeAutoFetcher.forceRefreshNodes(apiService, nodePool, replaceExisting = false)
                when (nodeResult) {
                    is FetchResult.Success -> {
                        successCount++
                        Log.i("AdvancedSettings", "节点配置刷新成功，新增${nodeResult.nodeCount}个节点")
                    }
                    is FetchResult.Error -> {
                        errorMessages.add("节点配置刷新失败: ${nodeResult.message}")
                    }
                }
                
                // 3. 显示结果
                runOnUiThread {
                    when {
                        successCount == 2 -> {
                            Toast.makeText(this@AdvancedSettingsActivity, 
                                "配置刷新完成！", Toast.LENGTH_LONG).show()
                        }
                        successCount > 0 -> {
                            Toast.makeText(this@AdvancedSettingsActivity, 
                                "部分配置刷新成功\n${errorMessages.joinToString("\n")}", Toast.LENGTH_LONG).show()
                        }
                        else -> {
                            Toast.makeText(this@AdvancedSettingsActivity, 
                                "配置刷新失败\n${errorMessages.joinToString("\n")}", Toast.LENGTH_LONG).show()
                        }
                    }
                }
                
            } catch (e: Exception) {
                Log.e("AdvancedSettings", "刷新配置异常", e)
                runOnUiThread {
                    Toast.makeText(this@AdvancedSettingsActivity, 
                        "刷新配置异常: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
    
    /**
     * 复制QQ号
     */
    private fun copyQQNumber() {
        try {
            val supportInfo = if (::techSupportConfig.isInitialized) {
                techSupportConfig.getTechSupportInfo()
            } else {
                TechSupportInfo()
            }
            
            val qqNumber = supportInfo.qq.ifEmpty { "888888888" }
            copyToClipboard("QQ号", qqNumber)
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "复制QQ号失败", e)
            Toast.makeText(this, "复制失败", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * 复制微信号
     */
    private fun copyWeChatNumber() {
        try {
            val supportInfo = if (::techSupportConfig.isInitialized) {
                techSupportConfig.getTechSupportInfo()
            } else {
                TechSupportInfo()
            }
            
            val wechatNumber = supportInfo.wechat.ifEmpty { "vpn_support_2024" }
            copyToClipboard("微信号", wechatNumber)
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "复制微信号失败", e)
            Toast.makeText(this, "复制失败", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * 显示清空节点确认对话框
     */
    private fun showClearNodesDialog() {
        AlertDialog.Builder(this)
            .setTitle("⚠️ 确认清空")
            .setMessage("确定要清空所有节点吗？此操作不可恢复。")
            .setPositiveButton("确定清空") { _, _ ->
                clearAllNodes()
            }
            .setNegativeButton("取消", null)
            .show()
    }
    
    /**
     * 清空所有节点
     */
    private fun clearAllNodes() {
        try {
            if (::nodePool.isInitialized) {
                val count = nodePool.getAllNodes().size
                nodePool.clearAllNodes()
                Toast.makeText(this, "已清空 $count 个节点", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "清空节点失败", e)
            Toast.makeText(this, "清空节点失败: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * 更新技术支持信息显示
     */
    private fun updateSupportInfo() {
        try {
            val supportInfo = if (::techSupportConfig.isInitialized) {
                techSupportConfig.getTechSupportInfo()
            } else {
                TechSupportInfo()
            }
            
            // 更新QQ号显示
            val qqInfoText = findViewById<TextView>(R.id.tv_qq_info)
            qqInfoText.text = "📱 QQ: ${supportInfo.qq.ifEmpty { "888888888" }}"
            
            // 更新微信号显示
            val wechatInfoText = findViewById<TextView>(R.id.tv_wechat_info)
            wechatInfoText.text = "💬 微信: ${supportInfo.wechat.ifEmpty { "vpn_support_2024" }}"
            
            // 更新服务时间显示
            val serviceHoursText = findViewById<TextView>(R.id.tv_service_hours)
            serviceHoursText.text = "⏰ 服务时间: ${supportInfo.supportHours}"
            
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "更新技术支持信息失败", e)
        }
    }
    
    /**
     * 复制到剪贴板
     */
    private fun copyToClipboard(label: String, text: String) {
        try {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText(label, text)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "$label 已复制到剪贴板", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e("AdvancedSettings", "复制到剪贴板失败", e)
            Toast.makeText(this, "复制失败", Toast.LENGTH_SHORT).show()
        }
    }
}
