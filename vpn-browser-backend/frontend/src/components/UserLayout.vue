<template>
  <div class="user-layout">
    <!-- 顶部导航栏 -->
    <div class="user-header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo">
            <el-icon size="24" color="#409EFF"><Connection /></el-icon>
            <span class="logo-text">VPN浏览器</span>
          </div>
        </div>
        
        <div class="header-right">
          <!-- 简化的用户信息 -->
          <div class="user-info-simple">
            <el-tag v-if="membershipStatus.isVip" type="success" size="large">
              <el-icon><User /></el-icon>
              VIP会员
            </el-tag>
            <el-tag v-else type="info" size="large">
              <el-icon><User /></el-icon>
              未开通会员
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="user-main">
      <router-view />
    </div>

    <!-- 底部信息 -->
    <div class="user-footer">
      <div class="footer-content">
        <div class="footer-links">
          <el-button type="text" @click="showHelp">帮助中心</el-button>
          <el-divider direction="vertical" />
          <el-button type="text" @click="showContact">联系客服</el-button>
          <el-divider direction="vertical" />
          <el-button type="text" @click="showTerms">用户协议</el-button>
          <el-divider direction="vertical" />
          <el-button type="text" @click="showPrivacy">隐私政策</el-button>
        </div>
        <div class="footer-copyright">
          <p>© 2024 VPN浏览器. 保留所有权利.</p>
        </div>
      </div>
    </div>

    <!-- 帮助对话框 -->
    <el-dialog v-model="helpVisible" title="帮助中心" width="600px">
      <div class="help-content">
        <el-collapse>
          <el-collapse-item title="如何购买会员？" name="1">
            <p>1. 点击"立即开通"按钮</p>
            <p>2. 选择合适的套餐</p>
            <p>3. 选择支付方式并完成支付</p>
            <p>4. 支付成功后会员立即生效</p>
          </el-collapse-item>
          <el-collapse-item title="如何使用推广码？" name="2">
            <p>1. 在注册时输入推广码</p>
            <p>2. 成功注册后会自动绑定推荐关系</p>
            <p>3. 推荐人将获得相应佣金</p>
          </el-collapse-item>
          <el-collapse-item title="设备登录限制说明" name="3">
            <p>1. 每个账号只能在一台设备上登录</p>
            <p>2. 新设备登录会自动踢出旧设备</p>
            <p>3. 如需更换设备，请先在旧设备上退出登录</p>
          </el-collapse-item>
          <el-collapse-item title="如何申请退款？" name="4">
            <p>1. 联系客服说明退款原因</p>
            <p>2. 提供订单信息和支付凭证</p>
            <p>3. 客服审核后处理退款</p>
            <p>4. 退款将在3-7个工作日内到账</p>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-dialog>

    <!-- 联系客服对话框 -->
    <el-dialog v-model="contactVisible" title="联系客服" width="400px">
      <div class="contact-content">
        <div class="contact-item">
          <el-icon size="20" color="#1AAD19"><ChatDotRound /></el-icon>
          <div class="contact-info">
            <div class="contact-label">微信客服</div>
            <div class="contact-value">{{ techSupport.wechat || 'vpn_support_2024' }}</div>
            <el-button size="small" @click="copyContact('wechat')">复制</el-button>
          </div>
        </div>
        
        <div class="contact-item">
          <el-icon size="20" color="#12B7F5"><ChatLineRound /></el-icon>
          <div class="contact-info">
            <div class="contact-label">QQ客服</div>
            <div class="contact-value">{{ techSupport.qq || '888888888' }}</div>
            <el-button size="small" @click="copyContact('qq')">复制</el-button>
          </div>
        </div>
        
        <div class="support-hours">
          <p>服务时间：{{ techSupport.support_hours || '工作日 9:00-18:00 (北京时间)' }}</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Connection, User, ArrowDown, Setting, SwitchButton, ChatDotRound, ChatLineRound
} from '@element-plus/icons-vue'
import request from '../api/request'
import { getUser, clearAuth } from '../utils/auth'

const router = useRouter()

// 响应式数据
const membershipStatus = ref({ isVip: false })
const techSupport = ref({})
const helpVisible = ref(false)
const contactVisible = ref(false)

// 获取会员状态
const fetchMembershipStatus = async () => {
  try {
    const response = await request.get('/membership/status')
    membershipStatus.value = response.data || { isVip: false }
  } catch (error) {
    console.error('获取会员状态失败:', error)
    // 如果是认证失败，不显示错误信息
    if (error.response?.status !== 401 && error.response?.status !== 403) {
      ElMessage.error('获取会员状态失败')
    }
    // 设置默认值
    membershipStatus.value = { isVip: false }
  }
}

// 获取技术支持信息
const fetchTechSupport = async () => {
  try {
    const response = await request.get('/support')
    techSupport.value = response.data || {}
  } catch (error) {
    console.error('获取技术支持信息失败:', error)
    // 技术支持信息获取失败时使用默认值
    techSupport.value = {
      qq: '888888888',
      wechat: 'vpn_support_2024',
      support_hours: '工作日 9:00-18:00 (北京时间)'
    }
  }
}



// 显示帮助
const showHelp = () => {
  helpVisible.value = true
}

// 显示联系客服
const showContact = () => {
  contactVisible.value = true
}

// 显示用户协议
const showTerms = () => {
  ElMessage.info('用户协议页面开发中')
}

// 显示隐私政策
const showPrivacy = () => {
  ElMessage.info('隐私政策页面开发中')
}

// 复制联系方式
const copyContact = (type) => {
  const value = type === 'wechat' ? techSupport.value.wechat : techSupport.value.qq
  if (value) {
    navigator.clipboard.writeText(value)
    ElMessage.success(`${type === 'wechat' ? '微信号' : 'QQ号'}已复制`)
  }
}

// 组件挂载时获取数据
onMounted(() => {
  fetchMembershipStatus()
  fetchTechSupport()
})
</script>

<style scoped>
.user-layout {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.user-header {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-text {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info-simple {
  display: flex;
  align-items: center;
}

.user-main {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 0 20px;
}

.user-footer {
  background: white;
  border-top: 1px solid #e4e7ed;
  margin-top: auto;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

.footer-links {
  margin-bottom: 16px;
}

.footer-copyright p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.help-content {
  max-height: 400px;
  overflow-y: auto;
}

.help-content p {
  margin: 4px 0;
  color: #606266;
  line-height: 1.5;
}

.contact-content {
  padding: 20px 0;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
}

.contact-item:last-child {
  border-bottom: none;
}

.contact-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.contact-label {
  font-weight: 500;
  color: #303133;
  min-width: 80px;
}

.contact-value {
  color: #606266;
  font-family: monospace;
  flex: 1;
}

.support-hours {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
  text-align: center;
}

.support-hours p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
  }
  
  .user-main {
    padding: 0 16px;
  }
  
  .footer-content {
    padding: 16px;
  }
  
  .user-info .username {
    display: none;
  }
  
  .membership-status {
    display: none;
  }
}
</style>
