<template>
  <div class="overview">
    <el-card shadow="hover" class="mb-4">
      <template #header>
        <div class="card-header">
          <span>系统概览</span>
        </div>
      </template>
      <div class="dashboard-stats">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-card class="stat-card">
              <div class="stat-title">测试状态</div>
              <div class="stat-value" :class="{ 'success': testStatus === 'passed', 'error': testStatus === 'failed' }">
                {{ testStatus }}
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="stat-card">
              <div class="stat-title">构建状态</div>
              <div class="stat-value" :class="{ 'success': buildStatus === 'success', 'error': buildStatus === 'failed' }">
                {{ buildStatus }}
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="stat-card">
              <div class="stat-title">接口健康</div>
              <div class="stat-value" :class="{ 'success': apiHealth === 'up', 'error': apiHealth === 'down' }">
                {{ apiHealth }}
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </el-card>

    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>快捷操作</span>
        </div>
      </template>
      <div class="quick-actions">
        <el-button type="primary" @click="$router.push('/testing')">
          运行测试
        </el-button>
        <el-button type="info">
          查看构建状态
        </el-button>
        <el-button type="warning">
          检查接口健康
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 模拟数据
const testStatus = ref('passed')
const buildStatus = ref('success')
const apiHealth = ref('up')
</script>

<style scoped>
.overview {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-stats {
  margin-top: 20px;
}

.stat-card {
  text-align: center;
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stat-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.stat-value.success {
  color: #67c23a;
}

.stat-value.error {
  color: #f56c6c;
}

.quick-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.mb-4 {
  margin-bottom: 20px;
}
</style>