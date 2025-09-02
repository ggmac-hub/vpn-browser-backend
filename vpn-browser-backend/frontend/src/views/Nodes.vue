<template>
  <div class="nodes-page">
    <div class="page-header">
      <h1>🌐 节点管理</h1>
      <p>管理代理节点配置，支持VMess、VLess、Trojan、Shadowsocks等协议</p>
    </div>
    
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" @click="showAddDialog" :icon="Plus">
          添加节点
        </el-button>
        <el-button @click="showImportDialog" :icon="Upload">
          批量导入
        </el-button>
        <el-button type="warning" @click="showBatchTestDialog" :icon="Connection">
          批量测试
        </el-button>
        <el-button @click="refreshNodes" :icon="Refresh" :loading="loading">
          刷新
        </el-button>
      </div>
      
      <div class="toolbar-right">
        <el-select v-model="filterProtocol" placeholder="协议筛选" clearable style="width: 120px; margin-right: 12px;">
          <el-option label="VMess" value="vmess" />
          <el-option label="VLess" value="vless" />
          <el-option label="Trojan" value="trojan" />
          <el-option label="Shadowsocks" value="shadowsocks" />
        </el-select>
        
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 100px;">
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
      </div>
    </div>
    
    <!-- 节点列表 -->
    <div class="dashboard-card">
      <el-table 
        :data="filteredNodes" 
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="节点名称" min-width="150">
          <template #default="{ row }">
            <div class="node-name">
              <el-tag :type="getProtocolType(row.protocol)" size="small" style="margin-right: 8px;">
                {{ row.protocol.toUpperCase() }}
              </el-tag>
              {{ row.name }}
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="address" label="服务器地址" min-width="180" />
        
        <el-table-column prop="port" label="端口" width="80" />
        
        <el-table-column prop="region" label="地区" width="100">
          <template #default="{ row }">
            <span v-if="row.region">{{ row.region }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="priority" label="优先级" width="80" />
        
        <el-table-column prop="is_active" label="状态" width="80">
          <template #default="{ row }">
            <el-switch 
              v-model="row.is_active" 
              :active-value="1" 
              :inactive-value="0"
              @change="toggleNodeStatus(row)"
            />
          </template>
        </el-table-column>
        
        <el-table-column label="测试状态" width="120">
          <template #default="{ row }">
            <div class="test-status">
              <el-tag :type="getTestStatusType(row.last_test_status)" size="small">
                {{ getTestStatusText(row.last_test_status) }}
              </el-tag>
              <div v-if="row.last_test_latency" class="latency">
                {{ formatLatency(row.last_test_latency) }}
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="last_test_time" label="最后测试" width="120">
          <template #default="{ row }">
            {{ formatTestTime(row.last_test_time) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="button-group">
              <el-button type="primary" size="small" @click="editNode(row)" :icon="Edit">
                编辑
              </el-button>
              <el-button type="info" size="small" @click="testNode(row)" :icon="Connection">
                测试
              </el-button>
              <el-button type="danger" size="small" @click="deleteNode(row)" :icon="Delete">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 空状态 -->
      <div v-if="!loading && nodes.length === 0" class="empty-state">
        <el-empty description="暂无节点数据">
          <el-button type="primary" @click="showAddDialog">添加第一个节点</el-button>
        </el-empty>
      </div>
    </div>
    
    <!-- 添加/编辑节点对话框 -->
    <el-dialog
      v-model="nodeDialogVisible"
      :title="isEditMode ? '编辑节点' : '添加节点'"
      width="600px"
      @close="resetNodeForm"
    >
      <el-form
        ref="nodeFormRef"
        :model="nodeForm"
        :rules="nodeRules"
        label-width="100px"
      >
        <el-form-item label="节点名称" prop="name">
          <el-input v-model="nodeForm.name" placeholder="请输入节点名称" />
        </el-form-item>
        
        <el-form-item label="协议类型" prop="protocol">
          <el-select v-model="nodeForm.protocol" placeholder="选择协议" style="width: 100%;">
            <el-option label="VMess" value="vmess" />
            <el-option label="VLess" value="vless" />
            <el-option label="Trojan" value="trojan" />
            <el-option label="Shadowsocks" value="shadowsocks" />
          </el-select>
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="16">
            <el-form-item label="服务器地址" prop="address">
              <el-input v-model="nodeForm.address" placeholder="example.com" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="端口" prop="port">
              <el-input-number v-model="nodeForm.port" :min="1" :max="65535" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="地区">
              <el-input v-model="nodeForm.region" placeholder="asia" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="国家">
              <el-input v-model="nodeForm.country" placeholder="hong kong" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="城市">
              <el-input v-model="nodeForm.city" placeholder="hong kong" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="优先级">
              <el-input-number v-model="nodeForm.priority" :min="0" :max="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大连接数">
              <el-input-number v-model="nodeForm.max_connections" :min="1" :max="10000" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <!-- 协议特定配置 -->
        <el-form-item label="协议配置">
          <el-input
            v-model="configJson"
            type="textarea"
            :rows="6"
            placeholder="请输入JSON格式的协议配置"
          />
          <div class="form-tip">
            <el-text size="small" type="info">
              根据选择的协议类型，输入相应的配置参数（JSON格式）
            </el-text>
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="nodeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveNode" :loading="saveLoading">
          {{ isEditMode ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
    
    <!-- 批量导入对话框 -->
    <el-dialog
      v-model="importDialogVisible"
      title="批量导入节点"
      width="700px"
    >
      <div class="import-section">
        <el-alert
          title="支持的格式"
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <template #default>
            <p>支持以下格式的节点链接：</p>
            <ul>
              <li><strong>VMess:</strong> vmess://...</li>
              <li><strong>VLess:</strong> vless://...</li>
              <li><strong>Trojan:</strong> trojan://...</li>
              <li><strong>Shadowsocks:</strong> ss://...</li>
            </ul>
          </template>
        </el-alert>
        
        <el-form-item label="节点链接">
          <el-input
            v-model="importText"
            type="textarea"
            :rows="10"
            placeholder="请粘贴节点链接，每行一个，或者多个链接用换行分隔"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button @click="pasteFromClipboard" :icon="DocumentCopy">
            从剪贴板粘贴
          </el-button>
          <el-button @click="importText = ''" :icon="Delete">
            清空
          </el-button>
        </el-form-item>
      </div>
      
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="importNodes" :loading="importLoading">
          导入节点
        </el-button>
      </template>
    </el-dialog>
    
    <!-- 测试结果对话框 -->
    <el-dialog
      v-model="testResultDialogVisible"
      title="节点测试结果"
      width="600px"
    >
      <div class="test-result-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="节点名称">
            {{ testResultData.node_name }}
          </el-descriptions-item>
          <el-descriptions-item label="测试时间">
            {{ formatTime(testResultData.test_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="测试结果">
            <el-tag :type="testResultData.success ? 'success' : 'danger'">
              {{ testResultData.success ? '成功' : '失败' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="延迟">
            {{ testResultData.latency ? `${testResultData.latency}ms` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="协议" v-if="testResultData.details">
            {{ testResultData.details.protocol }}
          </el-descriptions-item>
          <el-descriptions-item label="地址" v-if="testResultData.details">
            {{ testResultData.details.address }}:{{ testResultData.details.port }}
          </el-descriptions-item>
        </el-descriptions>
        
        <div v-if="testResultData.error" class="error-info">
          <h4>错误信息</h4>
          <el-alert :title="testResultData.error" type="error" show-icon :closable="false" />
        </div>
        
        <div v-if="testResultData.details" class="details-info">
          <h4>详细信息</h4>
          <pre>{{ JSON.stringify(testResultData.details, null, 2) }}</pre>
        </div>
      </div>
    </el-dialog>
    
    <!-- 批量测试对话框 -->
    <el-dialog
      v-model="batchTestDialogVisible"
      title="批量测试节点"
      width="800px"
    >
      <div class="batch-test-content">
        <div class="node-selection">
          <h4>选择要测试的节点</h4>
          <el-checkbox-group v-model="selectedNodes">
            <div class="node-list">
              <el-checkbox 
                v-for="node in nodes" 
                :key="node.id" 
                :label="node.id"
                class="node-checkbox"
              >
                <div class="node-info">
                  <el-tag :type="getProtocolType(node.protocol)" size="small">
                    {{ node.protocol.toUpperCase() }}
                  </el-tag>
                  <span class="node-name">{{ node.name }}</span>
                  <span class="node-address">{{ node.address }}:{{ node.port }}</span>
                </div>
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </div>
        
        <div v-if="batchTestResults.length > 0" class="test-results">
          <h4>测试结果</h4>
          <el-table :data="batchTestResults" stripe>
            <el-table-column prop="node_name" label="节点名称" />
            <el-table-column label="测试结果" width="100">
              <template #default="{ row }">
                <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                  {{ row.success ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="latency" label="延迟" width="80">
              <template #default="{ row }">
                {{ row.latency ? `${row.latency}ms` : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="error" label="错误信息" min-width="200">
              <template #default="{ row }">
                <span v-if="row.error" class="error-text">{{ row.error }}</span>
                <span v-else class="success-text">连接正常</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="batchTestDialogVisible = false">关闭</el-button>
        <el-button 
          type="primary" 
          @click="batchTestNodes" 
          :loading="batchTestLoading"
          :disabled="selectedNodes.length === 0"
        >
          开始测试 ({{ selectedNodes.length }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, Refresh, Edit, Delete, Connection, DocumentCopy } from '@element-plus/icons-vue'
import { api } from '../api/request'
import dayjs from 'dayjs'

// 响应式数据
const loading = ref(false)
const nodes = ref([])
const filterProtocol = ref('')
const filterStatus = ref('')

// 节点表单
const nodeDialogVisible = ref(false)
const isEditMode = ref(false)
const saveLoading = ref(false)
const nodeFormRef = ref()
const currentNodeId = ref(null)

const nodeForm = ref({
  name: '',
  protocol: '',
  address: '',
  port: 443,
  region: '',
  country: '',
  city: '',
  priority: 0,
  max_connections: 1000,
  config: {}
})

const configJson = ref('')

const nodeRules = {
  name: [
    { required: true, message: '请输入节点名称', trigger: 'blur' }
  ],
  protocol: [
    { required: true, message: '请选择协议类型', trigger: 'change' }
  ],
  address: [
    { required: true, message: '请输入服务器地址', trigger: 'blur' }
  ],
  port: [
    { required: true, message: '请输入端口号', trigger: 'blur' }
  ]
}

// 批量导入
const importDialogVisible = ref(false)
const importLoading = ref(false)
const importText = ref('')

// 测试结果相关
const testResultDialogVisible = ref(false)
const testResultData = ref({})
const batchTestDialogVisible = ref(false)
const selectedNodes = ref([])
const batchTestLoading = ref(false)
const batchTestResults = ref([])

// 计算属性
const filteredNodes = computed(() => {
  let result = nodes.value
  
  if (filterProtocol.value) {
    result = result.filter(node => node.protocol === filterProtocol.value)
  }
  
  if (filterStatus.value !== '') {
    result = result.filter(node => node.is_active === filterStatus.value)
  }
  
  return result
})

// 方法
const loadNodes = async () => {
  try {
    loading.value = true
    const data = await api.get('/nodes/admin')
    nodes.value = data.data || []
  } catch (error) {
    console.error('加载节点列表失败:', error)
  } finally {
    loading.value = false
  }
}

const refreshNodes = () => {
  loadNodes()
}

const getProtocolType = (protocol) => {
  const typeMap = {
    'vmess': 'primary',
    'vless': 'success',
    'trojan': 'warning',
    'shadowsocks': 'info'
  }
  return typeMap[protocol] || 'info'
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const showAddDialog = () => {
  isEditMode.value = false
  nodeDialogVisible.value = true
  resetNodeForm()
}

const editNode = (node) => {
  isEditMode.value = true
  currentNodeId.value = node.id
  nodeForm.value = {
    name: node.name,
    protocol: node.protocol,
    address: node.address,
    port: node.port,
    region: node.region || '',
    country: node.country || '',
    city: node.city || '',
    priority: node.priority || 0,
    max_connections: node.max_connections || 1000,
    config: node.config || {}
  }
  configJson.value = JSON.stringify(node.config || {}, null, 2)
  nodeDialogVisible.value = true
}

const resetNodeForm = () => {
  nodeForm.value = {
    name: '',
    protocol: '',
    address: '',
    port: 443,
    region: '',
    country: '',
    city: '',
    priority: 0,
    max_connections: 1000,
    config: {}
  }
  configJson.value = ''
  currentNodeId.value = null
  if (nodeFormRef.value) {
    nodeFormRef.value.resetFields()
  }
}

const saveNode = async () => {
  try {
    await nodeFormRef.value.validate()
    
    // 解析配置JSON
    let config = {}
    if (configJson.value.trim()) {
      try {
        config = JSON.parse(configJson.value)
      } catch (e) {
        ElMessage.error('配置JSON格式错误')
        return
      }
    }
    
    saveLoading.value = true
    
    const nodeData = {
      ...nodeForm.value,
      config
    }
    
    if (isEditMode.value) {
      await api.put(`/nodes/${currentNodeId.value}`, nodeData)
      ElMessage.success('节点更新成功')
    } else {
      await api.post('/nodes', nodeData)
      ElMessage.success('节点创建成功')
    }
    
    nodeDialogVisible.value = false
    loadNodes()
  } catch (error) {
    console.error('保存节点失败:', error)
  } finally {
    saveLoading.value = false
  }
}

const toggleNodeStatus = async (node) => {
  try {
    await api.put(`/nodes/${node.id}`, {
      ...node,
      is_active: node.is_active
    })
    ElMessage.success(`节点已${node.is_active ? '启用' : '禁用'}`)
  } catch (error) {
    console.error('更新节点状态失败:', error)
    // 恢复状态
    node.is_active = node.is_active ? 0 : 1
  }
}

const deleteNode = async (node) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除节点 "${node.name}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await api.delete(`/nodes/${node.id}`)
    ElMessage.success('节点删除成功')
    loadNodes()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除节点失败:', error)
    }
  }
}

const testNode = async (node) => {
  try {
    // 显示测试中状态
    const loadingMessage = ElMessage({
      message: `正在测试节点 "${node.name}"...`,
      type: 'info',
      duration: 0,
      showClose: true
    })
    
    // 调用测试API
    const response = await api.post(`/nodes/${node.id}/test`)
    
    // 关闭加载消息
    loadingMessage.close()
    
    // 显示测试结果
    if (response.data.success) {
      ElMessage({
        message: `节点 "${node.name}" 测试成功！延迟: ${response.data.latency}ms`,
        type: 'success',
        duration: 5000
      })
      
      // 显示详细测试结果对话框
      showTestResultDialog(response.data)
    } else {
      ElMessage({
        message: `节点 "${node.name}" 测试失败: ${response.data.error}`,
        type: 'error',
        duration: 8000
      })
      
      // 显示详细错误信息对话框
      showTestResultDialog(response.data)
    }
    
    // 刷新节点列表以显示最新测试状态
    loadNodes()
    
  } catch (error) {
    console.error('节点测试失败:', error)
    ElMessage({
      message: `节点测试失败: ${error.response?.data?.error || error.message}`,
      type: 'error',
      duration: 8000
    })
  }
}

const showImportDialog = () => {
  importDialogVisible.value = true
  importText.value = ''
}

// 显示测试结果对话框
const showTestResultDialog = (result) => {
  testResultData.value = result
  testResultDialogVisible.value = true
}

// 批量测试相关方法
const showBatchTestDialog = () => {
  selectedNodes.value = []
  batchTestResults.value = []
  batchTestDialogVisible.value = true
}

const batchTestNodes = async () => {
  if (selectedNodes.value.length === 0) {
    ElMessage.warning('请至少选择一个节点进行测试')
    return
  }
  
  try {
    batchTestLoading.value = true
    batchTestResults.value = []
    
    const response = await api.post('/nodes/batch-test', {
      nodeIds: selectedNodes.value
    })
    
    batchTestResults.value = response.data.results || []
    
    ElMessage.success(`批量测试完成！成功: ${response.data.success}, 失败: ${response.data.failed}`)
    
    // 刷新节点列表
    loadNodes()
    
  } catch (error) {
    console.error('批量测试失败:', error)
    ElMessage.error(`批量测试失败: ${error.response?.data?.error || error.message}`)
  } finally {
    batchTestLoading.value = false
  }
}

// 获取测试状态的显示样式
const getTestStatusType = (status) => {
  const typeMap = {
    'success': 'success',
    'failed': 'danger',
    'untested': 'info'
  }
  return typeMap[status] || 'info'
}

const getTestStatusText = (status) => {
  const textMap = {
    'success': '测试成功',
    'failed': '测试失败',
    'untested': '未测试'
  }
  return textMap[status] || '未知'
}

// 格式化延迟显示
const formatLatency = (latency) => {
  if (!latency) return '-'
  return `${latency}ms`
}

// 格式化测试时间
const formatTestTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('MM-DD HH:mm')
}

const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText()
    importText.value = text
    ElMessage.success('已从剪贴板粘贴')
  } catch (error) {
    ElMessage.error('读取剪贴板失败，请手动粘贴')
  }
}

const importNodes = async () => {
  if (!importText.value.trim()) {
    ElMessage.error('请输入要导入的节点链接')
    return
  }
  
  try {
    importLoading.value = true
    
    const nodeUrls = importText.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    const result = await api.post('/nodes/batch-import', {
      nodeUrls
    })
    
    ElMessage.success(`批量导入完成！成功: ${result.data.successCount}, 失败: ${result.data.errorCount}`)
    importDialogVisible.value = false
    loadNodes()
  } catch (error) {
    console.error('批量导入失败:', error)
  } finally {
    importLoading.value = false
  }
}

// 生命周期
onMounted(() => {
  loadNodes()
})
</script>

<style scoped>
.nodes-page {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.page-header p {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.node-name {
  display: flex;
  align-items: center;
}

.text-muted {
  color: #c0c4cc;
}

.form-tip {
  margin-top: 8px;
}

.import-section ul {
  margin: 8px 0;
  padding-left: 20px;
}

.import-section li {
  margin: 4px 0;
}

/* 测试状态样式 */
.test-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.test-status .latency {
  font-size: 12px;
  color: #666;
}

/* 测试结果对话框样式 */
.test-result-content {
  padding: 16px 0;
}

.error-info,
.details-info {
  margin-top: 20px;
}

.error-info h4,
.details-info h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #303133;
}

.details-info pre {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 200px;
  overflow-y: auto;
}

/* 批量测试对话框样式 */
.batch-test-content {
  padding: 16px 0;
}

.node-selection h4,
.test-results h4 {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #303133;
}

.node-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 12px;
}

.node-checkbox {
  display: block;
  margin: 8px 0;
  width: 100%;
}

.node-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}

.node-info .node-name {
  font-weight: 500;
  min-width: 120px;
}

.node-info .node-address {
  color: #666;
  font-size: 12px;
}

.test-results {
  margin-top: 24px;
  border-top: 1px solid #ebeef5;
  padding-top: 20px;
}

.error-text {
  color: #f56c6c;
  font-size: 12px;
}

.success-text {
  color: #67c23a;
  font-size: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    gap: 12px;
  }
  
  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: flex-start;
  }
  
  .button-group {
    flex-direction: column;
    gap: 4px;
  }
  
  .button-group .el-button {
    width: 100%;
  }
}
</style>
