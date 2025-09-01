<template>
  <div class="not-found-page">
    <div class="not-found-container">
      <div class="error-code">404</div>
      <div class="error-message">
        <h1>页面不存在</h1>
        <p>抱歉，您访问的页面不存在或已被移除。</p>
      </div>
      <div class="error-actions">
        <el-button type="primary" @click="goHome" size="large">
          返回首页
        </el-button>
        <el-button @click="goBack" size="large">
          返回上页
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/dashboard')
}

const goBack = () => {
  router.go(-1)
}
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.not-found-container {
  text-align: center;
  color: white;
}

.error-code {
  font-size: 120px;
  font-weight: bold;
  line-height: 1;
  margin-bottom: 20px;
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.error-message h1 {
  font-size: 32px;
  margin-bottom: 16px;
  font-weight: 600;
}

.error-message p {
  font-size: 16px;
  margin-bottom: 40px;
  opacity: 0.9;
}

.error-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .error-code {
    font-size: 80px;
  }
  
  .error-message h1 {
    font-size: 24px;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .error-actions .el-button {
    width: 200px;
  }
}
</style>
