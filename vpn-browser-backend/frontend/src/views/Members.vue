<template>
  <div class="members-container">
    <el-card class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h2>会员管理</h2>
          <p>管理系统中的所有会员用户</p>
        </div>
        <div class="header-right">
          <el-button type="primary" @click="refreshData">
            <el-icon><Refresh /></el-icon>
            刷新数据
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 搜索和筛选 -->
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="搜索用户">
          <el-input
            v-model="searchForm.search"
            placeholder="输入用户名或手机号"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="用户类型">
          <el-select v-model="searchForm.userType" placeholder="选择用户类型" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="普通会员" value="member" />
            <el-option label="代理" value="agent" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ stats.totalMembers }}</div>
              <div class="stat-label">总会员数</div>
            </div>
            <el-icon class="stat-icon member-icon"><User /></el-icon>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ stats.activeMembers }}</div>
              <div class="stat-label">活跃会员</div>
            </div>
            <el-icon class="stat-icon active-icon"><UserFilled /></el-icon>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ stats.totalAgents }}</div>
              <div class="stat-label">代理数量</div>
            </div>
            <el-icon class="stat-icon agent-icon"><Avatar /></el-icon>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ stats.todayRegistered }}</div>
              <div class="stat-label">今日注册</div>
            </div>
            <el-icon class="stat-icon today-icon"><TrendCharts /></el-icon>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 会员列表 -->
    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>会员列表</span>
          <el-button type="success" size="small" @click="showAddMemberDialog">
            <el-icon><Plus /></el-icon>
            添加会员
          </el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="memberList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="user_type" label="类型" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.user_type === 'agent' ? 'warning' : 'primary'">
              {{ scope.row.user_type === 'agent' ? '代理' : '会员' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="referral_code" label="推广码" width="100" />
        <el-table-column prop="parent_agent_name" label="上级代理商" width="120">
          <template #default="scope">
            <span v-if="scope.row.parent_agent_name" class="agent-name">
              {{ scope.row.parent_agent_name }}
            </span>
            <span v-else class="no-agent">-</span>
          </template>
        </el-table-column>
        <el-table-column label="会员状态" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.membership_end_date && new Date(scope.row.membership_end_date) > new Date()" type="success">
              有效会员
            </el-tag>
            <el-tag v-else type="info">未开通</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="membership_end_date" label="到期时间" width="180">
          <template #default="scope">
            <span v-if="scope.row.membership_end_date">
              {{ formatDate(scope.row.membership_end_date) }}
            </span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="last_login_time" label="最后登录" width="180">
          <template #default="scope">
            <span v-if="scope.row.last_login_time">
              {{ formatDate(scope.row.last_login_time) }}
            </span>
            <span v-else class="text-gray">从未登录</span>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.is_active ? 'success' : 'danger'">
              {{ scope.row.is_active ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button-group>
              <el-button size="small" @click="viewMemberDetail(scope.row)">详情</el-button>
              <el-button 
                v-if="scope.row.user_type === 'member'" 
                size="small" 
                type="warning" 
                @click="promoteToAgent(scope.row)"
              >
                升级代理
              </el-button>
              <el-button 
                size="small" 
                :type="scope.row.is_active ? 'danger' : 'success'"
                @click="toggleUserStatus(scope.row)"
              >
                {{ scope.row.is_active ? '禁用' : '启用' }}
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 会员详情对话框 -->
    <el-dialog v-model="memberDetailVisible" title="会员详情管理" width="800px">
      <div v-if="selectedMember" class="member-detail">
        <!-- 基本信息 -->
        <el-card class="detail-card" header="基本信息">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="用户ID">{{ selectedMember.id }}</el-descriptions-item>
            <el-descriptions-item label="用户名">{{ selectedMember.username }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ selectedMember.phone }}</el-descriptions-item>
            <el-descriptions-item label="用户类型">
              <el-tag :type="selectedMember.user_type === 'agent' ? 'warning' : 'primary'">
                {{ selectedMember.user_type === 'agent' ? '代理' : '会员' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="推广码">{{ selectedMember.referral_code }}</el-descriptions-item>
            <el-descriptions-item label="上级代理商">
              <span v-if="selectedMember.parent_agent_name" class="agent-name">
                {{ selectedMember.parent_agent_name }}
              </span>
              <span v-else class="no-agent">无</span>
            </el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ formatDate(selectedMember.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="最后登录">
              {{ selectedMember.last_login_time ? formatDate(selectedMember.last_login_time) : '从未登录' }}
            </el-descriptions-item>
            <el-descriptions-item label="账户状态">
              <el-tag :type="selectedMember.is_active ? 'success' : 'danger'">
                {{ selectedMember.is_active ? '正常' : '禁用' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="会员状态">
              <el-tag v-if="selectedMember.membership_end_date && new Date(selectedMember.membership_end_date) > new Date()" type="success">
                有效会员 - {{ formatDate(selectedMember.membership_end_date) }} 到期
              </el-tag>
              <el-tag v-else type="info">未开通会员</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 管理操作 -->
        <el-card class="detail-card" header="管理操作">
          <el-row :gutter="20">
            <!-- 修改密码 -->
            <el-col :span="12">
              <div class="operation-section">
                <h4>修改密码</h4>
                <el-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef" label-width="80px">
                  <el-form-item label="新密码" prop="newPassword">
                    <el-input 
                      v-model="passwordForm.newPassword" 
                      type="password" 
                      placeholder="请输入新密码（至少6位）"
                      show-password
                    />
                  </el-form-item>
                  <el-form-item>
                    <el-button 
                      type="primary" 
                      @click="changePassword" 
                      :loading="passwordLoading"
                      size="small"
                    >
                      修改密码
                    </el-button>
                  </el-form-item>
                </el-form>
              </div>
            </el-col>

            <!-- 调整会员天数 -->
            <el-col :span="12">
              <div class="operation-section">
                <h4>调整会员时间</h4>
                <el-form :model="membershipForm" :rules="membershipRules" ref="membershipFormRef" label-width="80px">
                  <el-form-item label="操作类型" prop="operation">
                    <el-radio-group v-model="membershipForm.operation">
                      <el-radio value="add">增加天数</el-radio>
                      <el-radio value="subtract">减少天数</el-radio>
                      <el-radio value="set">设置天数</el-radio>
                    </el-radio-group>
                  </el-form-item>
                  <el-form-item label="天数" prop="days">
                    <el-input-number 
                      v-model="membershipForm.days" 
                      :min="1" 
                      :max="3650"
                      placeholder="请输入天数"
                    />
                  </el-form-item>
                  <el-form-item label="原因" prop="reason">
                    <el-input 
                      v-model="membershipForm.reason" 
                      placeholder="请输入调整原因"
                      maxlength="100"
                    />
                  </el-form-item>
                  <el-form-item>
                    <el-button 
                      type="warning" 
                      @click="adjustMembershipDays" 
                      :loading="membershipLoading"
                      size="small"
                    >
                      调整时间
                    </el-button>
                  </el-form-item>
                </el-form>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </div>
    </el-dialog>

    <!-- 添加会员对话框 -->
    <el-dialog v-model="addMemberVisible" title="添加会员" width="500px">
      <el-form :model="addMemberForm" :rules="addMemberRules" ref="addMemberFormRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="addMemberForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="addMemberForm.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="addMemberForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="推荐码" prop="referralCode">
          <el-input v-model="addMemberForm.referralCode" placeholder="可选，输入推荐人的推广码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addMemberVisible = false">取消</el-button>
          <el-button type="primary" @click="handleAddMember">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  User, UserFilled, Avatar, TrendCharts, Plus, Refresh 
} from '@element-plus/icons-vue'
import request from '../api/request'

// 响应式数据
const loading = ref(false)
const memberList = ref([])
const selectedMembers = ref([])
const memberDetailVisible = ref(false)
const addMemberVisible = ref(false)
const selectedMember = ref(null)

// 密码修改表单
const passwordForm = reactive({
  newPassword: ''
})
const passwordLoading = ref(false)
const passwordFormRef = ref()

// 会员天数调整表单
const membershipForm = reactive({
  operation: 'add',
  days: 30,
  reason: ''
})
const membershipLoading = ref(false)
const membershipFormRef = ref()

// 搜索表单
const searchForm = reactive({
  search: '',
  userType: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 统计数据
const stats = reactive({
  totalMembers: 0,
  activeMembers: 0,
  totalAgents: 0,
  todayRegistered: 0
})

console.log('初始化统计数据:', stats)

// 添加会员表单
const addMemberForm = reactive({
  username: '',
  password: '',
  phone: '',
  referralCode: ''
})

const addMemberFormRef = ref()

// 表单验证规则
const passwordRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

const membershipRules = {
  operation: [
    { required: true, message: '请选择操作类型', trigger: 'change' }
  ],
  days: [
    { required: true, message: '请输入天数', trigger: 'blur' },
    { type: 'number', min: 1, max: 3650, message: '天数必须在1-3650之间', trigger: 'blur' }
  ],
  reason: [
    { required: true, message: '请输入调整原因', trigger: 'blur' },
    { max: 100, message: '原因不能超过100个字符', trigger: 'blur' }
  ]
}

const addMemberRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

// 获取会员列表
const fetchMembers = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: searchForm.search,
      userType: searchForm.userType
    }
    
    const response = await request.get('/membership/admin/users', { params })
    
    console.log('API响应:', response)
    
    if (response.message) {
      memberList.value = response.data.users
      pagination.total = response.data.pagination.total
      
      // 更新统计数据
      updateStats()
    }
  } catch (error) {
    console.error('获取会员列表失败:', error)
    ElMessage.error('获取会员列表失败')
  } finally {
    loading.value = false
  }
}

// 更新统计数据
const updateStats = () => {
  console.log('更新统计数据，用户列表:', memberList.value)
  stats.totalMembers = memberList.value.length
  stats.activeMembers = memberList.value.filter(m => m.is_active).length
  stats.totalAgents = memberList.value.filter(m => m.user_type === 'agent').length
  stats.todayRegistered = memberList.value.filter(m => {
    const today = new Date().toDateString()
    return new Date(m.created_at).toDateString() === today
  }).length
  console.log('统计数据更新完成:', stats)
}

// 搜索处理
const handleSearch = () => {
  pagination.page = 1
  fetchMembers()
}

// 重置搜索
const resetSearch = () => {
  searchForm.search = ''
  searchForm.userType = ''
  pagination.page = 1
  fetchMembers()
}

// 分页处理
const handleSizeChange = (val) => {
  pagination.limit = val
  pagination.page = 1
  fetchMembers()
}

const handleCurrentChange = (val) => {
  pagination.page = val
  fetchMembers()
}

// 选择处理
const handleSelectionChange = (val) => {
  selectedMembers.value = val
}

// 查看会员详情
const viewMemberDetail = (member) => {
  selectedMember.value = member
  memberDetailVisible.value = true
  // 重置表单
  passwordForm.newPassword = ''
  membershipForm.operation = 'add'
  membershipForm.days = 30
  membershipForm.reason = ''
}

// 修改用户密码
const changePassword = async () => {
  try {
    await passwordFormRef.value.validate()
    
    await ElMessageBox.confirm(
      `确定要修改用户 ${selectedMember.value.username} 的密码吗？`,
      '确认修改',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    passwordLoading.value = true
    
    const response = await request.put(`/membership/admin/users/${selectedMember.value.id}/password`, {
      newPassword: passwordForm.newPassword
    })
    
    if (response.message) {
      ElMessage.success('密码修改成功')
      passwordForm.newPassword = ''
      passwordFormRef.value.resetFields()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('修改密码失败:', error)
      ElMessage.error(error.response?.data?.error || '修改密码失败')
    }
  } finally {
    passwordLoading.value = false
  }
}

// 调整会员天数
const adjustMembershipDays = async () => {
  try {
    await membershipFormRef.value.validate()
    
    const operationText = {
      add: '增加',
      subtract: '减少',
      set: '设置为'
    }[membershipForm.operation]
    
    await ElMessageBox.confirm(
      `确定要${operationText} ${membershipForm.days} 天会员时间吗？\n原因：${membershipForm.reason}`,
      '确认调整',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    membershipLoading.value = true
    
    const response = await request.put(`/membership/admin/users/${selectedMember.value.id}/membership-days`, {
      days: membershipForm.days,
      operation: membershipForm.operation,
      reason: membershipForm.reason
    })
    
    if (response.message) {
      ElMessage.success('会员时间调整成功')
      membershipForm.operation = 'add'
      membershipForm.days = 30
      membershipForm.reason = ''
      membershipFormRef.value.resetFields()
      
      // 刷新会员列表
      fetchMembers()
      
      // 更新选中的会员信息
      const updatedMember = memberList.value.find(m => m.id === selectedMember.value.id)
      if (updatedMember) {
        selectedMember.value = updatedMember
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('调整会员天数失败:', error)
      ElMessage.error(error.response?.data?.error || '调整会员天数失败')
    }
  } finally {
    membershipLoading.value = false
  }
}

// 升级为代理
const promoteToAgent = async (member) => {
  try {
    await ElMessageBox.confirm(
      `确定要将用户 "${member.username}" 升级为代理吗？`,
      '升级代理',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await request.post(`/api/agent/admin/promote/${member.id}`)
    ElMessage.success('升级代理成功')
    fetchMembers()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('升级代理失败:', error)
      ElMessage.error('升级代理失败')
    }
  }
}

// 切换用户状态
const toggleUserStatus = async (member) => {
  const action = member.is_active ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(
      `确定要${action}用户 "${member.username}" 吗？`,
      `${action}用户`,
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 这里需要实现切换用户状态的API
    ElMessage.success(`${action}用户成功`)
    fetchMembers()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(`${action}用户失败:`, error)
      ElMessage.error(`${action}用户失败`)
    }
  }
}

// 显示添加会员对话框
const showAddMemberDialog = () => {
  addMemberForm.username = ''
  addMemberForm.password = ''
  addMemberForm.phone = ''
  addMemberForm.referralCode = ''
  addMemberVisible.value = true
}

// 添加会员
const handleAddMember = async () => {
  try {
    await addMemberFormRef.value.validate()
    
    await request.post('/membership/register', addMemberForm)
    ElMessage.success('添加会员成功')
    addMemberVisible.value = false
    fetchMembers()
  } catch (error) {
    console.error('添加会员失败:', error)
    ElMessage.error('添加会员失败')
  }
}

// 刷新数据
const refreshData = () => {
  fetchMembers()
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 组件挂载时获取数据
onMounted(() => {
  fetchMembers()
})
</script>

<style scoped>
.members-container {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left h2 {
  margin: 0 0 8px 0;
  color: #303133;
}

.header-left p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.search-card {
  margin-bottom: 20px;
}

.search-form {
  margin: 0;
}

.stats-cards {
  margin-bottom: 20px;
}

.stat-card {
  position: relative;
  overflow: hidden;
}

.stat-content {
  position: relative;
  z-index: 2;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.stat-icon {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 40px;
  opacity: 0.3;
}

.member-icon {
  color: #409EFF;
}

.active-icon {
  color: #67C23A;
}

.agent-icon {
  color: #E6A23C;
}

.today-icon {
  color: #F56C6C;
}

.table-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.member-detail {
  padding: 0;
}

.detail-card {
  margin-bottom: 20px;
}

.detail-card:last-child {
  margin-bottom: 0;
}

.operation-section {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background-color: #fafafa;
}

.operation-section h4 {
  margin: 0 0 16px 0;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
}

.agent-name {
  color: #409eff;
  font-weight: 500;
}

.no-agent {
  color: #909399;
  font-style: italic;
}

.text-gray {
  color: #909399;
}

.el-button-group .el-button {
  margin-left: 0;
}
</style>
