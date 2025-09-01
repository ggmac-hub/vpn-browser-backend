<template>
  <div class="pricing-container">
    <div class="page-header">
      <h1>套餐价格管理</h1>
      <p>管理会员套餐的价格和配置</p>
    </div>

    <!-- 操作栏 -->
    <div class="actions-bar">
      <el-button type="primary" @click="showCreateDialog">
        <el-icon><Plus /></el-icon>
        添加套餐
      </el-button>
      <el-button @click="fetchPlans">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <!-- 套餐列表 -->
    <el-card>
      <el-table 
        v-loading="loading" 
        :data="planList" 
        style="width: 100%"
        :default-sort="{ prop: 'duration_days', order: 'ascending' }"
      >
        <el-table-column prop="name" label="套餐名称" width="120">
          <template #default="scope">
            <el-tag size="large" :type="getTagType(scope.row.duration_days)">
              {{ scope.row.name }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="duration_days" label="有效期" width="100" sortable>
          <template #default="scope">
            {{ scope.row.duration_days }} 天
          </template>
        </el-table-column>
        
        <el-table-column prop="price" label="现价" width="100">
          <template #default="scope">
            <span class="price-text">¥{{ scope.row.price }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="original_price" label="原价" width="100">
          <template #default="scope">
            <span v-if="scope.row.original_price > scope.row.price" class="original-price">
              ¥{{ scope.row.original_price }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="discount_rate" label="折扣" width="80">
          <template #default="scope">
            <el-tag v-if="scope.row.discount_rate > 0" type="danger" size="small">
              {{ scope.row.discount_rate }}% OFF
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="scope">
            <el-switch
              v-model="scope.row.is_active"
              :active-value="1"
              :inactive-value="0"
              @change="updateStatus(scope.row)"
            />
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button
              type="primary"
              size="small"
              @click="editPlan(scope.row)"
            >
              编辑
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="deletePlan(scope.row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑套餐对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="isEditing ? '编辑套餐' : '添加套餐'"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form 
        ref="formRef" 
        :model="form" 
        :rules="formRules" 
        label-width="100px"
      >
        <el-form-item label="套餐名称" prop="name">
          <el-input 
            v-model="form.name" 
            placeholder="请输入套餐名称，如：月卡、季卡、年卡"
            maxlength="20"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="有效期" prop="durationDays">
          <el-input-number
            v-model="form.durationDays"
            :min="1"
            :max="3650"
            placeholder="天数"
            style="width: 100%"
          />
          <div class="form-tip">套餐的有效期天数（1-3650天）</div>
        </el-form-item>
        
        <el-form-item label="现价" prop="price">
          <el-input-number
            v-model="form.price"
            :min="0.01"
            :precision="2"
            placeholder="现价"
            style="width: 100%"
          />
          <div class="form-tip">用户实际支付的价格</div>
        </el-form-item>
        
        <el-form-item label="原价" prop="originalPrice">
          <el-input-number
            v-model="form.originalPrice"
            :min="0.01"
            :precision="2"
            placeholder="原价（可选）"
            style="width: 100%"
          />
          <div class="form-tip">用于显示折扣效果，不填则与现价相同</div>
        </el-form-item>
        
        <el-form-item label="折扣标签" prop="discountRate">
          <el-input-number
            v-model="form.discountRate"
            :min="0"
            :max="99"
            placeholder="折扣百分比"
            style="width: 100%"
          />
          <div class="form-tip">显示的折扣百分比，如：10表示10% OFF</div>
        </el-form-item>
        
        <el-form-item label="状态" prop="isActive">
          <el-switch
            v-model="form.isActive"
            active-text="启用"
            inactive-text="禁用"
          />
          <div class="form-tip">禁用后，用户将无法选择此套餐</div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            @click="handleSubmit"
            :loading="submitLoading"
          >
            {{ isEditing ? '更新' : '创建' }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import request from '../api/request'

// 响应式数据
const loading = ref(false)
const planList = ref([])
const dialogVisible = ref(false)
const isEditing = ref(false)
const submitLoading = ref(false)

// 表单数据
const form = reactive({
  id: null,
  name: '',
  price: 0,
  originalPrice: 0,
  durationDays: 30,
  discountRate: 0,
  isActive: true
})

// 表单引用
const formRef = ref()

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入套餐名称', trigger: 'blur' },
    { min: 1, max: 20, message: '套餐名称长度在 1 到 20 个字符', trigger: 'blur' }
  ],
  price: [
    { required: true, message: '请输入价格', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '价格必须大于0', trigger: 'blur' }
  ],
  durationDays: [
    { required: true, message: '请输入有效期', trigger: 'blur' },
    { type: 'number', min: 1, max: 3650, message: '有效期必须在 1-3650 天之间', trigger: 'blur' }
  ]
}

// 获取套餐列表
const fetchPlans = async () => {
  loading.value = true
  try {
    const response = await request.get('/pricing/admin/plans')
    
    if (response.success) {
      planList.value = response.data
    }
  } catch (error) {
    console.error('获取套餐列表失败:', error)
    ElMessage.error('获取套餐列表失败')
  } finally {
    loading.value = false
  }
}

// 显示创建对话框
const showCreateDialog = () => {
  isEditing.value = false
  resetForm()
  dialogVisible.value = true
}

// 编辑套餐
const editPlan = (row) => {
  isEditing.value = true
  form.id = row.id
  form.name = row.name
  form.price = row.price
  form.originalPrice = row.original_price
  form.durationDays = row.duration_days
  form.discountRate = row.discount_rate
  form.isActive = row.is_active === 1
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  Object.assign(form, {
    id: null,
    name: '',
    price: 0,
    originalPrice: 0,
    durationDays: 30,
    discountRate: 0,
    isActive: true
  })
  formRef.value?.clearValidate()
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    submitLoading.value = true
    
    const data = {
      name: form.name,
      price: form.price,
      originalPrice: form.originalPrice || form.price,
      durationDays: form.durationDays,
      discountRate: form.discountRate,
      isActive: form.isActive
    }
    
    if (isEditing.value) {
      await request.put(`/pricing/admin/plans/${form.id}`, data)
      ElMessage.success('套餐更新成功')
    } else {
      await request.post('/pricing/admin/plans', data)
      ElMessage.success('套餐创建成功')
    }
    
    dialogVisible.value = false
    fetchPlans()
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error(isEditing.value ? '更新失败' : '创建失败')
  } finally {
    submitLoading.value = false
  }
}

// 更新状态
const updateStatus = async (row) => {
  try {
    await request.put(`/pricing/admin/plans/${row.id}`, {
      name: row.name,
      price: row.price,
      originalPrice: row.original_price,
      durationDays: row.duration_days,
      discountRate: row.discount_rate,
      isActive: row.is_active
    })
    ElMessage.success('状态更新成功')
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error('更新状态失败')
    fetchPlans() // 重新获取数据
  }
}

// 删除套餐
const deletePlan = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除套餐"${row.name}"吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await request.delete(`/pricing/admin/plans/${row.id}`)
    ElMessage.success('套餐删除成功')
    fetchPlans()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除套餐失败:', error)
      ElMessage.error(error.response?.data?.error || '删除套餐失败')
    }
  }
}

// 获取标签类型
const getTagType = (durationDays) => {
  if (durationDays <= 31) return 'primary'    // 月卡
  if (durationDays <= 93) return 'success'    // 季卡
  return 'warning'                             // 年卡
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 组件挂载时获取数据
onMounted(() => {
  fetchPlans()
})
</script>

<style scoped>
.pricing-container {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0 0 8px 0;
  color: #303133;
}

.page-header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.actions-bar {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
}

.price-text {
  color: #e6a23c;
  font-weight: bold;
}

.original-price {
  color: #909399;
  text-decoration: line-through;
  font-size: 12px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .pricing-container {
    padding: 12px;
  }
  
  .actions-bar {
    flex-direction: column;
  }
  
  .actions-bar .el-button {
    width: 100%;
  }
}
</style>
