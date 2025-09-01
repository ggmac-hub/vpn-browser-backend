<template>
  <div class="tech-support-page">
    <div class="page-header">
      <h1>🛠️ 技术支持管理</h1>
      <p>配置客户端显示的技术支持联系方式，修改后会实时更新到所有客户端</p>
    </div>
    
    <!-- 当前配置预览 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">📱 客户端显示预览</h3>
        <el-button type="primary" @click="loadCurrentConfig" :icon="Refresh" :loading="loading">
          刷新
        </el-button>
      </div>
      
      <div class="preview-section">
        <div class="preview-card">
          <div class="preview-header">
            <el-icon size="24" color="#409eff"><Service /></el-icon>
            <span class="preview-title">技术支持</span>
          </div>
          
          <div class="preview-content">
            <div v-if="currentConfig.qq" class="contact-item">
              <el-icon><ChatDotRound /></el-icon>
              <span class="contact-label">QQ:</span>
              <span class="contact-value">{{ currentConfig.qq }}</span>
              <el-button type="text" size="small" @click="copyToClipboard(currentConfig.qq)">
                复制
              </el-button>
            </div>
            
            <div v-if="currentConfig.wechat" class="contact-item">
              <el-icon><Message /></el-icon>
              <span class="contact-label">微信:</span>
              <span class="contact-value">{{ currentConfig.wechat }}</span>
              <el-button type="text" size="small" @click="copyToClipboard(currentConfig.wechat)">
                复制
              </el-button>
            </div>
            
            <div class="contact-item">
              <el-icon><Clock /></el-icon>
              <span class="contact-label">服务时间:</span>
              <span class="contact-value">{{ currentConfig.support_hours || '工作日 9:00-18:00 (北京时间)' }}</span>
            </div>
          </div>
          
          <div class="preview-footer">
            <el-text size="small" type="info">
              最后更新: {{ formatTime(currentConfig.updated_at) }}
            </el-text>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 配置表单 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">⚙️ 编辑技术支持信息</h3>
      </div>
      
      <div class="form-container">
        <el-form
          ref="configFormRef"
          :model="configForm"
          :rules="configRules"
          label-width="120px"
        >
          <el-form-item label="QQ号" prop="qq">
            <el-input
              v-model="configForm.qq"
              placeholder="请输入QQ号"
              clearable
            >
              <template #prepend>
                <el-icon><ChatDotRound /></el-icon>
              </template>
            </el-input>
            <div class="form-tip">
              <el-text size="small" type="info">
                客户端用户可以通过此QQ号联系技术支持
              </el-text>
            </div>
          </el-form-item>
          
          <el-form-item label="微信号" prop="wechat">
            <el-input
              v-model="configForm.wechat"
              placeholder="请输入微信号"
              clearable
            >
              <template #prepend>
                <el-icon><Message /></el-icon>
              </template>
            </el-input>
            <div class="form-tip">
              <el-text size="small" type="info">
                客户端用户可以通过此微信号联系技术支持
              </el-text>
            </div>
          </el-form-item>
          
          <el-form-item label="服务时间" prop="support_hours">
            <el-input
              v-model="configForm.support_hours"
              placeholder="例如：工作日 9:00-18:00 (北京时间)"
              clearable
            >
              <template #prepend>
                <el-icon><Clock /></el-icon>
              </template>
            </el-input>
            <div class="form-tip">
              <el-text size="small" type="info">
                告知用户技术支持的服务时间
              </el-text>
            </div>
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" @click="saveConfig" :loading="saveLoading" size="large">
              保存配置
            </el-button>
            <el-button @click="resetForm" size="large">
              重置
            </el-button>
            <el-button @click="testConfig" :icon="View" size="large">
              预览效果
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
    
    <!-- 使用统计 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">📊 配置历史</h3>
      </div>
      
      <el-table :data="configHistory" v-loading="historyLoading" stripe>
        <el-table-column prop="qq" label="QQ号" width="120">
          <template #default="{ row }">
            <span v-if="row.qq">{{ row.qq }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="wechat" label="微信号" width="150">
          <template #default="{ row }">
            <span v-if="row.wechat">{{ row.wechat }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="support_hours" label="服务时间" min-width="200" />
        
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="is_active" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '当前' : '历史' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button 
              v-if="!row.is_active" 
              type="text" 
              size="small" 
              @click="restoreConfig(row)"
            >
              恢复
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 空状态 -->
      <div v-if="!historyLoading && configHistory.length === 0" class="empty-state">
        <el-empty description="暂无历史记录" :image-size="80" />
      </div>
    </div>
    
    <!-- API测试 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">🔗 API测试</h3>
        <el-text size="small" type="info">
          客户端通过此API获取技术支持信息
        </el-text>
      </div>
      
      <div class="api-test-section">
        <div class="api-info">
          <el-text tag="b">API地址:</el-text>
          <el-text code>GET /api/support</el-text>
          <el-button type="text" @click="copyToClipboard('http://localhost:3000/api/support')">
            复制链接
          </el-button>
        </div>
        
        <div class="api-actions">
          <el-button @click="testApi" :loading="apiTestLoading" :icon="Link">
            测试API
          </el-button>
        </div>
        
        <div v-if="apiTestResult" class="api-result">
          <el-text tag="b">API响应:</el-text>
          <pre>{{ JSON.stringify(apiTestResult, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Service, ChatDotRound, Message, Clock, Refresh, 
  View, Link 
} from '@element-plus/icons-vue'
import { api } from '../api/request'
import dayjs from 'dayjs'

// 响应式数据
const loading = ref(false)
const saveLoading = ref(false)
const historyLoading = ref(false)
const apiTestLoading = ref(false)

const currentConfig = ref({})
const configHistory = ref([])
const apiTestResult = ref(null)

// 表单数据
const configFormRef = ref()
const configForm = ref({
  qq: '',
  wechat: '',
  support_hours: '工作日 9:00-18:00 (北京时间)'
})

const configRules = {
  qq: [
    { pattern: /^\d{5,12}$/, message: 'QQ号应为5-12位数字', trigger: 'blur' }
  ],
  wechat: [
    { pattern: /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/, message: '微信号格式不正确（6-20位，字母开头）', trigger: 'blur' }
  ],
  support_hours: [
    { required: true, message: '请输入服务时间', trigger: 'blur' }
  ]
}

// 方法
const loadCurrentConfig = async () => {
  try {
    loading.value = true
    const data = await api.get('/support')
    currentConfig.value = data
    
    // 填充表单
    configForm.value = {
      qq: data.qq || '',
      wechat: data.wechat || '',
      support_hours: data.support_hours || '工作日 9:00-18:00 (北京时间)'
    }
  } catch (error) {
    console.error('加载技术支持配置失败:', error)
  } finally {
    loading.value = false
  }
}

const loadConfigHistory = async () => {
  try {
    historyLoading.value = true
    const data = await api.get('/support/history')
    configHistory.value = data.data || []
  } catch (error) {
    console.error('加载配置历史失败:', error)
  } finally {
    historyLoading.value = false
  }
}

const saveConfig = async () => {
  try {
    await configFormRef.value.validate()
    
    saveLoading.value = true
    
    await api.put('/support', configForm.value)
    
    ElMessage.success('技术支持信息保存成功')
    
    // 重新加载配置
    loadCurrentConfig()
    loadConfigHistory()
  } catch (error) {
    console.error('保存技术支持配置失败:', error)
  } finally {
    saveLoading.value = false
  }
}

const resetForm = () => {
  configForm.value = {
    qq: currentConfig.value.qq || '',
    wechat: currentConfig.value.wechat || '',
    support_hours: currentConfig.value.support_hours || '工作日 9:00-18:00 (北京时间)'
  }
  if (configFormRef.value) {
    configFormRef.value.clearValidate()
  }
}

const testConfig = () => {
  // 更新预览
  const tempConfig = { ...configForm.value }
  ElMessage.success('预览已更新，请查看上方预览区域')
  
  // 临时更新预览（不保存）
  const originalConfig = { ...currentConfig.value }
  currentConfig.value = {
    ...originalConfig,
    ...tempConfig,
    updated_at: new Date().toISOString()
  }
  
  // 3秒后恢复
  setTimeout(() => {
    currentConfig.value = originalConfig
  }, 3000)
}

const restoreConfig = async (config) => {
  try {
    const restoreData = {
      qq: config.qq || '',
      wechat: config.wechat || '',
      support_hours: config.support_hours || '工作日 9:00-18:00 (北京时间)'
    }
    
    await api.put('/support', restoreData)
    
    ElMessage.success('配置恢复成功')
    loadCurrentConfig()
    loadConfigHistory()
  } catch (error) {
    console.error('恢复配置失败:', error)
  }
}

const testApi = async () => {
  try {
    apiTestLoading.value = true
    const data = await api.get('/support')
    apiTestResult.value = data
    ElMessage.success('API测试成功')
  } catch (error) {
    console.error('API测试失败:', error)
    apiTestResult.value = { error: error.message }
  } finally {
    apiTestLoading.value = false
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败，请手动复制')
  }
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

// 生命周期
onMounted(() => {
  loadCurrentConfig()
  loadConfigHistory()
})
</script>

<style scoped>
.tech-support-page {
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

.preview-section {
  padding: 20px 0;
}

.preview-card {
  max-width: 400px;
  margin: 0 auto;
  border: 2px dashed #e4e7ed;
  border-radius: 12px;
  padding: 24px;
  background: #fafafa;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.preview-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.preview-content {
  margin-bottom: 20px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 0;
}

.contact-label {
  font-weight: 500;
  color: #606266;
  min-width: 60px;
}

.contact-value {
  flex: 1;
  color: #303133;
}

.preview-footer {
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
  text-align: center;
}

.form-tip {
  margin-top: 4px;
}

.text-muted {
  color: #c0c4cc;
}

.api-test-section {
  padding: 20px 0;
}

.api-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.api-actions {
  margin-bottom: 20px;
}

.api-result {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
}

.api-result pre {
  margin: 8px 0 0 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #495057;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .preview-card {
    max-width: 100%;
  }
  
  .contact-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .contact-label {
    min-width: auto;
  }
  
  .api-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
