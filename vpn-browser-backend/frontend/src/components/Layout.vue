<template>
  <el-container class="layout-container">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '240px'" class="sidebar">
      <div class="logo">
        <el-icon v-if="!isCollapse" class="logo-icon" size="24">
          <Connection />
        </el-icon>
        <span v-if="!isCollapse" class="logo-text">VPN管理后台</span>
        <el-icon v-else class="logo-icon" size="24">
          <Connection />
        </el-icon>
      </div>
      
      <el-menu
        :default-active="$route.path"
        :collapse="isCollapse"
        :unique-opened="true"
        router
        class="sidebar-menu"
      >
        <el-menu-item
          v-for="route in menuRoutes"
          :key="route.path"
          :index="route.path"
        >
          <el-icon>
            <component :is="route.meta.icon" />
          </el-icon>
          <template #title>{{ route.meta.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <!-- 主内容区 -->
    <el-container class="main-container">
      <!-- 顶部导航 -->
      <el-header class="header">
        <div class="header-left">
          <el-button
            type="text"
            @click="toggleSidebar"
            class="collapse-btn"
          >
            <el-icon size="20">
              <Expand v-if="isCollapse" />
              <Fold v-else />
            </el-icon>
          </el-button>
          
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentRoute.meta.title">
              {{ currentRoute.meta.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <!-- 系统状态 -->
          <el-tooltip content="系统状态" placement="bottom">
            <el-badge
              :value="systemStatus.health_score"
              :type="getStatusType(systemStatus.health_status)"
              class="status-badge"
            >
              <el-button type="text" @click="showSystemStatus">
                <el-icon size="18">
                  <Monitor />
                </el-icon>
              </el-button>
            </el-badge>
          </el-tooltip>
          
          <!-- 刷新 -->
          <el-tooltip content="刷新页面" placement="bottom">
            <el-button type="text" @click="refreshPage">
              <el-icon size="18">
                <Refresh />
              </el-icon>
            </el-button>
          </el-tooltip>
          
          <!-- 用户菜单 -->
          <el-dropdown @command="handleUserCommand" class="user-dropdown">
            <span class="user-info">
              <el-avatar :size="32" class="user-avatar">
                <el-icon><User /></el-icon>
              </el-avatar>
              <span class="username">{{ user.username }}</span>
              <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  个人资料
                </el-dropdown-item>
                <el-dropdown-item command="changePassword">
                  <el-icon><Lock /></el-icon>
                  修改密码
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      
      <!-- 主内容 -->
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
    
    <!-- 系统状态弹窗 -->
    <el-dialog
      v-model="statusDialogVisible"
      title="系统状态"
      width="600px"
    >
      <div class="system-status">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="status-item">
              <div class="status-label">服务器运行时间</div>
              <div class="status-value">{{ formatUptime(systemStatus.server?.uptime) }}</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="status-item">
              <div class="status-label">节点健康度</div>
              <div class="status-value">
                <el-tag :type="getStatusType(systemStatus.nodes?.health_status)">
                  {{ systemStatus.nodes?.health_score }}%
                </el-tag>
              </div>
            </div>
          </el-col>
        </el-row>
        
        <el-row :gutter="20" style="margin-top: 20px;">
          <el-col :span="8">
            <div class="status-item">
              <div class="status-label">总节点数</div>
              <div class="status-value">{{ systemStatus.nodes?.total || 0 }}</div>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="status-item">
              <div class="status-label">在线节点</div>
              <div class="status-value text-success">{{ systemStatus.nodes?.online || 0 }}</div>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="status-item">
              <div class="status-label">离线节点</div>
              <div class="status-value text-danger">{{ systemStatus.nodes?.offline || 0 }}</div>
            </div>
          </el-col>
        </el-row>
      </div>
    </el-dialog>
    
    <!-- 修改密码弹窗 -->
    <el-dialog
      v-model="passwordDialogVisible"
      title="修改密码"
      width="400px"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
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
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleChangePassword" :loading="passwordLoading">
          确定
        </el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUser, clearAuth } from '../utils/auth'
import { api } from '../api/request'

const route = useRoute()
const router = useRouter()

// 响应式数据
const isCollapse = ref(false)
const statusDialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const passwordLoading = ref(false)
const systemStatus = ref({})
const statusTimer = ref(null)

// 用户信息
const user = ref(getUser() || {})

// 密码表单
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

// 计算属性
const currentRoute = computed(() => route)

const menuRoutes = computed(() => {
  return router.getRoutes()
    .find(r => r.name === 'Layout')
    ?.children?.filter(child => child.meta?.title) || []
})

// 方法
const toggleSidebar = () => {
  isCollapse.value = !isCollapse.value
}

const refreshPage = () => {
  window.location.reload()
}

const getStatusType = (status) => {
  const statusMap = {
    'excellent': 'success',
    'good': 'success',
    'warning': 'warning',
    'critical': 'danger'
  }
  return statusMap[status] || 'info'
}

const formatUptime = (uptime) => {
  if (!uptime) return '未知'
  
  const days = Math.floor(uptime / (24 * 3600))
  const hours = Math.floor((uptime % (24 * 3600)) / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  
  return `${days}天 ${hours}小时 ${minutes}分钟`
}

const showSystemStatus = async () => {
  try {
    const data = await api.get('/dashboard/system-status')
    systemStatus.value = data.data
    statusDialogVisible.value = true
  } catch (error) {
    console.error('获取系统状态失败:', error)
  }
}

const loadSystemStatus = async () => {
  try {
    const data = await api.get('/dashboard/system-status')
    systemStatus.value = data.data
  } catch (error) {
    console.error('加载系统状态失败:', error)
  }
}

const handleUserCommand = (command) => {
  switch (command) {
    case 'profile':
      // 个人资料功能
      ElMessage.info('个人资料功能开发中')
      break
    case 'changePassword':
      passwordDialogVisible.value = true
      break
    case 'logout':
      handleLogout()
      break
  }
}

const handleChangePassword = async () => {
  try {
    await passwordFormRef.value.validate()
    
    passwordLoading.value = true
    
    await api.post('/auth/change-password', {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword
    })
    
    ElMessage.success('密码修改成功')
    passwordDialogVisible.value = false
    
    // 重置表单
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  } catch (error) {
    console.error('修改密码失败:', error)
  } finally {
    passwordLoading.value = false
  }
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await api.post('/auth/logout')
    clearAuth()
    router.push('/login')
    ElMessage.success('已退出登录')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('退出登录失败:', error)
    }
  }
}

// 生命周期
onMounted(() => {
  loadSystemStatus()
  
  // 定时更新系统状态
  statusTimer.value = setInterval(loadSystemStatus, 30000) // 30秒更新一次
})

onUnmounted(() => {
  if (statusTimer.value) {
    clearInterval(statusTimer.value)
  }
})
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  transition: width 0.3s;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  background-color: #2b3a4b;
  gap: 12px;
}



.logo-text {
  color: white;
  font-size: 16px;
  font-weight: 600;
}

.logo-icon {
  color: white;
}

.sidebar-menu {
  border: none;
  background-color: transparent;
}

.sidebar-menu .el-menu-item {
  color: #bfcbd9;
  border-bottom: 1px solid #434a50;
}

.sidebar-menu .el-menu-item:hover {
  background-color: #434a50;
  color: #409eff;
}

.sidebar-menu .el-menu-item.is-active {
  background-color: #409eff;
  color: white;
}

.main-container {
  background-color: #f5f7fa;
}

.header {
  background-color: white;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.collapse-btn {
  padding: 0;
  color: #606266;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-badge {
  margin-right: 8px;
}

.user-dropdown {
  cursor: pointer;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606266;
}

.user-avatar {
  background-color: #409eff;
}

.username {
  font-size: 14px;
}

.dropdown-icon {
  font-size: 12px;
}

.main-content {
  padding: 20px;
  overflow-y: auto;
}

.system-status {
  padding: 20px 0;
}

.status-item {
  text-align: center;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.status-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.status-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.text-success {
  color: #67c23a;
}

.text-danger {
  color: #f56c6c;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
