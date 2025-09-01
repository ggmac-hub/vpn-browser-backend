const express = require('express');
const crypto = require('crypto');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireMember } = require('../middleware/auth');

const router = express.Router();

// 生成支付订单
router.post('/create-order', authenticateToken, requireMember, async (req, res) => {
    try {
        const { planId, paymentMethod } = req.body;
        const userId = req.user.id;
        
        if (!planId || !paymentMethod) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        
        const db = getDatabase();
        
        // 获取套餐信息
        db.get('SELECT * FROM membership_plans WHERE id = ? AND is_active = 1', [planId], async (err, plan) => {
            if (err || !plan) {
                db.close();
                return res.status(400).json({ error: '套餐不存在' });
            }
            
            // 生成订单号
            const orderNo = 'VPN' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
            
            // 计算开始和结束时间
            const startDate = new Date();
            const endDate = new Date(startDate.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
            
            // 查找推荐人信息
            const user = await new Promise((resolve) => {
                db.get('SELECT parent_agent_id FROM users WHERE id = ?', [userId], (err, row) => {
                    resolve(err ? null : row);
                });
            });
            
            // 创建待支付的会员记录
            db.run(`
                INSERT INTO user_memberships 
                (user_id, plan_id, agent_id, start_date, end_date, payment_amount, payment_method, payment_status, order_no, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId, planId, user?.parent_agent_id, 
                startDate.toISOString(), endDate.toISOString(), 
                plan.price, paymentMethod, 'pending', orderNo, 'pending'
            ], function(err) {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: '创建订单失败' });
                }
                
                const membershipId = this.lastID;
                db.close();
                
                // 根据支付方式生成支付参数
                const paymentParams = generatePaymentParams(orderNo, plan.price, paymentMethod, plan.name);
                
                res.json({
                    message: '订单创建成功',
                    data: {
                        orderNo,
                        membershipId,
                        planName: plan.name,
                        amount: plan.price,
                        paymentMethod,
                        paymentParams,
                        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30分钟后过期
                    }
                });
            });
        });
    } catch (error) {
        console.error('创建支付订单失败:', error);
        res.status(500).json({ error: '创建订单失败' });
    }
});

// 支付回调处理
router.post('/callback/:method', async (req, res) => {
    try {
        const { method } = req.params;
        const callbackData = req.body;
        
        console.log(`收到${method}支付回调:`, callbackData);
        
        // 验证回调签名（这里需要根据实际支付平台的签名验证方式实现）
        const isValid = verifyPaymentCallback(method, callbackData);
        
        if (!isValid) {
            return res.status(400).json({ error: '签名验证失败' });
        }
        
        const orderNo = extractOrderNo(method, callbackData);
        const paymentStatus = extractPaymentStatus(method, callbackData);
        
        if (paymentStatus === 'success') {
            await processPaymentSuccess(orderNo);
        } else if (paymentStatus === 'failed') {
            await processPaymentFailed(orderNo);
        }
        
        // 返回支付平台要求的响应格式
        res.json(getCallbackResponse(method, 'success'));
        
    } catch (error) {
        console.error('处理支付回调失败:', error);
        res.status(500).json({ error: '处理回调失败' });
    }
});

// 查询订单状态
router.get('/order-status/:orderNo', authenticateToken, requireMember, async (req, res) => {
    try {
        const { orderNo } = req.params;
        const userId = req.user.id;
        
        const db = getDatabase();
        
        db.get(`
            SELECT um.*, mp.name as plan_name 
            FROM user_memberships um
            LEFT JOIN membership_plans mp ON um.plan_id = mp.id
            WHERE um.order_no = ? AND um.user_id = ?
        `, [orderNo, userId], (err, order) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '查询订单失败' });
            }
            
            if (!order) {
                return res.status(404).json({ error: '订单不存在' });
            }
            
            res.json({
                message: '查询订单状态成功',
                data: {
                    orderNo: order.order_no,
                    planName: order.plan_name,
                    amount: order.payment_amount,
                    paymentStatus: order.payment_status,
                    status: order.status,
                    createdAt: order.created_at,
                    startDate: order.start_date,
                    endDate: order.end_date
                }
            });
        });
    } catch (error) {
        console.error('查询订单状态失败:', error);
        res.status(500).json({ error: '查询订单状态失败' });
    }
});

// 取消订单
router.post('/cancel-order/:orderNo', authenticateToken, requireMember, async (req, res) => {
    try {
        const { orderNo } = req.params;
        const userId = req.user.id;
        
        const db = getDatabase();
        
        db.run(`
            UPDATE user_memberships 
            SET status = 'cancelled', payment_status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE order_no = ? AND user_id = ? AND payment_status = 'pending'
        `, [orderNo, userId], function(err) {
            db.close();
            if (err) {
                return res.status(500).json({ error: '取消订单失败' });
            }
            
            if (this.changes === 0) {
                return res.status(400).json({ error: '订单不存在或无法取消' });
            }
            
            res.json({
                message: '订单已取消',
                data: { orderNo }
            });
        });
    } catch (error) {
        console.error('取消订单失败:', error);
        res.status(500).json({ error: '取消订单失败' });
    }
});

// 生成支付参数
function generatePaymentParams(orderNo, amount, paymentMethod, productName) {
    const params = {
        orderNo,
        amount,
        productName,
        timestamp: Date.now()
    };
    
    switch (paymentMethod) {
        case 'alipay':
            return {
                ...params,
                appId: process.env.ALIPAY_APP_ID || 'demo_app_id',
                returnUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/user/dashboard`,
                notifyUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/payment/callback/alipay`,
                // 这里应该生成真实的支付宝支付参数
                payUrl: `https://openapi.alipay.com/gateway.do?${generateAlipayParams(params)}`
            };
            
        case 'wechat':
            return {
                ...params,
                appId: process.env.WECHAT_APP_ID || 'demo_app_id',
                mchId: process.env.WECHAT_MCH_ID || 'demo_mch_id',
                notifyUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/payment/callback/wechat`,
                // 这里应该生成真实的微信支付参数
                payUrl: `weixin://wxpay/bizpayurl?${generateWechatParams(params)}`
            };
            
        default:
            return params;
    }
}

// 生成支付宝支付参数（示例）
function generateAlipayParams(params) {
    const alipayParams = {
        app_id: process.env.ALIPAY_APP_ID || 'demo_app_id',
        method: 'alipay.trade.page.pay',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        version: '1.0',
        out_trade_no: params.orderNo,
        total_amount: params.amount,
        subject: params.productName
    };
    
    // 这里应该使用真实的私钥进行签名
    const sign = 'demo_signature';
    alipayParams.sign = sign;
    
    return new URLSearchParams(alipayParams).toString();
}

// 生成微信支付参数（示例）
function generateWechatParams(params) {
    const wechatParams = {
        appid: process.env.WECHAT_APP_ID || 'demo_app_id',
        mch_id: process.env.WECHAT_MCH_ID || 'demo_mch_id',
        out_trade_no: params.orderNo,
        total_fee: Math.round(params.amount * 100), // 微信支付金额单位为分
        body: params.productName,
        trade_type: 'NATIVE'
    };
    
    // 这里应该使用真实的密钥进行签名
    const sign = 'demo_signature';
    wechatParams.sign = sign;
    
    return new URLSearchParams(wechatParams).toString();
}

// 验证支付回调签名
function verifyPaymentCallback(method, callbackData) {
    // 这里应该实现真实的签名验证逻辑
    // 目前返回true用于演示
    return true;
}

// 从回调数据中提取订单号
function extractOrderNo(method, callbackData) {
    switch (method) {
        case 'alipay':
            return callbackData.out_trade_no;
        case 'wechat':
            return callbackData.out_trade_no;
        default:
            return callbackData.orderNo;
    }
}

// 从回调数据中提取支付状态
function extractPaymentStatus(method, callbackData) {
    switch (method) {
        case 'alipay':
            return callbackData.trade_status === 'TRADE_SUCCESS' ? 'success' : 'failed';
        case 'wechat':
            return callbackData.result_code === 'SUCCESS' ? 'success' : 'failed';
        default:
            return callbackData.status;
    }
}

// 处理支付成功
async function processPaymentSuccess(orderNo) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
        // 更新订单状态
        db.run(`
            UPDATE user_memberships 
            SET payment_status = 'paid', status = 'active', updated_at = CURRENT_TIMESTAMP
            WHERE order_no = ?
        `, [orderNo], function(err) {
            if (err) {
                db.close();
                reject(err);
                return;
            }
            
            // 获取订单信息处理推广佣金
            db.get(`
                SELECT um.*, u.parent_agent_id 
                FROM user_memberships um
                LEFT JOIN users u ON um.user_id = u.id
                WHERE um.order_no = ?
            `, [orderNo], (err, order) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }
                
                if (order && order.parent_agent_id) {
                    // 处理推广佣金
                    processReferralCommission(db, order.parent_agent_id, order.user_id, order.id, order.payment_amount);
                }
                
                db.close();
                resolve();
            });
        });
    });
}

// 处理支付失败
async function processPaymentFailed(orderNo) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE user_memberships 
            SET payment_status = 'failed', status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE order_no = ?
        `, [orderNo], function(err) {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// 处理推广佣金（复用之前的逻辑）
async function processReferralCommission(db, agentId, buyerId, membershipId, amount) {
    try {
        // 查找一级代理
        const level1Agent = await new Promise((resolve) => {
            db.get('SELECT * FROM users WHERE id = ?', [agentId], (err, row) => {
                resolve(err ? null : row);
            });
        });
        
        if (level1Agent) {
            // 一级佣金 40%
            const commission1 = amount * 0.4;
            db.run(`
                INSERT INTO referral_records (referrer_id, referee_id, membership_id, level, order_amount, commission_rate, commission_amount) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [level1Agent.id, buyerId, membershipId, 1, amount, 40, commission1]);
            
            // 查找二级代理
            if (level1Agent.parent_agent_id) {
                const level2Agent = await new Promise((resolve) => {
                    db.get('SELECT * FROM users WHERE id = ?', [level1Agent.parent_agent_id], (err, row) => {
                        resolve(err ? null : row);
                    });
                });
                
                if (level2Agent) {
                    // 二级佣金 10%
                    const commission2 = amount * 0.1;
                    db.run(`
                        INSERT INTO referral_records (referrer_id, referee_id, membership_id, level, order_amount, commission_rate, commission_amount) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [level2Agent.id, buyerId, membershipId, 2, amount, 10, commission2]);
                }
            }
        }
    } catch (error) {
        console.error('处理推广佣金失败:', error);
    }
}

// 获取回调响应格式
function getCallbackResponse(method, status) {
    switch (method) {
        case 'alipay':
            return status === 'success' ? 'success' : 'fail';
        case 'wechat':
            return {
                return_code: status === 'success' ? 'SUCCESS' : 'FAIL',
                return_msg: status === 'success' ? 'OK' : 'FAIL'
            };
        default:
            return { status };
    }
}

module.exports = router;
