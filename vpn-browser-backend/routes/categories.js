const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 获取所有分区（用户端）
router.get('/list', async (req, res) => {
    try {
        const db = getDatabase();
        
        db.all(`
            SELECT id, name, display_order
            FROM navigation_categories
            WHERE is_active = 1
            ORDER BY display_order ASC, name ASC
        `, (err, rows) => {
            db.close();
            if (err) {
                console.error('获取分区列表失败:', err);
                return res.status(500).json({ error: '获取分区列表失败' });
            }
            
            res.json({
                success: true,
                data: rows
            });
        });
    } catch (error) {
        console.error('获取分区列表失败:', error);
        res.status(500).json({ error: '获取分区列表失败' });
    }
});

// 管理员 - 获取所有分区
router.get('/admin/list', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        const db = getDatabase();
        
        // 获取总数
        db.get('SELECT COUNT(*) as total FROM navigation_categories', (err, countResult) => {
            if (err) {
                db.close();
                console.error('获取分区总数失败:', err);
                return res.status(500).json({ error: '获取分区总数失败' });
            }
            
            // 获取分区列表
            db.all(`
                SELECT id, name, display_order, is_active, created_at, updated_at,
                       (SELECT COUNT(*) FROM navigation_links WHERE category = navigation_categories.name) as link_count
                FROM navigation_categories
                ORDER BY display_order ASC, created_at DESC
                LIMIT ? OFFSET ?
            `, [parseInt(limit), offset], (err, rows) => {
                db.close();
                if (err) {
                    console.error('获取分区列表失败:', err);
                    return res.status(500).json({ error: '获取分区列表失败' });
                }
                
                res.json({
                    success: true,
                    data: {
                        categories: rows,
                        pagination: {
                            total: countResult.total,
                            page: parseInt(page),
                            limit: parseInt(limit),
                            pages: Math.ceil(countResult.total / limit)
                        }
                    }
                });
            });
        });
    } catch (error) {
        console.error('获取分区列表失败:', error);
        res.status(500).json({ error: '获取分区列表失败' });
    }
});

// 管理员 - 创建分区
router.post('/admin/create', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, displayOrder } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: '分区名称不能为空' });
        }
        
        const db = getDatabase();
        
        db.run(`
            INSERT INTO navigation_categories (name, display_order, created_by) 
            VALUES (?, ?, ?)
        `, [name.trim(), parseInt(displayOrder) || 0, req.user.id], function(err) {
            db.close();
            if (err) {
                console.error('创建分区失败:', err);
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return res.status(400).json({ error: '分区名称已存在' });
                }
                return res.status(500).json({ error: '创建分区失败' });
            }
            
            res.json({
                success: true,
                message: '分区创建成功',
                data: { id: this.lastID }
            });
        });
    } catch (error) {
        console.error('创建分区失败:', error);
        res.status(500).json({ error: '创建分区失败' });
    }
});

// 管理员 - 更新分区
router.put('/admin/update/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, displayOrder, isActive } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: '分区名称不能为空' });
        }
        
        const db = getDatabase();
        
        db.run(`
            UPDATE navigation_categories 
            SET name = ?, display_order = ?, is_active = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [name.trim(), parseInt(displayOrder) || 0, isActive ? 1 : 0, id], function(err) {
            db.close();
            if (err) {
                console.error('更新分区失败:', err);
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return res.status(400).json({ error: '分区名称已存在' });
                }
                return res.status(500).json({ error: '更新分区失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '分区不存在' });
            }
            
            res.json({
                success: true,
                message: '分区更新成功'
            });
        });
    } catch (error) {
        console.error('更新分区失败:', error);
        res.status(500).json({ error: '更新分区失败' });
    }
});

// 管理员 - 删除分区
router.delete('/admin/delete/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const db = getDatabase();
        
        // 先获取分区名称
        db.get('SELECT name FROM navigation_categories WHERE id = ?', [id], (err, category) => {
            if (err) {
                db.close();
                console.error('获取分区信息失败:', err);
                return res.status(500).json({ error: '获取分区信息失败' });
            }
            
            if (!category) {
                db.close();
                return res.status(404).json({ error: '分区不存在' });
            }
            
            // 检查是否有链接使用此分区
            db.get('SELECT COUNT(*) as count FROM navigation_links WHERE category = ?', [category.name], (err, result) => {
                if (err) {
                    db.close();
                    console.error('检查分区使用情况失败:', err);
                    return res.status(500).json({ error: '检查分区使用情况失败' });
                }
                
                if (result.count > 0) {
                    db.close();
                    return res.status(400).json({ 
                        error: `无法删除分区"${category.name}"，还有 ${result.count} 个链接正在使用此分区` 
                    });
                }
            
            // 删除分区
            db.run('DELETE FROM navigation_categories WHERE id = ?', [id], function(err) {
                db.close();
                if (err) {
                    console.error('删除分区失败:', err);
                    return res.status(500).json({ error: '删除分区失败' });
                }
                
                res.json({
                    success: true,
                    message: '分区删除成功'
                });
            });
            });
        });
    } catch (error) {
        console.error('删除分区失败:', error);
        res.status(500).json({ error: '删除分区失败' });
    }
});

module.exports = router;
