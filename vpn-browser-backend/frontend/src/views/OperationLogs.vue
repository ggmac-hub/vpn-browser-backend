<template>
  <div class="operation-logs-container">
    <el-card class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h2>操作日志</h2>
          <p>查看系统中所有管理员的操作记录</p>
        </div>
        <div class="header-right">
          <el-button type="primary" @click="refreshData">
            <el-icon><Refresh /></el-icon>
            刷新数据
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ stats.todayCount || 0 }}</div>
              <div class="stat-label">今日操作</div>
              <div class="stat-icon today">
                <el-icon><Clock /></el-icon>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ logList.length }}</div>
              <div class="stat-label">当前页记录</div>
              <div class="stat-icon current">
                <el-icon><Document /></el-icon>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ pagination.total }}</div>
              <div class="stat-label">总记录数</div>
              <div class="stat-icon total">
                <el-icon><DataAnalysis /></el-icon>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ stats.activeAdmins?.length || 0 }}</div>
              <div class="stat-label">活跃管理员</div>
              <div class="stat-icon active">
                <el-icon><User /></el-icon>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="操作类型">
          <el-select v-model="searchForm.targetType" placeholder="选择操作类型" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="用户管理" value="user" />
            <el-option label="会员管理" value="membership" />
            <el-option label="技术支持" value="tech_support" />
            <el-option label="系统管理" value="system" />
          </el-select>
        </el-form-item>
        <el-form-item label="动作类型">
          <el-select v-model="searchForm.actionType" placeholder="选择动作类型" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="创建" value="create" />
            <el-option label="更新" value="update" />
            <el-option label="删除" value="delete" />
            <el-option label="密码修改" value="password_change" />
            <el-option label="会员调整" value="membership_adjust" />
          </el-select>
        </el-form-item>
        <el-form-item label="管理员">
          <el-input
            v-model="searchForm.adminUsername"
            placeholder="输入管理员用户名"
            clearable
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作日志表格 -->
    <el-card class="table-card">
      <el-table
        :data="logList"
        v-loading="loading"
        stripe
        style="width: 100%"
        :default-sort="{ prop: 'created_at', order: 'descending' }"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="admin_username" label="管理员" width="120" />
        <el-table-column prop="target_type" label="操作类型" width="100">
          <template #default="scope">
            <el-tag :type="getTargetTypeColor(scope.row.target_type)">
              {{ getTargetTypeText(scope.row.target_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="action_type" label="动作类型" width="120">
          <template #default="scope">
            <el-tag :type="getActionTypeColor(scope.row.action_type)" size="small">
              {{ getActionTypeText(scope.row.action_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="target_name" label="操作对象" width="120" />
        <el-table-column prop="action_description" label="操作描述" min-width="200" />
        <el-table-column prop="reason" label="操作原因" width="150">
          <template #default="scope">
            <span v-if="scope.row.reason">{{ scope.row.reason }}</span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="操作时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="viewLogDetail(scope.row)">详情</el-button>
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

    <!-- 日志详情对话框 -->
    <el-dialog v-model="logDetailVisible" title="操作日志详情" width="800px">
      <div v-if="selectedLog" class="log-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="日志ID">{{ selectedLog.id }}</el-descriptions-item>
          <el-descriptions-item label="管理员">{{ selectedLog.admin_username }}</el-descriptions-item>
          <el-descriptions-item label="操作类型">
            <el-tag :type="getTargetTypeColor(selectedLog.target_type)">
              {{ getTargetTypeText(selectedLog.target_type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="动作类型">
            <el-tag :type="getActionTypeColor(selectedLog.action_type)">
              {{ getActionTypeText(selectedLog.action_type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="操作对象">{{ selectedLog.target_name }}</el-descriptions-item>
          <el-descriptions-item label="操作时间">{{ formatDate(selectedLog.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="操作描述" :span="2">{{ selectedLog.action_description }}</el-descriptions-item>
          <el-descriptions-item label="操作原因" :span="2">
            {{ selectedLog.reason || '无' }}
          </el-descriptions-item>
          <el-descriptions-item label="IP地址">{{ selectedLog.ip_address || '未记录' }}</el-descriptions-item>
          <el-descriptions-item label="用户代理">
            <span class="user-agent">{{ selectedLog.user_agent || '未记录' }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 修改前后对比 -->
        <div v-if="selectedLog.old_values || selectedLog.new_values" class="values-comparison">
          <h4>数据变更详情</h4>
          <el-row :gutter="20">
            <el-col :span="12" v-if="selectedLog.old_values">
              <el-card header="修改前">
                <pre class="json-display">{{ formatJSON(selectedLog.old_values) }}</pre>
              </el-card>
            </el-col>
            <el-col :span="12" v-if="selectedLog.new_values">
              <el-card header="修改后">
                <pre class="json-display">{{ formatJSON(selectedLog.new_values) }}</pre>
              </el-card>
            </el-col>
          </el-row>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Refresh, Clock, Document, DataAnalysis, User
} from '@element-plus/icons-vue'
import request from '../api/request'

// 响应式数据
const loading = ref(false)
const logList = ref([])
const selectedLog = ref(null)
const logDetailVisible = ref(false)
const dateRange = ref([])

// 统计数据
const stats = ref({
  todayCount: 0,
  activeAdmins: []
})

// 搜索表单
const searchForm = reactive({
  targetType: '',
  actionType: '',
  adminUsername: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 获取操作日志列表
const fetchLogs = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...searchForm
    }
    
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    
    const response = await request.get('/operation-logs', { params })
    
    if (response.data) {
      logList.value = response.data.logs
      pagination.total = response.data.pagination.total
    }
  } catch (error) {
    console.error('获取操作日志失败:', error)
    ElMessage.error('获取操作日志失败')
  } finally {
    loading.value = false
  }
}

// 获取统计信息
const fetchStats = async () => {
  try {
    const response = await request.get('/operation-logs/stats')
    if (response.data) {
      stats.value = response.data
    }
  } catch (error) {
    console.error('获取统计信息失败:', error)
  }
}

// 搜索处理
const handleSearch = () => {
  pagination.page = 1
  fetchLogs()
}

// 重置搜索
const resetSearch = () => {
  Object.keys(searchForm).forEach(key => {
    searchForm[key] = ''
  })
  dateRange.value = []
  pagination.page = 1
  fetchLogs()
}

// 分页处理
const handleSizeChange = (val) => {
  pagination.limit = val
  pagination.page = 1
  fetchLogs()
}

const handleCurrentChange = (val) => {
  pagination.page = val
  fetchLogs()
}

// 查看日志详情
const viewLogDetail = (log) => {
  selectedLog.value = log
  logDetailVisible.value = true
}

// 刷新数据
const refreshData = () => {
  fetchLogs()
  fetchStats()
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 格式化JSON
const formatJSON = (obj) => {
  if (!obj) return ''
  return JSON.stringify(obj, null, 2)
}

// 获取操作类型颜色
const getTargetTypeColor = (type) => {
  const colors = {
    user: 'primary',
    membership: 'success',
    tech_support: 'warning',
    system: 'danger'
  }
  return colors[type] || 'info'
}

// 获取操作类型文本
const getTargetTypeText = (type) => {
  const texts = {
    user: '用户管理',
    membership: '会员管理',
    tech_support: '技术支持',
    system: '系统管理'
  }
  return texts[type] || type
}

// 获取动作类型颜色
const getActionTypeColor = (type) => {
  const colors = {
    create: 'success',
    update: 'primary',
    delete: 'danger',
    password_change: 'warning',
    membership_adjust: 'info'
  }
  return colors[type] || 'info'
}

// 获取动作类型文本
const getActionTypeText = (type) => {
  const texts = {
    create: '创建',
    update: '更新',
    delete: '删除',
    password_change: '密码修改',
    membership_adjust: '会员调整'
  }
  return texts[type] || type
}

// 初始化
onMounted(() => {
  fetchLogs()
  fetchStats()
})
</script>

<style scoped>
.operation-logs-container {
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
  margin: 0 0 5px 0;
  color: #303133;
}

.header-left p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.stats-cards {
  margin-bottom: 20px;
}

.stat-card {
  height: 100px;
}

.stat-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  position: relative;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.stat-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 24px;
  opacity: 0.3;
}

.stat-icon.today { color: #409eff; }
.stat-icon.current { color: #67c23a; }
.stat-icon.total { color: #e6a23c; }
.stat-icon.active { color: #f56c6c; }

.search-card {
  margin-bottom: 20px;
}

.search-form {
  margin: 0;
}

.table-card {
  margin-bottom: 20px;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.log-detail {
  padding: 0;
}

.values-comparison {
  margin-top: 20px;
}

.values-comparison h4 {
  margin: 0 0 15px 0;
  color: #303133;
}

.json-display {
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
}

.user-agent {
  font-size: 12px;
  color: #909399;
  word-break: break-all;
}

.text-gray {
  color: #909399;
}
</style>
