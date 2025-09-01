import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '../utils/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { 
      title: '登录',
      requiresAuth: false 
    }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('../components/Layout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { 
          title: '仪表板',
          icon: 'DataBoard'
        }
      },
      {
        path: '/nodes',
        name: 'Nodes',
        component: () => import('../views/Nodes.vue'),
        meta: { 
          title: '节点管理',
          icon: 'Connection'
        }
      },
      {
        path: '/tech-support',
        name: 'TechSupport',
        component: () => import('../views/TechSupport.vue'),
        meta: { 
          title: '技术支持',
          icon: 'Service'
        }
      },
      {
        path: '/stats',
        name: 'Stats',
        component: () => import('../views/Stats.vue'),
        meta: { 
          title: '统计分析',
          icon: 'TrendCharts'
        }
      },

      {
        path: '/operation-logs',
        name: 'OperationLogs',
        component: () => import('../views/OperationLogs.vue'),
        meta: { 
          title: '操作日志',
          icon: 'EditPen'
        }
      },
      {
        path: '/members',
        name: 'Members',
        component: () => import('../views/Members.vue'),
        meta: { 
          title: '会员管理',
          icon: 'User'
        }
      },
      {
        path: '/agents',
        name: 'Agents',
        component: () => import('../views/Agents.vue'),
        meta: { 
          title: '代理管理',
          icon: 'Avatar'
        }
      },
              {
          path: '/navigation',
          name: 'Navigation',
          component: () => import('../views/Navigation.vue'),
          meta: {
            title: '导航管理',
            icon: 'Link'
          }
        },
        {
          path: '/categories',
          name: 'Categories',
          component: () => import('../views/Categories.vue'),
          meta: {
            title: '分区管理',
            icon: 'Collection'
          }
        },
        {
          path: '/pricing',
          name: 'Pricing',
          component: () => import('../views/Pricing.vue'),
          meta: {
            title: '套餐价格',
            icon: 'Money'
          }
        },

      {
        path: '/settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { 
          title: '系统设置',
          icon: 'Setting'
        }
      }
    ]
  },
  {
    path: '/user',
    name: 'UserLayout',
    component: () => import('../components/UserLayout.vue'),
    redirect: '/user/dashboard',
    meta: { requiresAuth: true, userOnly: true },
    children: [
      {
        path: '/user/dashboard',
        name: 'UserDashboard',
        component: () => import('../views/UserDashboard.vue'),
        meta: { 
          title: '我的账户',
          requiresAuth: true,
          userOnly: true
        }
      }
    ]
  },
  {
    path: '/user/login',
    name: 'UserLogin',
    component: () => import('../views/UserLogin.vue'),
    meta: { 
      title: '用户登录',
      requiresAuth: false 
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue'),
    meta: { 
      title: '页面不存在',
      requiresAuth: false 
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    const suffix = to.meta.userOnly ? 'VPN浏览器' : 'VPN浏览器管理后台'
    document.title = `${to.meta.title} - ${suffix}`
  }
  
  // 检查认证
  if (to.meta.requiresAuth !== false) {
    const token = getToken()
    if (!token) {
      // 根据路由类型重定向到不同的登录页
      const loginPath = to.meta.userOnly ? '/user/login' : '/login'
      next(loginPath)
      return
    }
  }
  
  // 如果已登录且访问登录页，重定向到对应的仪表板
  if ((to.path === '/login' || to.path === '/user/login') && getToken()) {
    const dashboardPath = to.path === '/user/login' ? '/user/dashboard' : '/dashboard'
    next(dashboardPath)
    return
  }
  
  next()
})

export default router
