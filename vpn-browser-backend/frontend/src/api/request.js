import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getToken, clearAuth } from '../utils/auth'
import router from '../router'

// 创建axios实例
const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
request.interceptors.request.use(
  config => {
    // 添加认证token
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // 添加时间戳防止缓存
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      }
    }
    
    return config
  },
  error => {
    console.error('请求拦截器错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    const { data } = response
    
    // 如果是文件下载，直接返回
    if (response.headers['content-type']?.includes('application/octet-stream')) {
      return response
    }
    
    return data
  },
  error => {
    console.error('API请求失败:', error)
    
    const { response } = error
    
    if (!response) {
      ElMessage.error('网络连接失败，请检查网络设置')
      return Promise.reject(error)
    }
    
    const { status, data } = response
    
    switch (status) {
      case 401:
        ElMessage.error('登录已过期，请重新登录')
        clearAuth()
        router.push('/login')
        break
        
      case 403:
        ElMessage.error('权限不足，无法访问该资源')
        break
        
      case 404:
        ElMessage.error('请求的资源不存在')
        break
        
      case 422:
        // 表单验证错误
        if (data && data.errors) {
          const errorMessages = Object.values(data.errors).flat()
          ElMessage.error(errorMessages.join(', '))
        } else {
          ElMessage.error(data?.message || '请求参数错误')
        }
        break
        
      case 429:
        ElMessage.error('请求过于频繁，请稍后再试')
        break
        
      case 500:
        ElMessage.error('服务器内部错误，请联系管理员')
        break
        
      case 502:
      case 503:
      case 504:
        ElMessage.error('服务暂时不可用，请稍后再试')
        break
        
      default:
        ElMessage.error(data?.error || data?.message || `请求失败 (${status})`)
    }
    
    return Promise.reject(error)
  }
)

// 通用请求方法
export const api = {
  get(url, params = {}) {
    return request.get(url, { params })
  },
  
  post(url, data = {}) {
    return request.post(url, data)
  },
  
  put(url, data = {}) {
    return request.put(url, data)
  },
  
  delete(url, params = {}) {
    return request.delete(url, { params })
  },
  
  upload(url, formData, onProgress) {
    return request.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: onProgress
    })
  },
  
  download(url, params = {}) {
    return request.get(url, {
      params,
      responseType: 'blob'
    })
  }
}

// 批量请求
export function batchRequest(requests) {
  return Promise.allSettled(requests.map(req => {
    const { method, url, data, params } = req
    return api[method](url, method === 'get' ? params : data)
  }))
}

// 重试请求
export function retryRequest(requestFn, maxRetries = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    let retries = 0
    
    const attempt = () => {
      requestFn()
        .then(resolve)
        .catch(error => {
          retries++
          if (retries < maxRetries) {
            setTimeout(attempt, delay * retries)
          } else {
            reject(error)
          }
        })
    }
    
    attempt()
  })
}

export default request
