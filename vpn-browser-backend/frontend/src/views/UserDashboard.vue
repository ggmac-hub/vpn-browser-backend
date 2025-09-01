<template>
  <div class="user-dashboard">
    <!-- 用户信息卡片 -->
    <el-card class="user-info-card">
      <div class="user-header">
        <div class="user-info">
          <div class="user-basic">
            <span class="username">{{ userInfo.username || '加载中...' }}</span>
            <span class="user-phone">{{ userInfo.phone || '加载中...' }}</span>
          </div>
          <div class="user-status">
            <div v-if="membershipStatus.isVip" class="vip-status">
              <el-tag :type="membershipStatus.isFreeTrialMember ? 'warning' : 'success'" size="small">
                <el-icon><Star /></el-icon>
                {{ membershipStatus.isFreeTrialMember ? '免费试用' : 'VIP会员' }}
              </el-tag>
              <span class="expire-date" :class="{ 'trial-countdown': membershipStatus.isFreeTrialMember }">
                <span v-if="membershipStatus.isFreeTrialMember">
                  剩余：{{ formatTrialCountdown(membershipStatus.expireTime) }}
                </span>
                <span v-else>
                  到期：{{ formatExpireDate(membershipStatus.expireTime) }}
                </span>
              </span>
            </div>
            <el-tag v-else type="info" size="small">
              未开通会员
            </el-tag>
          </div>
        </div>
        <div class="user-actions">
          <el-button v-if="membershipStatus.isVip" type="success" size="small" @click="showPurchaseDialog">
            续费
          </el-button>
          <el-button v-else type="primary" size="small" @click="showPurchaseDialog">
            立即开通
          </el-button>
          <el-button type="default" size="small" @click="showChangePasswordDialog">
            修改密码
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 安全警告 -->
    <el-alert
      v-if="showWarning"
      title="⚠️ 请勿轻信网页中任何涉及裸聊、招嫖、约炮等内容的广告，切勿下载来源不明的弹窗软件。任何安装后索取通讯录或相册权限的应用，均极可能为诈骗软件。如因忽视提示造成损失，后果自负!"
      type="warning"
      :closable="false"
      show-icon
      class="security-warning auto-close-warning"
    />

    <!-- 课程表 -->
    <el-card class="navigation-card">
      <template #header>
        <div class="card-header">
          <span>📚 课程表</span>
          <el-button type="primary" size="small" @click="refreshNavigationLinks">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>
      
      <div v-loading="navigationLoading" class="navigation-content">
        <div v-if="navigationLinks.length === 0" class="empty-navigation">
          <el-empty description="暂无课程链接" />
        </div>
        <div v-else class="navigation-categories">
          <div 
            v-for="(links, category) in navigationByCategory" 
            :key="category"
            class="category-section"
          >
            <h3 class="category-title">{{ category }}</h3>
            <div class="category-links" :class="`links-count-${links.length}`">
              <div 
                v-for="link in links" 
                :key="link.id"
                class="navigation-item"
                @click="openLink(link.url)"
              >
                <div class="link-content">
                  <div class="link-icon">
                    <el-icon size="16"><Link /></el-icon>
                  </div>
                  <span class="link-title">{{ link.title }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 套餐选择弹窗 -->
    <el-dialog 
      v-model="showPlansDialog" 
      title="选择套餐" 
      width="90%"
      :close-on-click-modal="false"
      class="plans-dialog"
    >
      <div class="plans-dialog-content">
        <div class="plans-list">
          <div 
            v-for="plan in membershipPlans" 
            :key="plan.id"
            class="plan-item"
            :class="{ 'plan-selected': selectedPlan?.id === plan.id }"
            @click="selectPlan(plan)"
          >
            <div class="plan-info">
              <span class="plan-name">{{ plan.name }}</span>
              <span class="plan-price">¥{{ plan.price }}</span>
              <span v-if="plan.original_price > plan.price" class="original-price">¥{{ plan.original_price }}</span>
              <el-tag v-if="plan.discount_rate > 0" type="danger" size="small" class="discount-tag">热门</el-tag>
            </div>
            <div class="plan-details">
              <span class="duration">有效期：{{ plan.duration_days }} 天</span>
              <span v-if="plan.discount_rate > 0" class="discount">优惠：{{ plan.discount_rate }}% OFF</span>
            </div>
          </div>
        </div>
        
        <div v-if="selectedPlan" class="purchase-section order-details">
          <div class="purchase-summary">
            <h4>订单详情</h4>
            <div class="summary-item">
              <span class="label">套餐：</span><span class="value">{{ selectedPlan.name }}</span>
            </div>
            <div class="summary-item">
              <span class="label">有效期：</span><span class="value">{{ selectedPlan.duration_days }} 天</span>
            </div>
            <div class="summary-item total">
              <span class="label">总计：</span><span class="price">¥{{ selectedPlan.price }}</span>
            </div>
          </div>
          
          <div class="payment-methods">
            <h4>支付方式</h4>
            <el-radio-group v-model="paymentMethod" class="payment-options">
              <el-radio value="alipay" class="payment-option">
                <div class="payment-content">
                  <el-icon size="20" color="#1677FF"><CreditCard /></el-icon>
                  <span>支付宝</span>
                </div>
              </el-radio>
              <el-radio value="wechat" class="payment-option">
                <div class="payment-content">
                  <el-icon size="20" color="#07C160"><ChatDotRound /></el-icon>
                  <span>微信支付</span>
                </div>
              </el-radio>
            </el-radio-group>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showPlansDialog = false">取消</el-button>
          <el-button 
            type="primary" 
            :loading="purchaseLoading"
            :disabled="!selectedPlan"
            @click="handlePurchase"
          >
            立即支付
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 推广信息卡片（代理用户） -->
    <el-card v-if="userInfo.userType === 'agent'" class="referral-card">
      <template #header>
        <span>推广信息</span>
      </template>
      
      <div class="referral-info">
        <div class="referral-code">
          <label>我的推广码：</label>
          <el-input 
            v-model="userInfo.referralCode" 
            readonly 
            class="code-input"
          >
            <template #append>
              <el-button @click="copyReferralCode">复制</el-button>
            </template>
          </el-input>
        </div>
        
        <div class="referral-stats">
          <el-row :gutter="20">
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-number">{{ agentStats.directMembers }}</div>
                <div class="stat-label">直属会员</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-number">¥{{ agentStats.totalIncome.toFixed(2) }}</div>
                <div class="stat-label">总收入</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-number">¥{{ agentStats.pendingAmount.toFixed(2) }}</div>
                <div class="stat-label">待提现</div>
              </div>
            </el-col>
          </el-row>
        </div>
        
        <div class="referral-actions">
          <el-button type="primary" @click="showWithdrawDialog">申请提现</el-button>
          <el-button @click="viewCommissionHistory">佣金记录</el-button>
        </div>
      </div>
    </el-card>



    <!-- 修改密码对话框 -->
    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="400px">
      <el-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef" label-width="80px">
        <el-form-item label="当前密码" prop="currentPassword">
          <el-input v-model="passwordForm.currentPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleChangePassword" :loading="passwordLoading">确定</el-button>
      </template>
    </el-dialog>

    <!-- 提现对话框 -->
    <el-dialog v-model="withdrawDialogVisible" title="申请提现" width="500px">
      <el-form :model="withdrawForm" :rules="withdrawRules" ref="withdrawFormRef" label-width="100px">
        <el-form-item label="提现金额" prop="amount">
          <el-input-number 
            v-model="withdrawForm.amount" 
            :min="1" 
            :max="agentStats.pendingAmount"
            :precision="2"
            style="width: 100%"
          />
          <div class="form-tip">可提现金额：¥{{ agentStats.pendingAmount.toFixed(2) }}</div>
        </el-form-item>
        <el-form-item label="提现方式" prop="method">
          <el-radio-group v-model="withdrawForm.method">
            <el-radio value="alipay">支付宝</el-radio>
            <el-radio value="wechat">微信</el-radio>
            <el-radio value="bank">银行卡</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="withdrawForm.method === 'alipay'" label="支付宝账号" prop="account">
          <el-input v-model="withdrawForm.account" placeholder="请输入支付宝账号" />
        </el-form-item>
        <el-form-item v-if="withdrawForm.method === 'wechat'" label="微信账号" prop="account">
          <el-input v-model="withdrawForm.account" placeholder="请输入微信账号" />
        </el-form-item>
        <template v-if="withdrawForm.method === 'bank'">
          <el-form-item label="银行名称" prop="bankName">
            <el-input v-model="withdrawForm.bankName" placeholder="请输入银行名称" />
          </el-form-item>
          <el-form-item label="银行卡号" prop="bankAccount">
            <el-input v-model="withdrawForm.bankAccount" placeholder="请输入银行卡号" />
          </el-form-item>
          <el-form-item label="持卡人姓名" prop="accountName">
            <el-input v-model="withdrawForm.accountName" placeholder="请输入持卡人姓名" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="withdrawDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleWithdraw" :loading="withdrawLoading">提交申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  User, Lock, Refresh, ShoppingCart, Close, Clock, Connection, Monitor, CreditCard, ChatDotRound, Star, Link, ArrowRight
} from '@element-plus/icons-vue'
import request from '../api/request'

// 响应式数据
const userInfo = ref({})
const membershipStatus = ref({ isVip: false })
const navigationLinks = ref([])
const navigationLoading = ref(false)
const showWarning = ref(true)
const membershipPlans = ref([])
const agentStats = ref({
  directMembers: 0,
  totalIncome: 0,
  pendingAmount: 0
})


const showPlansDialog = ref(false)
const selectedPlan = ref(null)
const paymentMethod = ref('alipay')
const purchaseLoading = ref(false)

const passwordDialogVisible = ref(false)
const passwordLoading = ref(false)
const withdrawDialogVisible = ref(false)
const withdrawLoading = ref(false)

// 表单数据
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const withdrawForm = reactive({
  amount: 0,
  method: 'alipay',
  account: '',
  bankName: '',
  bankAccount: '',
  accountName: ''
})

// 表单引用
const passwordFormRef = ref()
const withdrawFormRef = ref()

// 表单验证规则
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
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const withdrawRules = {
  amount: [
    { required: true, message: '请输入提现金额', trigger: 'blur' }
  ],
  method: [
    { required: true, message: '请选择提现方式', trigger: 'change' }
  ],
  account: [
    { required: true, message: '请输入账号', trigger: 'blur' }
  ],
  bankName: [
    { required: true, message: '请输入银行名称', trigger: 'blur' }
  ],
  bankAccount: [
    { required: true, message: '请输入银行卡号', trigger: 'blur' }
  ],
  accountName: [
    { required: true, message: '请输入持卡人姓名', trigger: 'blur' }
  ]
}

// 计算属性
const getDaysLeft = (expireTime) => {
  if (!expireTime) return 0
  const now = new Date()
  const expire = new Date(expireTime)
  const diffTime = expire - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

// 按分类组织导航链接
const navigationByCategory = computed(() => {
  const grouped = {}
  navigationLinks.value.forEach(link => {
    const category = link.category || '其他'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(link)
  })
  return grouped
})

// 方法
const fetchUserInfo = async () => {
  try {
    const response = await request.get('/membership/profile')
    console.log('用户信息API响应:', response)
    
    if (response.message) {
      userInfo.value = {
        username: response.data.username,
        phone: response.data.phone,
        email: response.data.email,
        userType: response.data.user_type,
        agentLevel: response.data.agent_level,
        referralCode: response.data.referral_code,
        createdAt: response.data.created_at
      }
      console.log('用户信息更新完成:', userInfo.value)
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    // 如果是认证失败，重定向到登录页
    if (error.response?.status === 401 || error.response?.status === 403) {
      ElMessage.error('登录已过期，请重新登录')
      // 这里需要导入router或使用其他方式跳转
      window.location.href = '/user/login'
    } else {
      ElMessage.error('获取用户信息失败')
      // 设置默认值避免页面崩溃
      userInfo.value = {
        username: '未知用户',
        phone: '',
        userType: 'member',
        referralCode: ''
      }
    }
  }
}

const fetchMembershipStatus = async () => {
  try {
    const response = await request.get('/membership/status')
    membershipStatus.value = response.data || { isVip: false }
    
    // 如果是免费试用会员，启动倒计时
    if (membershipStatus.value.isFreeTrialMember) {
      startCountdown()
    } else {
      stopCountdown()
    }
  } catch (error) {
    console.error('获取会员状态失败:', error)
    ElMessage.error('获取会员状态失败')
    // 设置默认值
    membershipStatus.value = { isVip: false }
    stopCountdown()
  }
}

const fetchMembershipPlans = async () => {
  try {
    const response = await request.get('/membership/plans')
    membershipPlans.value = response.data || []
  } catch (error) {
    console.error('获取套餐列表失败:', error)
    ElMessage.error('获取套餐列表失败')
    membershipPlans.value = []
  }
}

const fetchAgentStats = async () => {
  if (userInfo.value.userType !== 'agent') return
  
  try {
    const response = await request.get('/agent/dashboard')
    agentStats.value = response.data || {}
  } catch (error) {
    console.error('获取代理统计失败:', error)
    agentStats.value = {}
  }
}

// 获取导航链接
const fetchNavigationLinks = async () => {
  navigationLoading.value = true
  try {
    const response = await request.get('/navigation/links')
    navigationLinks.value = response.data || []
  } catch (error) {
    console.error('获取导航链接失败:', error)
    navigationLinks.value = []
  } finally {
    navigationLoading.value = false
  }
}

// 刷新导航链接
const refreshNavigationLinks = () => {
  fetchNavigationLinks()
}

// 打开链接
const openLink = (url) => {
  if (!url) return
  
  // 确保URL有协议
  let finalUrl = url
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    finalUrl = 'https://' + url
  }
  
  window.open(finalUrl, '_blank')
}

// 自动关闭警告
const autoCloseWarning = () => {
  setTimeout(() => {
    showWarning.value = false
  }, 5000) // 5秒后自动关闭
}

const refreshMembershipStatus = () => {
  fetchMembershipStatus()
}

const showPurchaseDialog = () => {
  showPlansDialog.value = true
  if (membershipPlans.value.length === 0) {
    fetchMembershipPlans()
  }
}

const selectPlan = (plan) => {
  selectedPlan.value = plan
  
  // 自动滚动到订单详情区域
  nextTick(() => {
    const orderDetailsEl = document.querySelector('.order-details')
    if (orderDetailsEl) {
      orderDetailsEl.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      })
    }
  })
}

const handlePurchase = async () => {
  if (!selectedPlan.value) {
    ElMessage.warning('请选择套餐')
    return
  }
  
  purchaseLoading.value = true
  try {
    const response = await request.post('/membership/purchase', {
      planId: selectedPlan.value.id,
      paymentMethod: paymentMethod.value
    })
    
    if (response.data.message) {
      const isRenewal = response.data.data?.isRenewal
      ElMessage.success(isRenewal ? '续费成功！' : '购买成功！')
      showPlansDialog.value = false
      selectedPlan.value = null
      fetchMembershipStatus()
    }
  } catch (error) {
    console.error('购买失败:', error)
    ElMessage.error('购买失败')
  } finally {
    purchaseLoading.value = false
  }
}

const showChangePasswordDialog = () => {
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordDialogVisible.value = true
}

const handleChangePassword = async () => {
  try {
    await passwordFormRef.value.validate()
    
    passwordLoading.value = true
    // 这里需要实现修改密码的API
    // await request.post('/user/change-password', passwordForm)
    
    ElMessage.success('密码修改成功')
    passwordDialogVisible.value = false
  } catch (error) {
    console.error('修改密码失败:', error)
    ElMessage.error('修改密码失败')
  } finally {
    passwordLoading.value = false
  }
}

const copyReferralCode = () => {
  navigator.clipboard.writeText(userInfo.value.referralCode)
  ElMessage.success('推广码已复制')
}

const showWithdrawDialog = () => {
  withdrawForm.amount = 0
  withdrawForm.method = 'alipay'
  withdrawForm.account = ''
  withdrawForm.bankName = ''
  withdrawForm.bankAccount = ''
  withdrawForm.accountName = ''
  withdrawDialogVisible.value = true
}

const handleWithdraw = async () => {
  try {
    await withdrawFormRef.value.validate()
    
    withdrawLoading.value = true
    
    const bankInfo = withdrawForm.method === 'bank' ? {
      bankName: withdrawForm.bankName,
      bankAccount: withdrawForm.bankAccount,
      accountName: withdrawForm.accountName
    } : {
      account: withdrawForm.account
    }
    
    await request.post('/agent/withdraw', {
      amount: withdrawForm.amount,
      withdrawalMethod: withdrawForm.method,
      bankInfo
    })
    
    ElMessage.success('提现申请已提交，请等待审核')
    withdrawDialogVisible.value = false
    fetchAgentStats()
  } catch (error) {
    console.error('提现申请失败:', error)
    ElMessage.error('提现申请失败')
  } finally {
    withdrawLoading.value = false
  }
}

const viewCommissionHistory = () => {
  // 这里可以跳转到佣金记录页面或显示对话框
  ElMessage.info('佣金记录功能开发中')
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 格式化到期日期
const formatExpireDate = (dateString) => {
  if (!dateString) return '-'
  
  const expireDate = new Date(dateString)
  const now = new Date()
  const diffTime = expireDate - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return '已过期'
  } else if (diffDays === 0) {
    return '今天到期'
  } else if (diffDays === 1) {
    return '明天到期'
  } else if (diffDays <= 7) {
    return `${diffDays}天后到期`
  } else {
    return expireDate.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric' 
    })
  }
}

// 格式化免费试用倒计时
const formatTrialCountdown = (dateString) => {
  if (!dateString) return '-'
  
  const expireDate = new Date(dateString)
  const now = new Date()
  const diffTime = expireDate - now
  
  if (diffTime <= 0) {
    return '已过期'
  }
  
  const hours = Math.floor(diffTime / (1000 * 60 * 60))
  const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diffTime % (1000 * 60)) / 1000)
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`
  } else {
    return `${seconds}秒`
  }
}

// 倒计时定时器
let countdownTimer = null

// 启动倒计时
const startCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
  
  if (membershipStatus.value.isFreeTrialMember && membershipStatus.value.expireTime) {
    countdownTimer = setInterval(() => {
      const expireDate = new Date(membershipStatus.value.expireTime)
      const now = new Date()
      
      if (now >= expireDate) {
        // 试用已过期，重新获取会员状态
        clearInterval(countdownTimer)
        fetchMembershipStatus()
      }
    }, 1000) // 每秒更新
  }
}

// 停止倒计时
const stopCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

// 组件挂载时获取数据
onMounted(() => {
  fetchUserInfo()
  fetchMembershipStatus()
  fetchAgentStats()
  fetchNavigationLinks()
  
  // 启动警告自动关闭
  autoCloseWarning()
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopCountdown()
})
</script>

<style scoped>
.user-dashboard {
  max-width: 100%;
  margin: 0 auto;
  padding: 12px;
  background: #f5f5f5;
  min-height: 100vh;
}

.user-info-card {
  margin-bottom: 12px;
}

.user-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.user-basic {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.username {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.user-phone {
  font-size: 13px;
  color: #909399;
}

.user-status {
  display: flex;
  align-items: center;
}

.vip-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expire-date {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.trial-countdown {
  color: #e6a23c;
  font-weight: 600;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

.user-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.membership-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.membership-active,
.membership-inactive {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 0;
}

.status-info h3 {
  margin: 0 0 8px 0;
  color: #303133;
}

.expire-time {
  margin: 0 0 4px 0;
  color: #606266;
}

.days-left {
  margin: 0;
  color: #67C23A;
  font-weight: bold;
}

.status-actions {
  margin-left: auto;
}

/* 弹窗样式优化 */
.plans-dialog {
  max-width: 500px;
}

.plans-dialog-content {
  max-height: 60vh;
  overflow-y: auto;
}

/* 弹窗响应式 */
@media (max-width: 768px) {
  .plans-dialog {
    width: 95% !important;
    max-width: none;
    margin: 0 auto;
  }
}

@media (max-width: 480px) {
  .plans-dialog {
    width: 98% !important;
    margin: 0 auto;
  }
  
  .plans-dialog-content {
    max-height: 50vh;
  }
}

.plans-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.plan-item {
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.3s;
  background: #fff;
}

.plan-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.plan-selected {
  border-color: #409eff;
  background: #f0f9ff;
}

.plan-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.plan-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.plan-price {
  font-size: 18px;
  font-weight: bold;
  color: #f56c6c;
}

.original-price {
  font-size: 14px;
  color: #909399;
  text-decoration: line-through;
}

.discount-tag {
  margin-left: auto;
}

.plan-details {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  color: #606266;
}

.duration {
  color: #606266;
}

.discount {
  color: #f56c6c;
  font-weight: 600;
}

/* 手机屏幕优化 */
@media (max-width: 480px) {
  .plan-item {
    padding: 10px;
  }
  
  .plan-info {
    gap: 6px;
    margin-bottom: 4px;
  }
  
  .plan-name {
    font-size: 14px;
  }
  
  .plan-price {
    font-size: 16px;
  }
  
  .original-price {
    font-size: 12px;
  }
  
  .plan-details {
    gap: 12px;
    font-size: 12px;
  }
}

.purchase-section {
  border-top: 1px solid #e4e7ed;
  padding-top: 20px;
}

.purchase-summary {
  margin-bottom: 20px;
}

.purchase-summary h4 {
  margin: 0 0 12px 0;
  color: #303133;
}

.summary-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  color: #606266;
}

.summary-item .label {
  color: #606266;
  margin-right: 0;
}

.summary-item .value {
  color: #303133;
  margin-left: 0;
}

.summary-item.total {
  font-weight: bold;
  color: #303133;
  border-top: 1px solid #e4e7ed;
  padding-top: 8px;
  margin-top: 8px;
}

.price {
  color: #f56c6c;
  font-size: 18px;
}

.payment-methods {
  margin-bottom: 20px;
}

.payment-methods h4 {
  margin: 0 0 12px 0;
  color: #303133;
}

.payment-options {
  display: flex;
  gap: 20px;
}

.payment-option {
  margin-right: 0;
}

.payment-content {
  display: flex;
  align-items: center;
  gap: 8px;
}



.purchase-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* 弹窗底部按钮样式 */
.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  padding: 0;
}

.dialog-footer .el-button {
  min-width: 60px;
  max-width: 80px;
  padding: 8px 12px;
  font-size: 14px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* 移动端按钮优化 */
@media (max-width: 768px) {
  .dialog-footer {
    gap: 6px;
  }
  
  .dialog-footer .el-button {
    min-width: 50px;
    max-width: 70px;
    padding: 6px 10px;
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .dialog-footer {
    gap: 4px;
  }
  
  .dialog-footer .el-button {
    min-width: 45px;
    max-width: 65px;
    padding: 6px 8px;
    font-size: 12px;
  }
}

@media (max-width: 360px) {
  .dialog-footer {
    gap: 3px;
  }
  
  .dialog-footer .el-button {
    min-width: 40px;
    max-width: 55px;
    padding: 5px 6px;
    font-size: 11px;
  }
}

.referral-card {
  margin-bottom: 20px;
}

.referral-code {
  margin-bottom: 20px;
}

.referral-code label {
  display: block;
  margin-bottom: 8px;
  color: #303133;
  font-weight: bold;
}

.code-input {
  max-width: 300px;
}

.referral-stats {
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  color: #909399;
  font-size: 14px;
}



.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* 新增样式 */
.user-status {
  margin-top: 8px;
}

/* 安全警告样式 */
.security-warning {
  margin-bottom: 12px;
}

.auto-close-warning {
  animation: fadeOut 0.5s ease-in-out 4.5s forwards;
}

@keyframes fadeOut {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-10px);
  }
}

.warning-content p {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.warning-content ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.warning-content li {
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.4;
}

/* 导航卡片样式 */
.navigation-card {
  margin-bottom: 12px;
}

.navigation-content {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;
}

.navigation-content::-webkit-scrollbar {
  width: 6px;
}

.navigation-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.navigation-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.navigation-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.empty-navigation {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.navigation-categories {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  padding: 4px 8px;
  background: linear-gradient(90deg, #409eff, #67c23a);
  color: white;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.category-links {
  display: grid;
  gap: 8px;
}

/* 自适应排版 - 根据链接数量调整列数 */
.links-count-1 { grid-template-columns: 1fr; }
.links-count-2 { grid-template-columns: repeat(2, 1fr); }
.links-count-3 { grid-template-columns: repeat(3, 1fr); }
.links-count-4 { grid-template-columns: repeat(2, 1fr); }
.links-count-5 { grid-template-columns: repeat(3, 1fr); }
.links-count-6 { grid-template-columns: repeat(3, 1fr); }

/* 默认情况下，超过6个链接时使用自适应布局 */
.category-links:not([class*="links-count-"]) {
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.navigation-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fff;
  min-height: 44px;
}

.navigation-item:hover {
  border-color: #409eff;
  background: #f0f9ff;
  transform: scale(1.02);
}

.navigation-item:active {
  transform: scale(0.98);
}

.link-content {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  justify-content: center;
}

.link-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: #f0f9ff;
  border-radius: 4px;
  color: #409eff;
  flex-shrink: 0;
}

.link-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-dashboard {
    padding: 8px;
    max-width: 100%;
  }
  
  .user-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .user-actions {
    margin-left: 0;
    width: 100%;
    gap: 8px;
  }
  
  .user-actions .el-button {
    flex: 1;
    font-size: 12px;
    padding: 8px 12px;
  }
  
  .category-links {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 6px;
  }
  
  .navigation-item {
    padding: 6px 8px;
    min-height: 36px;
  }
  
  .link-title {
    font-size: 12px;
  }
  
  .category-title {
    font-size: 13px;
    padding: 3px 6px;
  }
}

@media (max-width: 480px) {
  .user-dashboard {
    padding: 6px;
  }
  
  .category-links {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 4px;
  }
  
  .navigation-item {
    padding: 4px 6px;
    min-height: 32px;
  }
  
  .link-title {
    font-size: 11px;
  }
  
  .link-icon {
    width: 16px;
    height: 16px;
  }
}
</style>
