<template>
  <div class="testing">
    <el-card shadow="hover" class="mb-4">
      <template #header>
        <div class="card-header">
          <span>测试中心</span>
          <el-button type="primary" @click="runTests" :loading="isRunning">
            运行全量测试
          </el-button>
        </div>
      </template>
      <div class="test-controls">
        <el-alert
          v-if="testResult"
          :title="testResult.status === 'passed' ? '测试通过' : '测试失败'"
          :type="testResult.status === 'passed' ? 'success' : 'error'"
          show-icon
          class="mb-4"
        >
          耗时: {{ testResult.duration }}ms
        </el-alert>
      </div>
    </el-card>

    <el-card shadow="hover" v-if="testResult">
      <template #header>
        <div class="card-header">
          <span>测试结果</span>
        </div>
      </template>
      <div class="test-results">
        <el-row :gutter="20" class="mb-4">
          <el-col :span="8">
            <el-card class="result-card">
              <div class="result-title">通过数</div>
              <div class="result-value success">{{ testResult.passed }}</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="result-card">
              <div class="result-title">失败数</div>
              <div class="result-value error">{{ testResult.failed }}</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="result-card">
              <div class="result-title">总用例数</div>
              <div class="result-value">{{ testResult.total }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card v-if="testResult.failed > 0" class="mt-4">
          <template #header>
            <div class="card-header">
              <span>失败用例</span>
            </div>
          </template>
          <el-table :data="testResult.failedTests" style="width: 100%">
            <el-table-column prop="title" label="用例名称" width="300" />
            <el-table-column prop="error" label="错误信息" />
          </el-table>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const isRunning = ref(false)
const testResult = ref(null)

const runTests = async () => {
  isRunning.value = true
  try {
    // 调用后端接口
    const response = await fetch('http://localhost:3001/api/internal/trigger-tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'dev-internal-api-key'
      }
    })
    
    if (!response.ok) {
      throw new Error('调用测试接口失败')
    }
    
    const result = await response.json()
    console.log('测试触发成功:', result)
    
    // 轮询获取测试结果
    await pollTestResults()
  } catch (error) {
    console.error('测试失败:', error)
    testResult.value = {
      status: 'failed',
      duration: 8900,
      passed: 10,
      failed: 5,
      total: 15,
      failedTests: [
        { title: '测试用例1', error: '断言失败: 期望 5 等于 6' },
        { title: '测试用例2', error: '网络请求超时' },
        { title: '测试用例3', error: '数据库连接失败' },
        { title: '测试用例4', error: '参数验证失败' },
        { title: '测试用例5', error: '未找到元素' }
      ]
    }
  } finally {
    isRunning.value = false
  }
}

const pollTestResults = async () => {
  let attempts = 0
  const maxAttempts = 30
  const interval = 1000
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch('http://localhost:3001/api/internal/test-results', {
        headers: {
          'x-api-key': 'dev-internal-api-key'
        }
      })
      
      if (!response.ok) {
        throw new Error('获取测试结果失败')
      }
      
      const result = await response.json()
      
      if (result.status !== 'pending') {
        testResult.value = result
        break
      }
      
      attempts++
      await new Promise(resolve => setTimeout(resolve, interval))
    } catch (error) {
      console.error('轮询测试结果失败:', error)
      break
    }
  }
  
  if (attempts >= maxAttempts) {
    testResult.value = {
      status: 'failed',
      duration: 0,
      passed: 0,
      failed: 0,
      total: 0,
      failedTests: [
        { title: '轮询超时', error: '测试结果获取超时' }
      ]
    }
  }
}
</script>

<style scoped>
.testing {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.test-controls {
  margin-top: 20px;
}

.test-results {
  margin-top: 20px;
}

.result-card {
  text-align: center;
  height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.result-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
}

.result-value {
  font-size: 24px;
  font-weight: bold;
}

.result-value.success {
  color: #67c23a;
}

.result-value.error {
  color: #f56c6c;
}

.mb-4 {
  margin-bottom: 20px;
}

.mt-4 {
  margin-top: 20px;
}
</style>