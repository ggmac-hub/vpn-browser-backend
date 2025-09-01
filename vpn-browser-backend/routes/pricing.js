const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 获取所有套餐（管理员）
router.get('/admin/plans', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = getDatabase();
        
        db.all(`
            SELECT id, name, price, original_price, duration_days, discount_rate, 
                   is_active, created_at, updated_at
            FROM membership_plans
            ORDER BY duration_days ASC
        `, (err, rows) => {
            db.close();
            if (err) {
                console.error('获取套餐列表失败:', err);
                return res.status(500).json({ error: '获取套餐列表失败' });
            }
            
            res.json({
                success: true,
                data: rows
            });
        });
    } catch (error) {
        console.error('获取套餐列表失败:', error);
        res.status(500).json({ error: '获取套餐列表失败' });
    }
});

// 更新套餐价格（管理员）
router.put('/admin/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, originalPrice, durationDays, discountRate, isActive } = req.body;
        
        if (!name || !price || !durationDays) {
            return res.status(400).json({ error: '套餐名称、价格和有效期不能为空' });
        }
        
        if (price <= 0 || durationDays <= 0) {
            return res.status(400).json({ error: '价格和有效期必须大于0' });
        }
        
        const db = getDatabase();
        
        db.run(`
            UPDATE membership_plans 
            SET name = ?, price = ?, original_price = ?, duration_days = ?, 
                discount_rate = ?, is_active = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [
            name, 
            parseFloat(price), 
            parseFloat(originalPrice) || parseFloat(price), 
            parseInt(durationDays),
            parseInt(discountRate) || 0,
            isActive ? 1 : 0,
            id
        ], function(err) {
            db.close();
            if (err) {
                console.error('更新套餐失败:', err);
                return res.status(500).json({ error: '更新套餐失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '套餐不存在' });
            }
            
            res.json({
                success: true,
                message: '套餐更新成功'
            });
        });
    } catch (error) {
        console.error('更新套餐失败:', error);
        res.status(500).json({ error: '更新套餐失败' });
    }
});

// 创建新套餐（管理员）
router.post('/admin/plans', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, price, originalPrice, durationDays, discountRate, isActive } = req.body;
        
        if (!name || !price || !durationDays) {
            return res.status(400).json({ error: '套餐名称、价格和有效期不能为空' });
        }
        
        if (price <= 0 || durationDays <= 0) {
            return res.status(400).json({ error: '价格和有效期必须大于0' });
        }
        
        const db = getDatabase();
        
        db.run(`
            INSERT INTO membership_plans (name, price, original_price, duration_days, discount_rate, is_active) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            name, 
            parseFloat(price), 
            parseFloat(originalPrice) || parseFloat(price), 
            parseInt(durationDays),
            parseInt(discountRate) || 0,
            isActive ? 1 : 0
        ], function(err) {
            db.close();
            if (err) {
                console.error('创建套餐失败:', err);
                return res.status(500).json({ error: '创建套餐失败' });
            }
            
            res.json({
                success: true,
                message: '套餐创建成功',
                data: { id: this.lastID }
            });
        });
    } catch (error) {
        console.error('创建套餐失败:', error);
        res.status(500).json({ error: '创建套餐失败' });
    }
});

// 删除套餐（管理员）
router.delete('/admin/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query; // 强制删除参数
        
        const db = getDatabase();
        
        // 新的设计：套餐和会员记录解耦，可以直接删除套餐
        // 但为了安全起见，仍然检查是否有活跃用户（可选）
        if (force !== 'true') {
            db.get(`
                SELECT COUNT(*) as count 
                FROM user_memberships 
                WHERE plan_id = ? AND status IN ('active', 'renewal') AND datetime(end_date) > datetime('now')
            `, [id], (err, result) => {
                if (err) {
                    db.close();
                    console.error('检查套餐使用情况失败:', err);
                    return res.status(500).json({ error: '检查套餐使用情况失败' });
                }
                
                if (result.count > 0) {
                    db.close();
                    return res.status(200).json({ 
                        warning: `检测到有 ${result.count} 个用户曾购买此套餐，但由于新的设计，删除套餐不会影响已开通的会员`,
                        suggestion: '可以安全删除此套餐，已开通的会员将继续有效。如需确认删除，请添加 ?force=true 参数',
                        activeUsers: result.count,
                        canDelete: true
                    });
                }
                
                // 没有用户使用，直接删除
                deletePlan();
            });
        } else {
            // 强制删除
            deletePlan();
        }
        
        function deletePlan() {
            // 删除套餐
            db.run('DELETE FROM membership_plans WHERE id = ?', [id], function(err) {
                db.close();
                if (err) {
                    console.error('删除套餐失败:', err);
                    return res.status(500).json({ error: '删除套餐失败' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: '套餐不存在' });
                }
                
                res.json({
                    success: true,
                    message: '套餐删除成功，已开通的会员不受影响'
                });
            });
        }
    } catch (error) {
        console.error('删除套餐失败:', error);
        res.status(500).json({ error: '删除套餐失败' });
    }
});

module.exports = router;
