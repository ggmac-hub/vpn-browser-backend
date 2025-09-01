<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <div class="logo">
          <el-icon size="48" color="#409eff">
            <Connection />
          </el-icon>
        </div>
        <h2 class="title">VPN浏览器管理后台</h2>
        <p class="subtitle">欢迎登录管理系统</p>
      </div>
      
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            size="large"
            :prefix-icon="User"
            clearable
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            :prefix-icon="Lock"
            show-password
            clearable
          />
        </el-form-item>
        
        <el-form-item>
          <el-checkbox v-model="loginForm.remember">
            记住我
          </el-checkbox>
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登录' }}
          </el-button>
        </el-form-item>
      </el-form>
      
      <div class="login-footer">
        <div class="tips">
          <el-alert
            title="默认账号信息"
            type="info"
            :closable="false"
            show-icon
          >
            <template #default>
              <p>用户名: <strong>admin</strong></p>
              <p>密码: <strong>admin123</strong></p>
              <p class="warning-text">⚠️ 首次登录后请立即修改密码</p>
            </template>
          </el-alert>
        </div>
        
        <div class="copyright">
          <p>&copy; 2024 VPN浏览器管理系统. All rights reserved.</p>
        </div>
      </div>
    </div>
    
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, Connection } from '@element-plus/icons-vue'
import { setToken, setUser } from '../utils/auth'
import { api } from '../api/request'

const router = useRouter()

// 响应式数据
const loading = ref(false)
const loginFormRef = ref()

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度在2到20个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

// 方法
const handleLogin = async () => {
  try {
    // 表单验证
    await loginFormRef.value.validate()
    
    loading.value = true
    
    // 发送登录请求
    const response = await api.post('/auth/login', {
      username: loginForm.username,
      password: loginForm.password
    })
    
    // 保存token和用户信息
    setToken(response.token)
    setUser(response.user)
    
    ElMessage.success('登录成功')
    
    // 跳转到仪表板
    router.push('/dashboard')
    
  } catch (error) {
    console.error('登录失败:', error)
    // 错误信息已在请求拦截器中处理
  } finally {
    loading.value = false
  }
}

// 自动填充演示账号
const fillDemoAccount = () => {
  loginForm.username = 'admin'
  loginForm.password = 'admin123'
}

// 页面加载时自动填充演示账号（开发环境）
if (process.env.NODE_ENV === 'development') {
  fillDemoAccount()
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.login-box {
  width: 400px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  position: relative;
  z-index: 10;
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  margin-bottom: 20px;
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.login-form {
  margin-bottom: 30px;
}

.login-form .el-form-item {
  margin-bottom: 24px;
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
}

.login-footer {
  margin-top: 30px;
}

.tips {
  margin-bottom: 20px;
}

.tips .el-alert {
  border-radius: 8px;
}

.tips p {
  margin: 4px 0;
  font-size: 13px;
}

.warning-text {
  color: #e6a23c;
  font-weight: 500;
}

.copyright {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.copyright p {
  font-size: 12px;
  color: #909399;
  margin: 0;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  animation: float 6s ease-in-out infinite;
}

.circle-1 {
  width: 200px;
  height: 200px;
  top: 10%;
  left: 10%;
  animation-delay: 0s;
}

.circle-2 {
  width: 150px;
  height: 150px;
  top: 60%;
  right: 10%;
  animation-delay: 2s;
}

.circle-3 {
  width: 100px;
  height: 100px;
  bottom: 20%;
  left: 20%;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .login-box {
    width: 90%;
    padding: 30px 20px;
  }
  
  .title {
    font-size: 20px;
  }
  
  .login-btn {
    height: 44px;
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .login-container {
    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  }
}
</style>
