<template>
  <div class="categories-container">
    <div class="page-header">
      <h1>分区管理</h1>
      <p>管理课程表的分区分类</p>
    </div>

    <!-- 操作栏 -->
    <div class="actions-bar">
      <el-button type="primary" @click="showCreateDialog">
        <el-icon><Plus /></el-icon>
        添加分区
      </el-button>
      <el-button @click="() => fetchCategories(true)">
        <el-icon><Refresh /></el-icon>
        强制刷新
      </el-button>
    </div>

    <!-- 分区列表 -->
    <el-card>
      <el-table 
        v-loading="loading" 
        :data="categoryList" 
        style="width: 100%"
        :default-sort="{ prop: 'display_order', order: 'ascending' }"
      >
        <el-table-column prop="name" label="分区名称" min-width="150">
          <template #default="scope">
            <el-tag size="large" type="primary">{{ scope.row.name }}</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="display_order" label="显示顺序" width="120" sortable>
          <template #default="scope">
            <el-input-number
              v-model="scope.row.display_order"
              :min="0"
              :max="999"
              size="small"
              @change="updateDisplayOrder(scope.row)"
            />
          </template>
        </el-table-column>
        
        <el-table-column prop="link_count" label="链接数量" width="100">
          <template #default="scope">
            <el-tag size="small" :type="scope.row.link_count > 0 ? 'success' : 'info'">
              {{ scope.row.link_count || 0 }}
            </el-tag>
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
              @click="editCategory(scope.row)"
            >
              编辑
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="deleteCategory(scope.row)"
              :disabled="scope.row.link_count > 0"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchCategories"
          @current-change="fetchCategories"
        />
      </div>
    </el-card>

    <!-- 创建/编辑分区对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="isEditing ? '编辑分区' : '添加分区'"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form 
        ref="formRef" 
        :model="form" 
        :rules="formRules" 
        label-width="100px"
      >
        <el-form-item label="分区名称" prop="name">
          <el-input 
            v-model="form.name" 
            placeholder="请输入分区名称，如：美术区、音乐区等"
            maxlength="20"
            show-word-limit
          />
          <div class="form-tip">分区名称将显示在用户的课程表中</div>
        </el-form-item>
        
        <el-form-item label="显示顺序" prop="displayOrder">
          <el-input-number
            v-model="form.displayOrder"
            :min="0"
            :max="999"
            placeholder="数值越小越靠前"
            style="width: 100%"
          />
          <div class="form-tip">数值越小，分区在课程表中的显示位置越靠前</div>
        </el-form-item>
        
        <el-form-item v-if="isEditing" label="状态" prop="isActive">
          <el-switch
            v-model="form.isActive"
            active-text="启用"
            inactive-text="禁用"
          />
          <div class="form-tip">禁用后，该分区将不会在用户端显示</div>
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
const categoryList = ref([])
const dialogVisible = ref(false)
const isEditing = ref(false)
const submitLoading = ref(false)

// 分页数据
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 表单数据
const form = reactive({
  id: null,
  name: '',
  displayOrder: 0,
  isActive: true
})

// 表单引用
const formRef = ref()

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入分区名称', trigger: 'blur' },
    { min: 1, max: 20, message: '分区名称长度在 1 到 20 个字符', trigger: 'blur' }
  ],
  displayOrder: [
    { type: 'number', min: 0, max: 999, message: '显示顺序必须在 0-999 之间', trigger: 'blur' }
  ]
}

// 获取分区列表
const fetchCategories = async (forceRefresh = false) => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    }
    
    // 强制刷新时添加时间戳
    if (forceRefresh) {
      params._t = Date.now()
    }
    
    const response = await request.get('/categories/admin/list', { params })
    
    if (response.success) {
      categoryList.value = response.data.categories
      pagination.total = response.data.pagination.total
    }
  } catch (error) {
    console.error('获取分区列表失败:', error)
    ElMessage.error('获取分区列表失败')
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

// 编辑分区
const editCategory = (row) => {
  isEditing.value = true
  form.id = row.id
  form.name = row.name
  form.displayOrder = row.display_order
  form.isActive = row.is_active === 1
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  Object.assign(form, {
    id: null,
    name: '',
    displayOrder: 0,
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
      displayOrder: form.displayOrder,
      isActive: form.isActive
    }
    
    if (isEditing.value) {
      await request.put(`/categories/admin/update/${form.id}`, data)
      ElMessage.success('分区更新成功')
    } else {
      await request.post('/categories/admin/create', data)
      ElMessage.success('分区创建成功')
    }
    
    dialogVisible.value = false
    fetchCategories(true)
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error(isEditing.value ? '更新失败' : '创建失败')
  } finally {
    submitLoading.value = false
  }
}

// 更新显示顺序
const updateDisplayOrder = async (row) => {
  try {
    await request.put(`/categories/admin/update/${row.id}`, {
      name: row.name,
      displayOrder: row.display_order,
      isActive: row.is_active
    })
    ElMessage.success('显示顺序更新成功')
  } catch (error) {
    console.error('更新显示顺序失败:', error)
    ElMessage.error('更新显示顺序失败')
    fetchCategories(true) // 重新获取数据
  }
}

// 更新状态
const updateStatus = async (row) => {
  try {
    await request.put(`/categories/admin/update/${row.id}`, {
      name: row.name,
      displayOrder: row.display_order,
      isActive: row.is_active
    })
    ElMessage.success('状态更新成功')
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error('更新状态失败')
    fetchCategories(true) // 重新获取数据
  }
}

// 删除分区
const deleteCategory = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除分区"${row.name}"吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await request.delete(`/categories/admin/delete/${row.id}`)
    ElMessage.success('分区删除成功')
    // 强制刷新以获取最新的链接数量
    fetchCategories(true)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除分区失败:', error)
      ElMessage.error(error.response?.data?.error || '删除分区失败')
    }
  }
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 组件挂载时获取数据
onMounted(() => {
  fetchCategories()
})
</script>

<style scoped>
.categories-container {
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

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
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
  .categories-container {
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
