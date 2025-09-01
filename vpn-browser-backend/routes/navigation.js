const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 获取导航链接列表 (用户端)
router.get('/links', async (req, res) => {
    try {
        const db = getDatabase();
        
        db.all(`
            SELECT id, title, url, description, sort_order, category 
            FROM navigation_links 
            WHERE is_active = 1 
            ORDER BY category ASC, sort_order ASC, created_at DESC
        `, (err, rows) => {
            db.close();
            if (err) {
                console.error('获取导航链接失败:', err);
                return res.status(500).json({ error: '获取导航链接失败' });
            }
            
            res.json({
                message: '获取导航链接成功',
                data: rows || []
            });
        });
    } catch (error) {
        console.error('获取导航链接失败:', error);
        res.status(500).json({ error: '获取导航链接失败' });
    }
});

// 管理员 - 获取导航链接列表
router.get('/admin/links', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;
        
        const db = getDatabase();
        
        let whereClause = '';
        let params = [];
        
        if (search) {
            whereClause = 'WHERE title LIKE ? OR url LIKE ? OR description LIKE ?';
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }
        
        // 获取总数
        const countSql = `SELECT COUNT(*) as count FROM navigation_links ${whereClause}`;
        db.get(countSql, params, (err, countRow) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取导航链接失败' });
            }
            
            const total = countRow.count;
            
            // 获取列表数据
            const listSql = `
                SELECT n.*, a.username as created_by_name
                FROM navigation_links n
                LEFT JOIN admins a ON n.created_by = a.id
                ${whereClause}
                ORDER BY n.sort_order ASC, n.created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            db.all(listSql, [...params, parseInt(limit), offset], (err, rows) => {
                db.close();
                if (err) {
                    console.error('获取导航链接失败:', err);
                    return res.status(500).json({ error: '获取导航链接失败' });
                }
                
                res.json({
                    message: '获取导航链接成功',
                    data: {
                        links: rows || [],
                        pagination: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            total,
                            pages: Math.ceil(total / limit)
                        }
                    }
                });
            });
        });
    } catch (error) {
        console.error('获取导航链接失败:', error);
        res.status(500).json({ error: '获取导航链接失败' });
    }
});

// 管理员 - 创建导航链接
router.post('/admin/links', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, url, description, category, sortOrder } = req.body;
        
        if (!title || !url) {
            return res.status(400).json({ error: '标题和链接不能为空' });
        }
        
        const db = getDatabase();
        
        db.run(`
            INSERT INTO navigation_links (title, url, description, category, sort_order, created_by) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [title, url, description || '', category || '其他', parseInt(sortOrder) || 0, req.user.id], function(err) {
            db.close();
            if (err) {
                console.error('创建导航链接失败:', err);
                return res.status(500).json({ error: '创建导航链接失败' });
            }
            
            res.status(201).json({
                message: '导航链接创建成功',
                data: {
                    id: this.lastID,
                    title,
                    url,
                    description: description || '',
                    sortOrder: parseInt(sortOrder) || 0
                }
            });
        });
    } catch (error) {
        console.error('创建导航链接失败:', error);
        res.status(500).json({ error: '创建导航链接失败' });
    }
});

// 管理员 - 更新导航链接
router.put('/admin/links/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, url, description, category, sortOrder, isActive } = req.body;
        
        if (!title || !url) {
            return res.status(400).json({ error: '标题和链接不能为空' });
        }
        
        const db = getDatabase();
        
        db.run(`
            UPDATE navigation_links 
            SET title = ?, url = ?, description = ?, category = ?, sort_order = ?, is_active = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [title, url, description || '', category || '其他', parseInt(sortOrder) || 0, isActive ? 1 : 0, id], function(err) {
            db.close();
            if (err) {
                console.error('更新导航链接失败:', err);
                return res.status(500).json({ error: '更新导航链接失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '导航链接不存在' });
            }
            
            res.json({
                message: '导航链接更新成功',
                data: {
                    id: parseInt(id),
                    title,
                    url,
                    description: description || '',
                    sortOrder: parseInt(sortOrder) || 0,
                    isActive: isActive ? 1 : 0
                }
            });
        });
    } catch (error) {
        console.error('更新导航链接失败:', error);
        res.status(500).json({ error: '更新导航链接失败' });
    }
});

// 管理员 - 删除导航链接
router.delete('/admin/links/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const db = getDatabase();
        
        db.run('DELETE FROM navigation_links WHERE id = ?', [id], function(err) {
            db.close();
            if (err) {
                console.error('删除导航链接失败:', err);
                return res.status(500).json({ error: '删除导航链接失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '导航链接不存在' });
            }
            
            res.json({
                message: '导航链接删除成功'
            });
        });
    } catch (error) {
        console.error('删除导航链接失败:', error);
        res.status(500).json({ error: '删除导航链接失败' });
    }
});

// 管理员 - 批量更新排序
router.put('/admin/links/batch/sort', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { links } = req.body;
        
        if (!Array.isArray(links)) {
            return res.status(400).json({ error: '参数格式错误' });
        }
        
        const db = getDatabase();
        
        // 开始事务
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            let completed = 0;
            let hasError = false;
            
            links.forEach((link, index) => {
                if (hasError) return;
                
                db.run('UPDATE navigation_links SET sort_order = ? WHERE id = ?', 
                    [link.sortOrder || index, link.id], function(err) {
                    if (err) {
                        hasError = true;
                        db.run('ROLLBACK');
                        db.close();
                        return res.status(500).json({ error: '更新排序失败' });
                    }
                    
                    completed++;
                    if (completed === links.length) {
                        db.run('COMMIT');
                        db.close();
                        res.json({ message: '排序更新成功' });
                    }
                });
            });
        });
    } catch (error) {
        console.error('批量更新排序失败:', error);
        res.status(500).json({ error: '批量更新排序失败' });
    }
});

module.exports = router;
