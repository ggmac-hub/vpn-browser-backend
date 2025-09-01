const { getDatabase } = require('../database/init');

class ProxyNode {
    // 获取所有节点
    static async getAll(filters = {}) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            let query = 'SELECT * FROM proxy_nodes WHERE 1=1';
            const params = [];
            
            if (filters.is_active !== undefined) {
                query += ' AND is_active = ?';
                params.push(filters.is_active);
            }
            
            if (filters.protocol) {
                query += ' AND protocol = ?';
                params.push(filters.protocol);
            }
            
            if (filters.region) {
                query += ' AND region = ?';
                params.push(filters.region);
            }
            
            query += ' ORDER BY priority DESC, created_at DESC';
            
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
            }
            
            db.all(query, params, (err, rows) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    // 解析JSON配置
                    const nodes = rows.map(row => ({
                        ...row,
                        config: row.config ? JSON.parse(row.config) : {}
                    }));
                    resolve(nodes);
                }
            });
        });
    }
    
    // 根据ID获取节点
    static async getById(id) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.get('SELECT * FROM proxy_nodes WHERE id = ?', [id], (err, row) => {
                db.close();
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve({
                        ...row,
                        config: row.config ? JSON.parse(row.config) : {}
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }
    
    // 创建节点
    static async create(nodeData) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const {
                name, protocol, address, port, config,
                region, country, city, priority, max_connections, created_by
            } = nodeData;
            
            db.run(`
                INSERT INTO proxy_nodes 
                (name, protocol, address, port, config, region, country, city, priority, max_connections, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                name, protocol, address, port, 
                JSON.stringify(config || {}), 
                region, country, city, priority || 0, max_connections || 1000, created_by
            ], function(err) {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: this.lastID,
                        ...nodeData,
                        config: config || {},
                        created_at: new Date().toISOString()
                    });
                }
            });
        });
    }
    
    // 更新节点
    static async update(id, nodeData) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const {
                name, protocol, address, port, config,
                region, country, city, priority, max_connections, is_active
            } = nodeData;
            
            db.run(`
                UPDATE proxy_nodes 
                SET name = ?, protocol = ?, address = ?, port = ?, config = ?, 
                    region = ?, country = ?, city = ?, priority = ?, max_connections = ?, 
                    is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                name, protocol, address, port, 
                JSON.stringify(config || {}), 
                region, country, city, priority, max_connections, is_active, id
            ], function(err) {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }
    
    // 删除节点
    static async delete(id) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.run('DELETE FROM proxy_nodes WHERE id = ?', [id], function(err) {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }
    
    // 批量导入节点
    static async batchImport(nodes, created_by) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                nodes.forEach((node, index) => {
                    const {
                        name, protocol, address, port, config,
                        region, country, city, priority, max_connections
                    } = node;
                    
                    db.run(`
                        INSERT INTO proxy_nodes 
                        (name, protocol, address, port, config, region, country, city, priority, max_connections, created_by) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        name, protocol, address, port, 
                        JSON.stringify(config || {}), 
                        region, country, city, priority || 0, max_connections || 1000, created_by
                    ], function(err) {
                        if (err) {
                            errorCount++;
                            errors.push({ index, error: err.message });
                        } else {
                            successCount++;
                        }
                        
                        // 检查是否完成
                        if (successCount + errorCount === nodes.length) {
                            if (errorCount === 0) {
                                db.run('COMMIT', (err) => {
                                    db.close();
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve({ successCount, errorCount, errors });
                                    }
                                });
                            } else {
                                db.run('ROLLBACK', (err) => {
                                    db.close();
                                    resolve({ successCount, errorCount, errors });
                                });
                            }
                        }
                    });
                });
            });
        });
    }
    
    // 获取节点统计
    static async getStats() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.all(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                    protocol,
                    region
                FROM proxy_nodes 
                GROUP BY protocol, region
                ORDER BY total DESC
            `, (err, rows) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }
                
                // 获取总体统计
                db.get(`
                    SELECT 
                        COUNT(*) as total_nodes,
                        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_nodes,
                        COUNT(DISTINCT protocol) as protocols,
                        COUNT(DISTINCT region) as regions
                    FROM proxy_nodes
                `, (err, summary) => {
                    db.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            summary,
                            details: rows
                        });
                    }
                });
            });
        });
    }
}

module.exports = ProxyNode;
