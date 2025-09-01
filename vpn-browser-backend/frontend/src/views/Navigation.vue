<template>
  <div class="navigation-management">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1>网址导航管理</h1>
        <p>管理用户端显示的导航链接</p>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon>
          添加导航
        </el-button>
      </div>
    </div>

    <!-- 搜索和操作栏 -->
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="搜索导航">
          <el-input
            v-model="searchForm.search"
            placeholder="输入标题或链接搜索"
            clearable
            style="width: 300px"
            @keyup.enter="fetchNavigationLinks"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchNavigationLinks">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetSearch">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 导航列表 -->
    <el-card class="table-card">
      <el-table
        v-loading="loading"
        :data="navigationList"
        style="width: 100%"
        row-key="id"
      >
        <el-table-column prop="sort_order" label="排序" width="80" sortable>
          <template #default="scope">
            <el-input-number
              v-model="scope.row.sort_order"
              :min="0"
              :max="999"
              size="small"
              @change="updateSortOrder(scope.row)"
            />
          </template>
        </el-table-column>
        
        <el-table-column prop="title" label="标题" min-width="150">
          <template #default="scope">
            <div class="link-title">
              <el-icon><Link /></el-icon>
              <span>{{ scope.row.title }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="url" label="链接" min-width="200">
          <template #default="scope">
            <el-link :href="scope.row.url" target="_blank" type="primary">
              {{ scope.row.url }}
            </el-link>
          </template>
        </el-table-column>
        
        <el-table-column prop="description" label="描述" min-width="150">
          <template #default="scope">
            <span>{{ scope.row.description || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="category" label="分类" width="120">
          <template #default="scope">
            <el-tag size="small" type="primary">{{ scope.row.category || '其他' }}</el-tag>
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
              @click="editNavigation(scope.row)"
            >
              编辑
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="deleteNavigation(scope.row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchNavigationLinks"
          @current-change="fetchNavigationLinks"
        />
      </div>
    </el-card>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑导航' : '添加导航'"
      width="600px"
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入导航标题" />
        </el-form-item>
        
        <el-form-item label="链接" prop="url">
          <el-input v-model="form.url" placeholder="请输入完整链接，如：https://example.com" />
          <div class="form-tip">请输入完整的URL地址，包含 http:// 或 https://</div>
        </el-form-item>
        
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入导航描述（可选）"
          />
        </el-form-item>
        
        <el-form-item label="分类" prop="category">
          <el-select 
            v-model="form.category" 
            placeholder="请选择分类"
            filterable
            allow-create
            style="width: 100%"
          >
            <el-option
              v-for="category in availableCategories"
              :key="category.name"
              :label="category.name"
              :value="category.name"
            />
          </el-select>
          <div class="form-tip">选择已有分类或输入新分类名称。新分类将自动创建。</div>
        </el-form-item>
        
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number
            v-model="form.sortOrder"
            :min="0"
            :max="999"
            placeholder="数字越小排序越靠前"
          />
          <div class="form-tip">数字越小排序越靠前，默认为0</div>
        </el-form-item>
        
        <el-form-item label="状态" prop="isActive">
          <el-switch
            v-model="form.isActive"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">
          {{ isEditing ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Link } from '@element-plus/icons-vue'
import request from '../api/request'

// 响应式数据
const loading = ref(false)
const navigationList = ref([])
const availableCategories = ref([])
const dialogVisible = ref(false)
const isEditing = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)

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

// 表单数据
const form = reactive({
  title: '',
  url: '',
  description: '',
  category: '',
  sortOrder: 0,
  isActive: true
})

// 表单验证规则
const formRules = {
  title: [
    { required: true, message: '请输入导航标题', trigger: 'blur' },
    { min: 1, max: 50, message: '标题长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  url: [
    { required: true, message: '请输入链接地址', trigger: 'blur' },
    { 
      pattern: /^https?:\/\/.+/, 
      message: '请输入有效的URL地址，需要包含 http:// 或 https://', 
      trigger: 'blur' 
    }
  ],
  description: [
    { max: 200, message: '描述长度不能超过 200 个字符', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { max: 50, message: '分类名称长度不能超过 50 个字符', trigger: 'blur' }
  ],
  sortOrder: [
    { type: 'number', min: 0, max: 999, message: '排序值必须在 0-999 之间', trigger: 'blur' }
  ]
}

// 获取导航列表
const fetchNavigationLinks = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: searchForm.search
    }
    
    const response = await request.get('/navigation/admin/links', { params })
    
    if (response.message) {
      navigationList.value = response.data.links
      pagination.total = response.data.pagination.total
    }
  } catch (error) {
    console.error('获取导航列表失败:', error)
    ElMessage.error('获取导航列表失败')
  } finally {
    loading.value = false
  }
}

// 获取分区列表
const fetchCategories = async () => {
  try {
    const response = await request.get('/categories/list')
    if (response.success) {
      availableCategories.value = response.data
    }
  } catch (error) {
    console.error('获取分区列表失败:', error)
  }
}

// 重置搜索
const resetSearch = () => {
  searchForm.search = ''
  pagination.page = 1
  fetchNavigationLinks()
}

// 显示创建对话框
const showCreateDialog = () => {
  isEditing.value = false
  resetForm()
  dialogVisible.value = true
}

// 编辑导航
const editNavigation = (row) => {
  isEditing.value = true
  form.id = row.id
  form.title = row.title
  form.url = row.url
  form.description = row.description || ''
  form.category = row.category || ''
  form.sortOrder = row.sort_order
  form.isActive = row.is_active === 1
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  Object.assign(form, {
    id: null,
    title: '',
    url: '',
    description: '',
    category: '',
    sortOrder: 0,
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
      title: form.title,
      url: form.url,
      description: form.description,
      category: form.category,
      sortOrder: form.sortOrder,
      isActive: form.isActive
    }
    
    if (isEditing.value) {
      await request.put(`/navigation/admin/links/${form.id}`, data)
      ElMessage.success('导航更新成功')
    } else {
      await request.post('/navigation/admin/links', data)
      ElMessage.success('导航创建成功')
    }
    
    dialogVisible.value = false
    fetchNavigationLinks()
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error(isEditing.value ? '更新失败' : '创建失败')
  } finally {
    submitLoading.value = false
  }
}

// 更新排序
const updateSortOrder = async (row) => {
  try {
    await request.put(`/navigation/admin/links/${row.id}`, {
      title: row.title,
      url: row.url,
      description: row.description,
      category: row.category,
      sortOrder: row.sort_order,
      isActive: row.is_active
    })
    ElMessage.success('排序更新成功')
  } catch (error) {
    console.error('更新排序失败:', error)
    ElMessage.error('更新排序失败')
    fetchNavigationLinks() // 重新获取数据
  }
}

// 更新状态
const updateStatus = async (row) => {
  try {
    await request.put(`/navigation/admin/links/${row.id}`, {
      title: row.title,
      url: row.url,
      description: row.description,
      category: row.category,
      sortOrder: row.sort_order,
      isActive: row.is_active
    })
    ElMessage.success('状态更新成功')
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error('更新状态失败')
    fetchNavigationLinks() // 重新获取数据
  }
}

// 删除导航
const deleteNavigation = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除导航"${row.title}"吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await request.delete(`/navigation/admin/links/${row.id}`)
    ElMessage.success('导航删除成功')
    fetchNavigationLinks()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除导航失败:', error)
      ElMessage.error('删除导航失败')
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
  fetchNavigationLinks()
  fetchCategories()
})
</script>

<style scoped>
.navigation-management {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.header-left h1 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 24px;
}

.header-left p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.search-card {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.link-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .navigation-management {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .header-right {
    width: 100%;
  }
  
  .header-right .el-button {
    width: 100%;
  }
}
</style>
