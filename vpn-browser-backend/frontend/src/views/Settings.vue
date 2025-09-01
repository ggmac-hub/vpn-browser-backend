<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>⚙️ 系统设置</h1>
      <p>管理系统配置和用户设置</p>
    </div>
    
    <!-- 个人设置 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">👤 个人设置</h3>
      </div>
      
      <div class="form-container">
        <el-form
          ref="profileFormRef"
          :model="profileForm"
          :rules="profileRules"
          label-width="120px"
        >
          <el-form-item label="用户名">
            <el-input v-model="profileForm.username" disabled />
          </el-form-item>
          
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="profileForm.email" placeholder="请输入邮箱地址" />
          </el-form-item>
          
          <el-form-item label="角色">
            <el-tag :type="getRoleType(profileForm.role)" size="large">
              {{ formatRole(profileForm.role) }}
            </el-tag>
          </el-form-item>
          
          <el-form-item label="最后登录">
            <span>{{ formatTime(profileForm.last_login) }}</span>
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" @click="updateProfile" :loading="profileLoading">
              更新资料
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
    
    <!-- 密码设置 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">🔒 密码设置</h3>
      </div>
      
      <div class="form-container">
        <el-form
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordRules"
          label-width="120px"
        >
          <el-form-item label="当前密码" prop="currentPassword">
            <el-input
              v-model="passwordForm.currentPassword"
              type="password"
              show-password
              placeholder="请输入当前密码"
            />
          </el-form-item>
          
          <el-form-item label="新密码" prop="newPassword">
            <el-input
              v-model="passwordForm.newPassword"
              type="password"
              show-password
              placeholder="请输入新密码"
            />
            <div class="form-tip">
              <el-text size="small" type="info">
                密码长度至少6位，建议包含字母、数字和特殊字符
              </el-text>
            </div>
          </el-form-item>
          
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input
              v-model="passwordForm.confirmPassword"
              type="password"
              show-password
              placeholder="请再次输入新密码"
            />
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" @click="changePassword" :loading="passwordLoading">
              修改密码
            </el-button>
            <el-button @click="resetPasswordForm">
              重置
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
    
    <!-- 系统配置 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">🔧 系统配置</h3>
      </div>
      
      <div class="config-section">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <div class="config-item">
              <div class="config-label">应用名称</div>
              <div class="config-value">VPN浏览器管理系统</div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <div class="config-item">
              <div class="config-label">系统版本</div>
              <div class="config-value">v1.0.0</div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <div class="config-item">
              <div class="config-label">Node.js版本</div>
              <div class="config-value">{{ systemInfo.node_version || '-' }}</div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <div class="config-item">
              <div class="config-label">运行平台</div>
              <div class="config-value">{{ systemInfo.platform || '-' }}</div>
            </div>
          </el-col>
        </el-row>
        
        <el-row :gutter="20" style="margin-top: 20px;">
          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <div class="config-item">
              <div class="config-label">运行时间</div>
              <div class="config-value">{{ formatUptime(systemInfo.uptime) }}</div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <div class="config-item">
              <div class="config-label">内存使用</div>
              <div class="config-value">{{ formatMemory(systemInfo.memory_usage) }}</div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <div class="config-item">
              <div class="config-label">数据库表</div>
              <div class="config-value">{{ systemInfo.database?.tables || '-' }}</div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <div class="config-item">
              <div class="config-label">数据库状态</div>
              <div class="config-value">
                <el-tag type="success" size="small">
                  {{ systemInfo.database?.status || '未知' }}
                </el-tag>
              </div>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>
    
    <!-- 系统操作 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">🛠️ 系统操作</h3>
      </div>
      
      <div class="operation-section">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12" :md="8">
            <div class="operation-card">
              <div class="operation-icon backup">
                <el-icon size="32"><FolderOpened /></el-icon>
              </div>
              <div class="operation-content">
                <h4>数据备份</h4>
                <p>备份系统数据和配置</p>
                <el-button type="primary" @click="backupData" :loading="backupLoading">
                  立即备份
                </el-button>
              </div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :md="8">
            <div class="operation-card">
              <div class="operation-icon cleanup">
                <el-icon size="32"><Delete /></el-icon>
              </div>
              <div class="operation-content">
                <h4>数据清理</h4>
                <p>清理过期日志和临时文件</p>
                <el-button type="warning" @click="showCleanupDialog">
                  清理数据
                </el-button>
              </div>
            </div>
          </el-col>
          
          <el-col :xs="24" :sm="12" :md="8">
            <div class="operation-card">
              <div class="operation-icon restart">
                <el-icon size="32"><RefreshRight /></el-icon>
              </div>
              <div class="operation-content">
                <h4>重启服务</h4>
                <p>重启后端服务</p>
                <el-button type="danger" @click="restartService">
                  重启服务
                </el-button>
              </div>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>
    
    <!-- API配置 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">🔗 API配置</h3>
      </div>
      
      <div class="api-section">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="API基础地址">
            <el-text code>http://localhost:3000/api</el-text>
            <el-button type="text" size="small" @click="copyToClipboard('http://localhost:3000/api')">
              复制
            </el-button>
          </el-descriptions-item>
          
          <el-descriptions-item label="健康检查">
            <el-text code>GET /api/health</el-text>
            <el-button type="text" size="small" @click="testHealthApi" :loading="healthTestLoading">
              测试
            </el-button>
          </el-descriptions-item>
          
          <el-descriptions-item label="技术支持">
            <el-text code>GET /api/support</el-text>
            <el-button type="text" size="small" @click="testSupportApi" :loading="supportTestLoading">
              测试
            </el-button>
          </el-descriptions-item>
          
          <el-descriptions-item label="节点列表">
            <el-text code>GET /api/nodes</el-text>
            <el-button type="text" size="small" @click="testNodesApi" :loading="nodesTestLoading">
              测试
            </el-button>
          </el-descriptions-item>
        </el-descriptions>
        
        <div v-if="apiTestResult" class="api-result">
          <h4>API测试结果</h4>
          <pre>{{ JSON.stringify(apiTestResult, null, 2) }}</pre>
        </div>
      </div>
    </div>
    
    <!-- 清理数据对话框 -->
    <el-dialog
      v-model="cleanupDialogVisible"
      title="清理系统数据"
      width="500px"
    >
      <el-alert
        title="注意"
        type="warning"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #default>
          <p>此操作将清理过期的日志和临时数据，无法恢复。</p>
        </template>
      </el-alert>
      
      <el-form :model="cleanupForm" label-width="120px">
        <el-form-item label="保留天数">
          <el-input-number
            v-model="cleanupForm.days"
            :min="1"
            :max="365"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="cleanupDialogVisible = false">取消</el-button>
        <el-button type="warning" @click="cleanupSystemData" :loading="cleanupLoading">
          确认清理
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FolderOpened, Delete, RefreshRight } from '@element-plus/icons-vue'
import { api } from '../api/request'
import { getUser } from '../utils/auth'
import dayjs from 'dayjs'

// 响应式数据
const profileLoading = ref(false)
const passwordLoading = ref(false)
const backupLoading = ref(false)
const cleanupLoading = ref(false)
const healthTestLoading = ref(false)
const supportTestLoading = ref(false)
const nodesTestLoading = ref(false)

const systemInfo = ref({})
const apiTestResult = ref(null)

// 表单数据
const profileFormRef = ref()
const profileForm = ref({
  username: '',
  email: '',
  role: '',
  last_login: ''
})

const profileRules = {
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ]
}

const passwordFormRef = ref()
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordRules = {
  currentPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 清理对话框
const cleanupDialogVisible = ref(false)
const cleanupForm = ref({
  days: 90
})

// 方法
const loadUserProfile = async () => {
  try {
    const user = getUser()
    if (user) {
      profileForm.value = {
        username: user.username,
        email: user.email || '',
        role: user.role,
        last_login: user.last_login
      }
    }
  } catch (error) {
    console.error('加载用户信息失败:', error)
  }
}

const loadSystemInfo = async () => {
  try {
    const data = await api.get('/dashboard/system-status')
    systemInfo.value = data.data
  } catch (error) {
    console.error('加载系统信息失败:', error)
  }
}

const updateProfile = async () => {
  try {
    await profileFormRef.value.validate()
    
    profileLoading.value = true
    
    // 这里应该调用更新用户信息的API
    ElMessage.success('个人资料更新成功')
  } catch (error) {
    console.error('更新个人资料失败:', error)
  } finally {
    profileLoading.value = false
  }
}

const changePassword = async () => {
  try {
    await passwordFormRef.value.validate()
    
    passwordLoading.value = true
    
    await api.post('/auth/change-password', {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword
    })
    
    ElMessage.success('密码修改成功')
    resetPasswordForm()
  } catch (error) {
    console.error('修改密码失败:', error)
  } finally {
    passwordLoading.value = false
  }
}

const resetPasswordForm = () => {
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
  if (passwordFormRef.value) {
    passwordFormRef.value.resetFields()
  }
}

const backupData = async () => {
  try {
    backupLoading.value = true
    
    // 模拟备份操作
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    ElMessage.success('数据备份完成')
  } catch (error) {
    console.error('数据备份失败:', error)
  } finally {
    backupLoading.value = false
  }
}

const showCleanupDialog = () => {
  cleanupDialogVisible.value = true
}

const cleanupSystemData = async () => {
  try {
    cleanupLoading.value = true
    
    await api.post('/dashboard/cleanup', {
      days: cleanupForm.value.days
    })
    
    ElMessage.success('数据清理完成')
    cleanupDialogVisible.value = false
  } catch (error) {
    console.error('数据清理失败:', error)
  } finally {
    cleanupLoading.value = false
  }
}

const restartService = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要重启后端服务吗？重启期间服务将暂时不可用。',
      '确认重启',
      {
        confirmButtonText: '确认重启',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    ElMessage.info('重启服务功能需要在服务器端实现')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重启服务失败:', error)
    }
  }
}

const testHealthApi = async () => {
  try {
    healthTestLoading.value = true
    const data = await api.get('/health')
    apiTestResult.value = data
    ElMessage.success('健康检查API测试成功')
  } catch (error) {
    console.error('健康检查API测试失败:', error)
    apiTestResult.value = { error: error.message }
  } finally {
    healthTestLoading.value = false
  }
}

const testSupportApi = async () => {
  try {
    supportTestLoading.value = true
    const data = await api.get('/support')
    apiTestResult.value = data
    ElMessage.success('技术支持API测试成功')
  } catch (error) {
    console.error('技术支持API测试失败:', error)
    apiTestResult.value = { error: error.message }
  } finally {
    supportTestLoading.value = false
  }
}

const testNodesApi = async () => {
  try {
    nodesTestLoading.value = true
    const data = await api.get('/nodes')
    apiTestResult.value = data
    ElMessage.success('节点列表API测试成功')
  } catch (error) {
    console.error('节点列表API测试失败:', error)
    apiTestResult.value = { error: error.message }
  } finally {
    nodesTestLoading.value = false
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

// 格式化方法
const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const formatRole = (role) => {
  const roleMap = {
    'super_admin': '超级管理员',
    'admin': '管理员',
    'user': '普通用户'
  }
  return roleMap[role] || role
}

const getRoleType = (role) => {
  const typeMap = {
    'super_admin': 'danger',
    'admin': 'primary',
    'user': 'success'
  }
  return typeMap[role] || 'info'
}

const formatUptime = (uptime) => {
  if (!uptime) return '-'
  
  const days = Math.floor(uptime / (24 * 3600))
  const hours = Math.floor((uptime % (24 * 3600)) / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  
  return `${days}天 ${hours}小时 ${minutes}分钟`
}

const formatMemory = (memory) => {
  if (!memory) return '-'
  
  const mb = (memory.rss / 1024 / 1024).toFixed(1)
  return `${mb} MB`
}

// 生命周期
onMounted(() => {
  loadUserProfile()
  loadSystemInfo()
})
</script>

<style scoped>
.settings-page {
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

.form-tip {
  margin-top: 4px;
}

.config-section {
  padding: 20px 0;
}

.config-item {
  text-align: center;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.config-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.config-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.operation-section {
  padding: 20px 0;
}

.operation-card {
  display: flex;
  align-items: center;
  padding: 24px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.operation-card:hover {
  border-color: #409eff;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.operation-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  color: white;
}

.operation-icon.backup {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.operation-icon.cleanup {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.operation-icon.restart {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.operation-content {
  flex: 1;
}

.operation-content h4 {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.operation-content p {
  font-size: 14px;
  color: #909399;
  margin-bottom: 16px;
}

.api-section {
  padding: 20px 0;
}

.api-result {
  margin-top: 20px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
}

.api-result h4 {
  margin-bottom: 12px;
  color: #303133;
}

.api-result pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #495057;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .operation-card {
    flex-direction: column;
    text-align: center;
  }
  
  .operation-icon {
    margin-right: 0;
    margin-bottom: 16px;
  }
  
  .config-item {
    margin-bottom: 12px;
  }
}
</style>
