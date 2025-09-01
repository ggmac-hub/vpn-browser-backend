<template>
  <div class="agents-container">
    <el-card class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h2>代理管理</h2>
          <p>管理系统中的所有代理用户及其业绩</p>
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
        <el-form-item label="搜索代理">
          <el-input
            v-model="searchForm.search"
            placeholder="输入用户名或手机号"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
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
              <div class="stat-number">{{ stats.totalAgents }}</div>
              <div class="stat-label">总代理数</div>
            </div>
            <el-icon class="stat-icon agent-icon"><Avatar /></el-icon>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ stats.activeAgents }}</div>
              <div class="stat-label">活跃代理</div>
            </div>
            <el-icon class="stat-icon active-icon"><UserFilled /></el-icon>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ stats.totalMembers }}</div>
              <div class="stat-label">代理会员总数</div>
            </div>
            <el-icon class="stat-icon member-icon"><User /></el-icon>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">¥{{ stats.totalCommission }}</div>
              <div class="stat-label">总佣金</div>
            </div>
            <el-icon class="stat-icon commission-icon"><Money /></el-icon>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 代理列表 -->
    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>代理列表</span>
          <div class="header-buttons">
            <el-button type="primary" size="small" @click="showCreateAgentDialog">
              <el-icon><Plus /></el-icon>
              创建代理
            </el-button>
            <el-button type="success" size="small" @click="showCommissionDialog">
              <el-icon><Money /></el-icon>
              佣金管理
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="agentList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="代理用户名" width="120" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="agent_level" label="代理级别" width="100">
          <template #default="scope">
            <el-tag :type="getAgentLevelType(scope.row.agent_level)">
              {{ getAgentLevelText(scope.row.agent_level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="referral_code" label="推广码" width="100">
          <template #default="scope">
            <el-tag type="warning">{{ scope.row.referral_code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="member_count" label="直属会员" width="100">
          <template #default="scope">
            <el-text type="primary">{{ scope.row.member_count || 0 }}</el-text>
          </template>
        </el-table-column>
        <el-table-column prop="sub_agent_count" label="下级代理" width="100">
          <template #default="scope">
            <el-text type="warning">{{ scope.row.sub_agent_count || 0 }}</el-text>
          </template>
        </el-table-column>
        <el-table-column prop="total_commission" label="总佣金" width="120">
          <template #default="scope">
            <el-text type="success">¥{{ (scope.row.total_commission || 0).toFixed(2) }}</el-text>
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
              <el-button size="small" @click="viewAgentDetail(scope.row)">详情</el-button>
              <el-button size="small" type="primary" @click="viewAgentMembers(scope.row)">会员</el-button>
              <el-button size="small" type="warning" @click="viewAgentCommission(scope.row)">佣金</el-button>
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

    <!-- 代理详情对话框 -->
    <el-dialog v-model="agentDetailVisible" title="代理详情" width="800px">
      <div v-if="selectedAgent" class="agent-detail">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-card>
              <template #header>基本信息</template>
              <el-descriptions :column="1" border>
                <el-descriptions-item label="代理ID">{{ selectedAgent.id }}</el-descriptions-item>
                <el-descriptions-item label="用户名">{{ selectedAgent.username }}</el-descriptions-item>
                <el-descriptions-item label="手机号">{{ selectedAgent.phone }}</el-descriptions-item>
                <el-descriptions-item label="推广码">
                  <el-tag type="warning">{{ selectedAgent.referral_code }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="注册时间">{{ formatDate(selectedAgent.created_at) }}</el-descriptions-item>
                <el-descriptions-item label="最后登录">
                  {{ selectedAgent.last_login_time ? formatDate(selectedAgent.last_login_time) : '从未登录' }}
                </el-descriptions-item>
                <el-descriptions-item label="账户状态">
                  <el-tag :type="selectedAgent.is_active ? 'success' : 'danger'">
                    {{ selectedAgent.is_active ? '正常' : '禁用' }}
                  </el-tag>
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card>
              <template #header>业绩统计</template>
              <el-descriptions :column="1" border>
                <el-descriptions-item label="直属会员">{{ selectedAgent.member_count || 0 }} 人</el-descriptions-item>
                <el-descriptions-item label="下级代理">{{ selectedAgent.sub_agent_count || 0 }} 人</el-descriptions-item>
                <el-descriptions-item label="总佣金">¥{{ (selectedAgent.total_commission || 0).toFixed(2) }}</el-descriptions-item>
                <el-descriptions-item label="本月佣金">¥0.00</el-descriptions-item>
                <el-descriptions-item label="待提现">¥0.00</el-descriptions-item>
                <el-descriptions-item label="已提现">¥0.00</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </el-dialog>

    <!-- 代理会员列表对话框 -->
    <el-dialog v-model="agentMembersVisible" title="代理会员列表" width="1000px">
      <div v-if="selectedAgent">
        <el-alert 
          :title="`代理 ${selectedAgent.username} 的直属会员列表`"
          type="info"
          :closable="false"
          style="margin-bottom: 20px"
        />
        
        <el-table :data="agentMembers" style="width: 100%">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="username" label="用户名" width="120" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column label="会员状态" width="120">
            <template #default="scope">
              <el-tag v-if="scope.row.is_vip" type="success">有效会员</el-tag>
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
          <el-table-column prop="created_at" label="注册时间" width="180">
            <template #default="scope">
              {{ formatDate(scope.row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column prop="is_active" label="状态" width="80">
            <template #default="scope">
              <el-tag :type="scope.row.is_active ? 'success' : 'danger'">
                {{ scope.row.is_active ? '正常' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 代理佣金详情对话框 -->
    <el-dialog v-model="agentCommissionVisible" title="代理佣金详情" width="1000px">
      <div v-if="selectedAgent">
        <el-alert 
          :title="`代理 ${selectedAgent.username} 的佣金记录`"
          type="success"
          :closable="false"
          style="margin-bottom: 20px"
        />
        
        <el-table :data="agentCommissions" style="width: 100%">
          <el-table-column prop="id" label="记录ID" width="80" />
          <el-table-column prop="referee_name" label="推荐用户" width="120" />
          <el-table-column prop="level" label="层级" width="80">
            <template #default="scope">
              <el-tag :type="scope.row.level === 1 ? 'primary' : 'warning'">
                {{ scope.row.level === 1 ? '一级' : '二级' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="order_amount" label="订单金额" width="120">
            <template #default="scope">
              ¥{{ (scope.row.order_amount || 0).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="commission_rate" label="佣金比例" width="100">
            <template #default="scope">
              {{ scope.row.commission_rate }}%
            </template>
          </el-table-column>
          <el-table-column prop="commission_amount" label="佣金金额" width="120">
            <template #default="scope">
              <el-text type="success">¥{{ (scope.row.commission_amount || 0).toFixed(2) }}</el-text>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.status === 'paid' ? 'success' : 'warning'">
                {{ scope.row.status === 'paid' ? '已发放' : '待发放' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="产生时间" width="180">
            <template #default="scope">
              {{ formatDate(scope.row.created_at) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 创建代理对话框 -->
    <el-dialog v-model="createAgentVisible" title="创建代理账户" width="600px">
      <el-form :model="createAgentForm" :rules="createAgentRules" ref="createAgentFormRef" label-width="120px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createAgentForm.username" placeholder="请输入代理用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="createAgentForm.password" type="password" placeholder="请输入登录密码" show-password />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="createAgentForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="代理级别" prop="agentLevel">
          <el-select v-model="createAgentForm.agentLevel" placeholder="选择代理级别">
            <el-option label="一级代理" :value="1" />
            <el-option label="二级代理" :value="2" />
          </el-select>
          <div class="form-tip">一级代理由厂家总部创建，二级代理由一级代理创建</div>
        </el-form-item>
        <el-form-item label="上级代理" prop="parentAgentId">
          <el-select v-model="createAgentForm.parentAgentId" placeholder="选择上级代理（可选）" clearable filterable>
            <el-option
              v-for="agent in filteredAgentList"
              :key="agent.id"
              :label="`${agent.username} (${agent.referral_code}) - ${getAgentLevelText(agent.agent_level)}`"
              :value="agent.id"
            />
          </el-select>
          <div class="form-tip">创建一级代理时可不选上级，创建二级代理时必须选择一级代理</div>
        </el-form-item>
        <el-form-item label="邀请码">
          <el-input value="系统将自动生成6位随机邀请码" disabled />
          <div class="form-tip">邀请码用于推广注册，创建后不可修改</div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createAgentVisible = false">取消</el-button>
          <el-button type="primary" @click="handleCreateAgent" :loading="createAgentLoading">
            创建代理
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 佣金管理对话框 -->
    <el-dialog v-model="commissionManageVisible" title="佣金管理" width="800px">
      <el-tabs v-model="commissionTab">
        <el-tab-pane label="待审核提现" name="pending">
          <el-table :data="pendingWithdrawals" style="width: 100%">
            <el-table-column prop="id" label="申请ID" width="80" />
            <el-table-column prop="username" label="代理用户" width="120" />
            <el-table-column prop="amount" label="提现金额" width="120">
              <template #default="scope">
                <el-text type="primary">¥{{ (scope.row.amount || 0).toFixed(2) }}</el-text>
              </template>
            </el-table-column>
            <el-table-column prop="withdrawal_method" label="提现方式" width="100">
              <template #default="scope">
                <el-tag>{{ getWithdrawalMethodText(scope.row.withdrawal_method) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="申请时间" width="180">
              <template #default="scope">
                {{ formatDate(scope.row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button size="small" type="success" @click="approveWithdrawal(scope.row)">
                  通过
                </el-button>
                <el-button size="small" type="danger" @click="rejectWithdrawal(scope.row)">
                  拒绝
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="提现记录" name="history">
          <el-table :data="withdrawalHistory" style="width: 100%">
            <el-table-column prop="id" label="记录ID" width="80" />
            <el-table-column prop="username" label="代理用户" width="120" />
            <el-table-column prop="amount" label="提现金额" width="120">
              <template #default="scope">
                ¥{{ (scope.row.amount || 0).toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getWithdrawalStatusType(scope.row.status)">
                  {{ getWithdrawalStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="processed_at" label="处理时间" width="180">
              <template #default="scope">
                {{ scope.row.processed_at ? formatDate(scope.row.processed_at) : '-' }}
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  User, UserFilled, Avatar, Money, Refresh, Plus 
} from '@element-plus/icons-vue'
import request from '../api/request'

// 响应式数据
const loading = ref(false)
const agentList = ref([])
const selectedAgents = ref([])
const agentDetailVisible = ref(false)
const agentMembersVisible = ref(false)
const agentCommissionVisible = ref(false)
const commissionManageVisible = ref(false)
const selectedAgent = ref(null)
const agentMembers = ref([])
const agentCommissions = ref([])
const pendingWithdrawals = ref([])
const withdrawalHistory = ref([])
const commissionTab = ref('pending')

// 创建代理相关
const createAgentVisible = ref(false)
const createAgentLoading = ref(false)
const createAgentFormRef = ref(null)
const createAgentForm = reactive({
  username: '',
  password: '',
  phone: '',
  agentLevel: 1,
  parentAgentId: null
})

const createAgentRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6个字符', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  agentLevel: [
    { required: true, message: '请选择代理级别', trigger: 'change' }
  ]
}

// 搜索表单
const searchForm = reactive({
  search: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 统计数据
const stats = reactive({
  totalAgents: 0,
  activeAgents: 0,
  totalMembers: 0,
  totalCommission: 0
})

// 获取代理列表
const fetchAgents = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: searchForm.search
    }
    
    const response = await request.get('/agent/admin/agents', { params })
    
    if (response.message) {
      agentList.value = response.data.agents
      pagination.total = response.data.pagination.total
      
      // 更新统计数据
      updateStats()
    }
  } catch (error) {
    console.error('获取代理列表失败:', error)
    ElMessage.error('获取代理列表失败')
  } finally {
    loading.value = false
  }
}

// 更新统计数据
const updateStats = () => {
  stats.totalAgents = agentList.value.length
  stats.activeAgents = agentList.value.filter(a => a.is_active).length
  stats.totalMembers = agentList.value.reduce((sum, a) => sum + (a.member_count || 0), 0)
  stats.totalCommission = agentList.value.reduce((sum, a) => sum + (a.total_commission || 0), 0)
}

// 搜索处理
const handleSearch = () => {
  pagination.page = 1
  fetchAgents()
}

// 重置搜索
const resetSearch = () => {
  searchForm.search = ''
  pagination.page = 1
  fetchAgents()
}

// 分页处理
const handleSizeChange = (val) => {
  pagination.limit = val
  pagination.page = 1
  fetchAgents()
}

const handleCurrentChange = (val) => {
  pagination.page = val
  fetchAgents()
}

// 选择处理
const handleSelectionChange = (val) => {
  selectedAgents.value = val
}

// 查看代理详情
const viewAgentDetail = (agent) => {
  selectedAgent.value = agent
  agentDetailVisible.value = true
}

// 查看代理会员
const viewAgentMembers = async (agent) => {
  selectedAgent.value = agent
  try {
    // 这里需要实现获取代理会员列表的API
    // const response = await request.get(`/api/agent/members?agentId=${agent.id}`)
    // agentMembers.value = response.data.data.members
    agentMembers.value = [] // 临时空数据
    agentMembersVisible.value = true
  } catch (error) {
    console.error('获取代理会员失败:', error)
    ElMessage.error('获取代理会员失败')
  }
}

// 查看代理佣金
const viewAgentCommission = async (agent) => {
  selectedAgent.value = agent
  try {
    // 这里需要实现获取代理佣金记录的API
    // const response = await request.get(`/api/agent/commission?agentId=${agent.id}`)
    // agentCommissions.value = response.data.data.records
    agentCommissions.value = [] // 临时空数据
    agentCommissionVisible.value = true
  } catch (error) {
    console.error('获取代理佣金失败:', error)
    ElMessage.error('获取代理佣金失败')
  }
}

// 显示佣金管理对话框
const showCommissionDialog = async () => {
  try {
    // 获取待审核提现和提现记录
    // const [pendingRes, historyRes] = await Promise.all([
    //   request.get('/admin/withdrawals?status=pending'),
    //   request.get('/admin/withdrawals')
    // ])
    // pendingWithdrawals.value = pendingRes.data.data.withdrawals
    // withdrawalHistory.value = historyRes.data.data.withdrawals
    
    pendingWithdrawals.value = [] // 临时空数据
    withdrawalHistory.value = [] // 临时空数据
    commissionManageVisible.value = true
  } catch (error) {
    console.error('获取佣金数据失败:', error)
    ElMessage.error('获取佣金数据失败')
  }
}

// 批准提现
const approveWithdrawal = async (withdrawal) => {
  try {
    await ElMessageBox.confirm(
      `确定批准代理 "${withdrawal.username}" 的提现申请吗？金额：¥${withdrawal.amount}`,
      '批准提现',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'success'
      }
    )
    
    // await request.post(`/api/admin/withdrawals/${withdrawal.id}/approve`)
    ElMessage.success('提现申请已批准')
    showCommissionDialog() // 刷新数据
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批准提现失败:', error)
      ElMessage.error('批准提现失败')
    }
  }
}

// 拒绝提现
const rejectWithdrawal = async (withdrawal) => {
  try {
    const { value: reason } = await ElMessageBox.prompt(
      `请输入拒绝提现的原因：`,
      '拒绝提现',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /.+/,
        inputErrorMessage: '请输入拒绝原因'
      }
    )
    
    // await request.post(`/api/admin/withdrawals/${withdrawal.id}/reject`, { reason })
    ElMessage.success('提现申请已拒绝')
    showCommissionDialog() // 刷新数据
  } catch (error) {
    if (error !== 'cancel') {
      console.error('拒绝提现失败:', error)
      ElMessage.error('拒绝提现失败')
    }
  }
}

// 获取提现方式文本
const getWithdrawalMethodText = (method) => {
  const methods = {
    bank: '银行卡',
    alipay: '支付宝',
    wechat: '微信'
  }
  return methods[method] || method
}

// 获取提现状态文本
const getWithdrawalStatusText = (status) => {
  const statuses = {
    pending: '待审核',
    approved: '已批准',
    rejected: '已拒绝',
    paid: '已发放'
  }
  return statuses[status] || status
}

// 获取提现状态类型
const getWithdrawalStatusType = (status) => {
  const types = {
    pending: 'warning',
    approved: 'primary',
    rejected: 'danger',
    paid: 'success'
  }
  return types[status] || 'info'
}

// 刷新数据
const refreshData = () => {
  fetchAgents()
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 组件挂载时获取数据
// 计算属性 - 过滤代理列表（根据选择的级别）
const filteredAgentList = computed(() => {
  if (createAgentForm.agentLevel === 1) {
    // 创建一级代理时，不显示任何上级选项（由厂家总部创建）
    return []
  } else if (createAgentForm.agentLevel === 2) {
    // 创建二级代理时，只显示一级代理
    return agentList.value.filter(agent => agent.agent_level === 1)
  }
  return agentList.value
})

// 获取代理级别文本
const getAgentLevelText = (level) => {
  switch (level) {
    case 1: return '一级代理'
    case 2: return '二级代理'
    default: return '未知'
  }
}

// 获取代理级别标签类型
const getAgentLevelType = (level) => {
  switch (level) {
    case 1: return 'success'
    case 2: return 'warning'
    default: return 'info'
  }
}

// 显示创建代理对话框
const showCreateAgentDialog = () => {
  // 重置表单
  Object.assign(createAgentForm, {
    username: '',
    password: '',
    phone: '',
    agentLevel: 1,
    parentAgentId: null
  })
  createAgentFormRef.value?.clearValidate()
  createAgentVisible.value = true
}

// 处理创建代理
const handleCreateAgent = async () => {
  try {
    const valid = await createAgentFormRef.value?.validate()
    if (!valid) return
    
    createAgentLoading.value = true
    
    const response = await request.post('/agent/admin/create', createAgentForm)
    
    if (response.message) {
      ElMessage.success('代理账户创建成功')
      createAgentVisible.value = false
      fetchAgents() // 刷新列表
    }
  } catch (error) {
    console.error('创建代理失败:', error)
    ElMessage.error(error.response?.data?.error || '创建代理失败')
  } finally {
    createAgentLoading.value = false
  }
}

onMounted(() => {
  fetchAgents()
})
</script>

<style scoped>
.agents-container {
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

.agent-icon {
  color: #E6A23C;
}

.active-icon {
  color: #67C23A;
}

.member-icon {
  color: #409EFF;
}

.commission-icon {
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

.header-buttons {
  display: flex;
  gap: 8px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.agent-detail {
  padding: 20px 0;
}

.text-gray {
  color: #909399;
}

.el-button-group .el-button {
  margin-left: 0;
}
</style>
