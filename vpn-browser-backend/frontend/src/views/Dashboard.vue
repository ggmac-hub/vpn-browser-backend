<template>
  <div class="dashboard">
    <div class="page-title">
      <h1>📊 系统仪表板</h1>
      <p>实时监控VPN浏览器系统运行状态</p>
    </div>
    
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-cards">
      <el-col :xs="12" :sm="6" :md="6" :lg="6">
        <div class="dashboard-card stat-card">
          <div class="stat-icon nodes">
            <el-icon size="32"><Connection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ dashboardData.overview?.total_nodes || 0 }}</div>
            <div class="stat-label">总节点数</div>
            <div class="stat-sub">
              活跃: {{ dashboardData.overview?.active_nodes || 0 }}
            </div>
          </div>
        </div>
      </el-col>
      
      <el-col :xs="12" :sm="6" :md="6" :lg="6">
        <div class="dashboard-card stat-card">
          <div class="stat-icon traffic">
            <el-icon size="32"><TrendCharts /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ formatTraffic(dashboardData.today?.today_traffic) }}</div>
            <div class="stat-label">今日流量</div>
            <div class="stat-sub">
              连接: {{ dashboardData.today?.today_connections || 0 }}
            </div>
          </div>
        </div>
      </el-col>
      
      <el-col :xs="12" :sm="6" :md="6" :lg="6">
        <div class="dashboard-card stat-card">
          <div class="stat-icon latency">
            <el-icon size="32"><Timer /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ Math.round(dashboardData.today?.avg_latency || 0) }}ms</div>
            <div class="stat-label">平均延迟</div>
            <div class="stat-sub">
              成功率: {{ Math.round(dashboardData.today?.avg_success_rate || 0) }}%
            </div>
          </div>
        </div>
      </el-col>
      
      <el-col :xs="12" :sm="6" :md="6" :lg="6">
        <div class="dashboard-card stat-card">
          <div class="stat-icon admins">
            <el-icon size="32"><User /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ dashboardData.overview?.total_admins || 0 }}</div>
            <div class="stat-label">管理员</div>
            <div class="stat-sub">
              活跃天数: {{ dashboardData.overview?.active_days || 0 }}
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <!-- 图表区域 -->
    <el-row :gutter="20" class="charts-section">
      <el-col :xs="24" :sm="24" :md="16" :lg="16">
        <div class="dashboard-card">
          <div class="card-header">
            <h3 class="card-title">📈 流量趋势</h3>
            <el-button-group size="small">
              <el-button 
                :type="trendPeriod === '7' ? 'primary' : ''"
                @click="changeTrendPeriod('7')"
              >
                7天
              </el-button>
              <el-button 
                :type="trendPeriod === '30' ? 'primary' : ''"
                @click="changeTrendPeriod('30')"
              >
                30天
              </el-button>
            </el-button-group>
          </div>
          <div class="chart-container">
            <v-chart 
              :option="trafficChartOption" 
              :loading="chartLoading"
              style="height: 300px;"
            />
          </div>
        </div>
      </el-col>
      
      <el-col :xs="24" :sm="24" :md="8" :lg="8">
        <div class="dashboard-card">
          <div class="card-header">
            <h3 class="card-title">🌍 地区分布</h3>
          </div>
          <div class="chart-container">
            <v-chart 
              :option="regionChartOption" 
              :loading="chartLoading"
              style="height: 300px;"
            />
          </div>
        </div>
      </el-col>
    </el-row>
    
    <!-- 协议分布和最近日志 -->
    <el-row :gutter="20" class="bottom-section">
      <el-col :xs="24" :sm="24" :md="12" :lg="12">
        <div class="dashboard-card">
          <div class="card-header">
            <h3 class="card-title">🔧 协议分布</h3>
          </div>
          <div class="protocol-list">
            <div 
              v-for="protocol in dashboardData.protocol_distribution" 
              :key="protocol.protocol"
              class="protocol-item"
            >
              <div class="protocol-info">
                <span class="protocol-name">{{ protocol.protocol.toUpperCase() }}</span>
                <span class="protocol-count">{{ protocol.count }} 个节点</span>
              </div>
              <div class="protocol-bar">
                <div 
                  class="protocol-progress"
                  :style="{ width: getProtocolPercentage(protocol.count) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </el-col>
      
      <el-col :xs="24" :sm="24" :md="12" :lg="12">
        <div class="dashboard-card">
          <div class="card-header">
            <h3 class="card-title">📝 最近操作</h3>
            <el-button type="text" @click="$router.push('/logs')">
              查看全部
            </el-button>
          </div>
          <div class="logs-list">
            <div 
              v-for="log in dashboardData.recent_logs" 
              :key="log.id"
              class="log-item"
            >
              <div class="log-content">
                <div class="log-action">{{ formatAction(log.action) }}</div>
                <div class="log-meta">
                  <span class="log-user">{{ log.username || '系统' }}</span>
                  <span class="log-time">{{ formatTime(log.created_at) }}</span>
                </div>
              </div>
              <div class="log-status">
                <el-tag size="small" type="success">成功</el-tag>
              </div>
            </div>
            
            <div v-if="!dashboardData.recent_logs?.length" class="empty-logs">
              <el-empty description="暂无操作记录" :image-size="80" />
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { api } from '../api/request'
import dayjs from 'dayjs'

// 注册ECharts组件
use([
  CanvasRenderer,
  LineChart,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

// 响应式数据
const dashboardData = ref({})
const chartLoading = ref(false)
const trendPeriod = ref('7')
const refreshTimer = ref(null)

// 图表配置
const trafficChartOption = ref({})
const regionChartOption = ref({})

// 方法
const loadDashboardData = async () => {
  try {
    chartLoading.value = true
    const data = await api.get('/dashboard')
    dashboardData.value = data.data
    
    // 更新图表
    updateTrafficChart()
    updateRegionChart()
  } catch (error) {
    console.error('加载仪表板数据失败:', error)
  } finally {
    chartLoading.value = false
  }
}

const updateTrafficChart = () => {
  const trendData = dashboardData.value.traffic_trend || []
  
  trafficChartOption.value = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: ['流量 (MB)', '连接数']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: trendData.map(item => dayjs(item.date).format('MM-DD'))
    },
    yAxis: [
      {
        type: 'value',
        name: '流量 (MB)',
        position: 'left'
      },
      {
        type: 'value',
        name: '连接数',
        position: 'right'
      }
    ],
    series: [
      {
        name: '流量 (MB)',
        type: 'line',
        data: trendData.map(item => item.traffic || 0),
        smooth: true,
        itemStyle: {
          color: '#409eff'
        }
      },
      {
        name: '连接数',
        type: 'line',
        yAxisIndex: 1,
        data: trendData.map(item => item.connections || 0),
        smooth: true,
        itemStyle: {
          color: '#67c23a'
        }
      }
    ]
  }
}

const updateRegionChart = () => {
  const regionData = dashboardData.value.region_distribution || []
  
  regionChartOption.value = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '地区分布',
        type: 'pie',
        radius: '50%',
        data: regionData.map(item => ({
          value: item.count,
          name: item.region || '未知'
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }
}

const changeTrendPeriod = async (period) => {
  trendPeriod.value = period
  try {
    chartLoading.value = true
    const data = await api.get('/stats/traffic-trend', { days: period })
    dashboardData.value.traffic_trend = data.data
    updateTrafficChart()
  } catch (error) {
    console.error('加载流量趋势失败:', error)
  } finally {
    chartLoading.value = false
  }
}

const formatTraffic = (traffic) => {
  if (!traffic) return '0 MB'
  
  if (traffic >= 1024) {
    return `${(traffic / 1024).toFixed(1)} GB`
  }
  return `${Math.round(traffic)} MB`
}

const formatAction = (action) => {
  const actionMap = {
    'CREATE_NODE': '创建节点',
    'UPDATE_NODE': '更新节点',
    'DELETE_NODE': '删除节点',
    'UPDATE_TECH_SUPPORT': '更新技术支持',
    'IMPORT_NODE_URL': '导入节点',
    'BATCH_IMPORT_NODES': '批量导入节点',
    'CLEANUP_DATA': '清理数据'
  }
  return actionMap[action] || action
}

const formatTime = (time) => {
  return dayjs(time).format('MM-DD HH:mm')
}

const getProtocolPercentage = (count) => {
  const total = dashboardData.value.protocol_distribution?.reduce((sum, item) => sum + item.count, 0) || 1
  return Math.round((count / total) * 100)
}

// 生命周期
onMounted(() => {
  loadDashboardData()
  
  // 定时刷新数据
  refreshTimer.value = setInterval(loadDashboardData, 60000) // 1分钟刷新一次
})

onUnmounted(() => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
  }
})
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.page-title {
  margin-bottom: 30px;
}

.page-title h1 {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.page-title p {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.stats-cards {
  margin-bottom: 30px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 24px;
  min-height: 120px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  color: white;
}

.stat-icon.nodes {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.traffic {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.latency {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.admins {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-sub {
  font-size: 12px;
  color: #67c23a;
}

.charts-section,
.bottom-section {
  margin-bottom: 30px;
}

.chart-container {
  padding: 20px 0;
}

.protocol-list {
  padding: 20px 0;
}

.protocol-item {
  margin-bottom: 20px;
}

.protocol-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.protocol-name {
  font-weight: 600;
  color: #303133;
}

.protocol-count {
  font-size: 14px;
  color: #909399;
}

.protocol-bar {
  height: 6px;
  background-color: #f5f7fa;
  border-radius: 3px;
  overflow: hidden;
}

.protocol-progress {
  height: 100%;
  background: linear-gradient(90deg, #409eff 0%, #67c23a 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.logs-list {
  padding: 20px 0;
  max-height: 300px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.log-item:last-child {
  border-bottom: none;
}

.log-content {
  flex: 1;
}

.log-action {
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.log-meta {
  font-size: 12px;
  color: #909399;
}

.log-user {
  margin-right: 12px;
}

.empty-logs {
  text-align: center;
  padding: 40px 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stat-card {
    flex-direction: column;
    text-align: center;
    padding: 20px;
  }
  
  .stat-icon {
    margin-right: 0;
    margin-bottom: 16px;
  }
  
  .stat-number {
    font-size: 28px;
  }
  
  .charts-section .el-col,
  .bottom-section .el-col {
    margin-bottom: 20px;
  }
}
</style>
