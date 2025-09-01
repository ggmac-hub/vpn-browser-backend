<template>
  <div class="stats-page">
    <div class="page-header">
      <h1>📊 统计分析</h1>
      <p>实时监控系统运行状态和节点性能数据</p>
    </div>
    
    <!-- 概览统计卡片 -->
    <el-row :gutter="20" class="stats-cards">
      <el-col :xs="12" :sm="6" :md="6" :lg="6">
        <div class="dashboard-card stat-card">
          <div class="stat-icon nodes">
            <el-icon size="32"><Connection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ overviewStats.total_nodes || 0 }}</div>
            <div class="stat-label">总节点数</div>
            <div class="stat-sub">
              活跃: {{ overviewStats.active_nodes || 0 }}
            </div>
          </div>
        </div>
      </el-col>
      
      <el-col :xs="12" :sm="6" :md="6" :lg="6">
        <div class="dashboard-card stat-card">
          <div class="stat-icon protocols">
            <el-icon size="32"><Grid /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ overviewStats.protocols || 0 }}</div>
            <div class="stat-label">支持协议</div>
            <div class="stat-sub">
              地区: {{ overviewStats.regions || 0 }}
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
            <div class="stat-number">{{ formatTraffic(todayStats.today_traffic) }}</div>
            <div class="stat-label">今日流量</div>
            <div class="stat-sub">
              连接: {{ todayStats.today_connections || 0 }}
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
            <div class="stat-number">{{ Math.round(todayStats.avg_latency || 0) }}ms</div>
            <div class="stat-label">平均延迟</div>
            <div class="stat-sub">
              成功率: {{ Math.round(todayStats.avg_success_rate || 0) }}%
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <!-- 图表区域 -->
    <el-row :gutter="20" class="charts-section">
      <el-col :xs="24" :sm="24" :md="12" :lg="12">
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
      
      <el-col :xs="24" :sm="24" :md="12" :lg="12">
        <div class="dashboard-card">
          <div class="card-header">
            <h3 class="card-title">🔧 协议分布</h3>
          </div>
          <div class="chart-container">
            <v-chart 
              :option="protocolChartOption" 
              :loading="chartLoading"
              style="height: 300px;"
            />
          </div>
        </div>
      </el-col>
    </el-row>
    
    <!-- 节点性能排行 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">🏆 节点性能排行</h3>
        <div class="header-actions">
          <el-select v-model="rankingMetric" @change="loadNodeRanking" style="width: 120px; margin-right: 12px;">
            <el-option label="流量" value="traffic" />
            <el-option label="连接数" value="connections" />
            <el-option label="延迟" value="latency" />
            <el-option label="成功率" value="success_rate" />
          </el-select>
          <el-button @click="loadNodeRanking" :icon="Refresh" :loading="rankingLoading">
            刷新
          </el-button>
        </div>
      </div>
      
      <el-table :data="nodeRanking" v-loading="rankingLoading" stripe>
        <el-table-column type="index" label="排名" width="60">
          <template #default="{ $index }">
            <el-tag 
              :type="getRankingType($index)" 
              size="small"
            >
              {{ $index + 1 }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="name" label="节点名称" min-width="150">
          <template #default="{ row }">
            <div class="node-info">
              <el-tag :type="getProtocolType(row.protocol)" size="small" style="margin-right: 8px;">
                {{ row.protocol.toUpperCase() }}
              </el-tag>
              {{ row.name }}
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="region" label="地区" width="100">
          <template #default="{ row }">
            <span v-if="row.region">{{ row.region }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="total_traffic" label="总流量" width="120">
          <template #default="{ row }">
            {{ formatTraffic(row.total_traffic) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="total_connections" label="总连接数" width="100" />
        
        <el-table-column prop="avg_latency" label="平均延迟" width="100">
          <template #default="{ row }">
            <span :class="getLatencyClass(row.avg_latency)">
              {{ Math.round(row.avg_latency || 0) }}ms
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="avg_success_rate" label="成功率" width="100">
          <template #default="{ row }">
            <el-progress 
              :percentage="Math.round(row.avg_success_rate || 0)" 
              :color="getSuccessRateColor(row.avg_success_rate)"
              :show-text="true"
              :stroke-width="8"
            />
          </template>
        </el-table-column>
        
        <el-table-column prop="active_days" label="活跃天数" width="100" />
      </el-table>
      
      <!-- 空状态 -->
      <div v-if="!rankingLoading && nodeRanking.length === 0" class="empty-state">
        <el-empty description="暂无节点性能数据" :image-size="80">
          <el-text size="small" type="info">
            节点开始使用后会显示性能统计数据
          </el-text>
        </el-empty>
      </div>
    </div>
    
    <!-- 实时监控 -->
    <div class="dashboard-card">
      <div class="card-header">
        <h3 class="card-title">⚡ 实时监控</h3>
        <div class="header-actions">
          <el-switch
            v-model="autoRefresh"
            active-text="自动刷新"
            @change="toggleAutoRefresh"
          />
          <el-button @click="loadRealtimeStats" :icon="Refresh" :loading="realtimeLoading">
            手动刷新
          </el-button>
        </div>
      </div>
      
      <div class="realtime-grid">
        <div 
          v-for="node in realtimeStats" 
          :key="node.node_id"
          class="realtime-card"
        >
          <div class="realtime-header">
            <div class="node-name">
              <el-tag :type="getProtocolType(node.protocol)" size="small">
                {{ node.protocol.toUpperCase() }}
              </el-tag>
              <span>{{ node.node_name }}</span>
            </div>
            <div class="node-status">
              <el-tag :type="getStatusType(node.status)" size="small">
                {{ getStatusText(node.status) }}
              </el-tag>
            </div>
          </div>
          
          <div class="realtime-metrics">
            <div class="metric-item">
              <span class="metric-label">连接数</span>
              <span class="metric-value">{{ node.current_connections || 0 }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">流量</span>
              <span class="metric-value">{{ (node.current_traffic || 0).toFixed(1) }} Mbps</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">延迟</span>
              <span class="metric-value" :class="getLatencyClass(node.latency)">
                {{ Math.round(node.latency || 0) }}ms
              </span>
            </div>
            <div class="metric-item">
              <span class="metric-label">CPU</span>
              <span class="metric-value">{{ (node.cpu_usage || 0).toFixed(1) }}%</span>
            </div>
          </div>
          
          <div class="realtime-footer">
            <el-text size="small" type="info">
              {{ formatTime(node.last_update) }}
            </el-text>
          </div>
        </div>
      </div>
      
      <!-- 空状态 -->
      <div v-if="!realtimeLoading && realtimeStats.length === 0" class="empty-state">
        <el-empty description="暂无实时监控数据" :image-size="80">
          <el-text size="small" type="info">
            节点开始运行后会显示实时监控数据
          </el-text>
        </el-empty>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { Connection, Grid, TrendCharts, Timer, Refresh } from '@element-plus/icons-vue'
import { api } from '../api/request'
import dayjs from 'dayjs'

// 注册ECharts组件
use([
  CanvasRenderer,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

// 响应式数据
const overviewStats = ref({})
const todayStats = ref({})
const nodeRanking = ref([])
const realtimeStats = ref([])

const chartLoading = ref(false)
const rankingLoading = ref(false)
const realtimeLoading = ref(false)

const trendPeriod = ref('7')
const rankingMetric = ref('traffic')
const autoRefresh = ref(false)

// 图表配置
const trafficChartOption = ref({})
const protocolChartOption = ref({})

// 定时器
const refreshTimer = ref(null)

// 方法
const loadOverviewStats = async () => {
  try {
    const data = await api.get('/stats/overview')
    overviewStats.value = data.data.summary || {}
    todayStats.value = data.data.today || {}
  } catch (error) {
    console.error('加载概览统计失败:', error)
  }
}

const loadTrafficTrend = async () => {
  try {
    chartLoading.value = true
    const data = await api.get('/stats/traffic-trend', { days: trendPeriod.value })
    updateTrafficChart(data.data || [])
  } catch (error) {
    console.error('加载流量趋势失败:', error)
  } finally {
    chartLoading.value = false
  }
}

const updateTrafficChart = (trendData) => {
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
        data: trendData.map(item => item.total_traffic || 0),
        smooth: true,
        itemStyle: {
          color: '#409eff'
        }
      },
      {
        name: '连接数',
        type: 'line',
        yAxisIndex: 1,
        data: trendData.map(item => item.total_connections || 0),
        smooth: true,
        itemStyle: {
          color: '#67c23a'
        }
      }
    ]
  }
}

const loadProtocolStats = async () => {
  try {
    const data = await api.get('/dashboard')
    const protocolData = data.data.protocol_distribution || []
    updateProtocolChart(protocolData)
  } catch (error) {
    console.error('加载协议统计失败:', error)
  }
}

const updateProtocolChart = (protocolData) => {
  protocolChartOption.value = {
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
        name: '协议分布',
        type: 'pie',
        radius: '50%',
        data: protocolData.map(item => ({
          value: item.count,
          name: item.protocol.toUpperCase()
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

const loadNodeRanking = async () => {
  try {
    rankingLoading.value = true
    const data = await api.get('/stats/node-ranking', { 
      metric: rankingMetric.value,
      limit: 10 
    })
    nodeRanking.value = data.data || []
  } catch (error) {
    console.error('加载节点排行失败:', error)
  } finally {
    rankingLoading.value = false
  }
}

const loadRealtimeStats = async () => {
  try {
    realtimeLoading.value = true
    const data = await api.get('/stats/realtime')
    realtimeStats.value = data.data || []
  } catch (error) {
    console.error('加载实时统计失败:', error)
  } finally {
    realtimeLoading.value = false
  }
}

const changeTrendPeriod = (period) => {
  trendPeriod.value = period
  loadTrafficTrend()
}

const toggleAutoRefresh = () => {
  if (autoRefresh.value) {
    refreshTimer.value = setInterval(() => {
      loadRealtimeStats()
    }, 10000) // 10秒刷新一次
  } else {
    if (refreshTimer.value) {
      clearInterval(refreshTimer.value)
      refreshTimer.value = null
    }
  }
}

// 工具方法
const formatTraffic = (traffic) => {
  if (!traffic) return '0 MB'
  
  if (traffic >= 1024) {
    return `${(traffic / 1024).toFixed(1)} GB`
  }
  return `${Math.round(traffic)} MB`
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('HH:mm:ss')
}

const getProtocolType = (protocol) => {
  const typeMap = {
    'vmess': 'primary',
    'vless': 'success',
    'trojan': 'warning',
    'shadowsocks': 'info'
  }
  return typeMap[protocol] || 'info'
}

const getRankingType = (index) => {
  if (index === 0) return 'danger'
  if (index === 1) return 'warning'
  if (index === 2) return 'success'
  return 'info'
}

const getLatencyClass = (latency) => {
  if (!latency) return ''
  if (latency < 100) return 'text-success'
  if (latency < 300) return 'text-warning'
  return 'text-danger'
}

const getSuccessRateColor = (rate) => {
  if (!rate) return '#f56c6c'
  if (rate >= 95) return '#67c23a'
  if (rate >= 80) return '#e6a23c'
  return '#f56c6c'
}

const getStatusType = (status) => {
  const statusMap = {
    'online': 'success',
    'offline': 'danger',
    'warning': 'warning'
  }
  return statusMap[status] || 'info'
}

const getStatusText = (status) => {
  const textMap = {
    'online': '在线',
    'offline': '离线',
    'warning': '警告'
  }
  return textMap[status] || '未知'
}

// 生命周期
onMounted(() => {
  loadOverviewStats()
  loadTrafficTrend()
  loadProtocolStats()
  loadNodeRanking()
  loadRealtimeStats()
})

onUnmounted(() => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
  }
})
</script>

<style scoped>
.stats-page {
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

.stat-icon.protocols {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.traffic {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.latency {
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

.charts-section {
  margin-bottom: 30px;
}

.chart-container {
  padding: 20px 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-info {
  display: flex;
  align-items: center;
}

.text-muted {
  color: #c0c4cc;
}

.text-success {
  color: #67c23a;
}

.text-warning {
  color: #e6a23c;
}

.text-danger {
  color: #f56c6c;
}

.realtime-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 20px 0;
}

.realtime-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;
}

.realtime-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.node-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.realtime-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 12px;
  color: #909399;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.realtime-footer {
  padding-top: 8px;
  border-top: 1px solid #e4e7ed;
  text-align: center;
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
  
  .charts-section .el-col {
    margin-bottom: 20px;
  }
  
  .realtime-grid {
    grid-template-columns: 1fr;
  }
  
  .header-actions {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
