import Cookies from 'js-cookie'

const TOKEN_KEY = 'vpn_admin_token'
const USER_KEY = 'vpn_admin_user'

// Token管理
export function getToken() {
  return Cookies.get(TOKEN_KEY)
}

export function setToken(token) {
  return Cookies.set(TOKEN_KEY, token, { expires: 1 }) // 1天过期
}

export function removeToken() {
  return Cookies.remove(TOKEN_KEY)
}

// 用户信息管理
export function getUser() {
  const userStr = localStorage.getItem(USER_KEY)
  if (userStr) {
    try {
      return JSON.parse(userStr)
    } catch (e) {
      console.error('解析用户信息失败:', e)
      return null
    }
  }
  return null
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function removeUser() {
  localStorage.removeItem(USER_KEY)
}

// 清除所有认证信息
export function clearAuth() {
  removeToken()
  removeUser()
}

// 检查是否已登录
export function isLoggedIn() {
  return !!getToken()
}

// 检查用户权限
export function hasPermission(permission) {
  const user = getUser()
  if (!user) return false
  
  // 超级管理员拥有所有权限
  if (user.role === 'super_admin') return true
  
  // 普通管理员权限检查
  if (user.role === 'admin') {
    const adminPermissions = [
      'view_dashboard',
      'manage_nodes',
      'manage_tech_support',
      'view_stats',
      'view_logs'
    ]
    return adminPermissions.includes(permission)
  }
  
  return false
}

// 检查是否为超级管理员
export function isSuperAdmin() {
  const user = getUser()
  return user && user.role === 'super_admin'
}
