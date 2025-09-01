<template>
  <div class="user-login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <el-icon size="48" color="#409EFF"><Connection /></el-icon>
        </div>
        <h1>VPN浏览器</h1>
        <p>登录您的账户</p>
      </div>

      <el-tabs v-model="activeTab" class="login-tabs">
        <!-- 登录标签页 -->
        <el-tab-pane label="登录" name="login">
          <el-form
            :model="loginForm"
            :rules="loginRules"
            ref="loginFormRef"
            class="login-form"
            @submit.prevent="handleLogin"
          >
            <el-form-item prop="username">
              <el-input
                v-model="loginForm.username"
                placeholder="用户名或手机号"
                size="large"
                prefix-icon="User"
                clearable
              />
            </el-form-item>
            
            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="密码"
                size="large"
                prefix-icon="Lock"
                show-password
                clearable
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            
            <el-form-item>
              <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
              <el-button type="text" class="forgot-password">忘记密码？</el-button>
            </el-form-item>
            
            <el-form-item>
              <el-button
                type="primary"
                size="large"
                class="login-button"
                :loading="loginLoading"
                @click="handleLogin"
              >
                登录
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 注册标签页 -->
        <el-tab-pane label="注册" name="register">
          <el-form
            :model="registerForm"
            :rules="registerRules"
            ref="registerFormRef"
            class="register-form"
            @submit.prevent="handleRegister"
          >
            <el-form-item prop="username">
              <el-input
                v-model="registerForm.username"
                placeholder="用户名"
                size="large"
                prefix-icon="User"
                clearable
              />
            </el-form-item>
            
            <el-form-item prop="phone">
              <el-input
                v-model="registerForm.phone"
                placeholder="手机号"
                size="large"
                prefix-icon="Phone"
                clearable
              />
            </el-form-item>
            
            <el-form-item prop="password">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="密码"
                size="large"
                prefix-icon="Lock"
                show-password
                clearable
              />
            </el-form-item>
            
            <el-form-item prop="confirmPassword">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="确认密码"
                size="large"
                prefix-icon="Lock"
                show-password
                clearable
              />
            </el-form-item>
            
            <el-form-item prop="referralCode">
              <el-input
                v-model="registerForm.referralCode"
                placeholder="邀请码（必填）- 如无邀请码请联系服务商"
                size="large"
                prefix-icon="Gift"
                clearable
              />
            </el-form-item>
            
            <el-form-item>
              <el-checkbox v-model="registerForm.agree">
                我已阅读并同意
                <el-button type="text" @click="showTerms">《用户协议》</el-button>
                和
                <el-button type="text" @click="showPrivacy">《隐私政策》</el-button>
              </el-checkbox>
            </el-form-item>
            
            <el-form-item>
              <el-button
                type="primary"
                size="large"
                class="register-button"
                :loading="registerLoading"
                @click="handleRegister"
              >
                注册
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="login-footer">
        <p>© 2024 VPN浏览器. 保留所有权利.</p>
      </div>
    </div>

    <!-- 用户协议对话框 -->
    <el-dialog v-model="termsVisible" title="用户协议" width="600px">
      <div class="terms-content">
        <h3>1. 服务条款</h3>
        <p>欢迎使用VPN浏览器服务。使用本服务即表示您同意遵守以下条款。</p>
        
        <h3>2. 用户责任</h3>
        <p>用户应合法使用本服务，不得用于任何违法活动。</p>
        
        <h3>3. 隐私保护</h3>
        <p>我们承诺保护用户隐私，不会泄露用户个人信息。</p>
        
        <h3>4. 服务变更</h3>
        <p>我们保留随时修改或终止服务的权利。</p>
      </div>
    </el-dialog>

    <!-- 隐私政策对话框 -->
    <el-dialog v-model="privacyVisible" title="隐私政策" width="600px">
      <div class="privacy-content">
        <h3>1. 信息收集</h3>
        <p>我们仅收集必要的用户信息以提供服务。</p>
        
        <h3>2. 信息使用</h3>
        <p>收集的信息仅用于改善服务质量。</p>
        
        <h3>3. 信息保护</h3>
        <p>我们采用行业标准的安全措施保护用户信息。</p>
        
        <h3>4. 第三方分享</h3>
        <p>除法律要求外，我们不会与第三方分享用户信息。</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Connection } from '@element-plus/icons-vue'
import request from '../api/request'
import { setToken, setUser } from '../utils/auth'

const router = useRouter()

// 响应式数据
const activeTab = ref('login')
const loginLoading = ref(false)
const registerLoading = ref(false)
const termsVisible = ref(false)
const privacyVisible = ref(false)

// 表单数据
const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const registerForm = reactive({
  username: '',
  phone: '',
  password: '',
  confirmPassword: '',
  referralCode: '',
  agree: false
})

// 表单引用
const loginFormRef = ref()
const registerFormRef = ref()

// 表单验证规则
const loginRules = {
  username: [
    { required: true, message: '请输入用户名或手机号', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const registerRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== registerForm.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  referralCode: [
    { required: true, message: '请输入邀请码，如无邀请码请联系服务商提供', trigger: 'blur' },
    { min: 3, message: '邀请码长度至少3个字符', trigger: 'blur' }
  ]
}

// 方法
const handleLogin = async () => {
  try {
    await loginFormRef.value.validate()
    
    loginLoading.value = true
    
    // 生成设备ID（在实际应用中，Android端会传递真实的设备ID）
    const deviceId = 'web-' + Date.now()
    
    const response = await request.post('/membership/login', {
      username: loginForm.username,
      password: loginForm.password,
      deviceId: deviceId,
      deviceInfo: navigator.userAgent
    })
    
    if (response.token) {
      // 保存token和用户信息
      setToken(response.token)
      setUser(response.user)
      
      ElMessage.success(response.message || '登录成功')
      
      // 跳转到用户仪表板
      router.push('/user/dashboard')
    }
  } catch (error) {
    console.error('登录失败:', error)
    ElMessage.error(error.response?.data?.error || '登录失败')
  } finally {
    loginLoading.value = false
  }
}

const handleRegister = async () => {
  try {
    await registerFormRef.value.validate()
    
    if (!registerForm.referralCode || registerForm.referralCode.trim() === '') {
      ElMessage.error('请输入邀请码，如无邀请码请联系服务商提供')
      return
    }
    
    if (!registerForm.agree) {
      ElMessage.warning('请先同意用户协议和隐私政策')
      return
    }
    
    registerLoading.value = true
    
    const response = await request.post('/membership/register', {
      username: registerForm.username,
      password: registerForm.password,
      phone: registerForm.phone,
      referralCode: registerForm.referralCode
    })
    
    if (response.message) {
      ElMessage.success(response.message || '注册成功，请登录')
      
      // 切换到登录标签页并填入用户名
      activeTab.value = 'login'
      loginForm.username = registerForm.username
      
      // 清空注册表单
      registerForm.username = ''
      registerForm.phone = ''
      registerForm.password = ''
      registerForm.confirmPassword = ''
      registerForm.referralCode = ''
      registerForm.agree = false
    }
  } catch (error) {
    console.error('注册失败:', error)
    ElMessage.error(error.response?.data?.error || '注册失败')
  } finally {
    registerLoading.value = false
  }
}

const showTerms = () => {
  termsVisible.value = true
}

const showPrivacy = () => {
  privacyVisible.value = true
}

// 检查URL参数中的推荐码
onMounted(() => {
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const referralCode = urlParams.get('ref')
    if (referralCode) {
      registerForm.referralCode = referralCode
      activeTab.value = 'register'
    }
  } catch (error) {
    console.error('初始化页面失败:', error)
  }
})
</script>

<style scoped>
.user-login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 400px;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  margin-bottom: 16px;
}

.login-header h1 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 28px;
  font-weight: bold;
}

.login-header p {
  margin: 0;
  color: #909399;
  font-size: 16px;
}

.login-tabs {
  margin-bottom: 20px;
}

.login-form,
.register-form {
  margin-top: 20px;
}

.login-button,
.register-button {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: bold;
}

.forgot-password {
  float: right;
  padding: 0;
  font-size: 14px;
}

.login-footer {
  text-align: center;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.login-footer p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.terms-content,
.privacy-content {
  line-height: 1.6;
}

.terms-content h3,
.privacy-content h3 {
  color: #303133;
  margin: 20px 0 10px 0;
}

.terms-content p,
.privacy-content p {
  color: #606266;
  margin: 0 0 16px 0;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .login-card {
    padding: 24px;
    margin: 10px;
  }
  
  .login-header h1 {
    font-size: 24px;
  }
}
</style>
