const { getDatabase } = require('../database/init');

class TechSupport {
    // 获取技术支持信息
    static async getInfo() {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.get(`
                SELECT * FROM tech_support 
                WHERE is_active = 1 
                ORDER BY updated_at DESC 
                LIMIT 1
            `, (err, row) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve(row || {
                        qq: '',
                        wechat: '',
                        telegram: '',
                        email: '',
                        website: '',
                        support_hours: '工作日 9:00-18:00 (北京时间)'
                    });
                }
            });
        });
    }
    
    // 更新技术支持信息
    static async updateInfo(data) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            const { qq, wechat, telegram, email, website, support_hours } = data;
            
            // 先禁用旧记录
            db.run('UPDATE tech_support SET is_active = 0', (err) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }
                
                // 插入新记录
                db.run(`
                    INSERT INTO tech_support (qq, wechat, telegram, email, website, support_hours) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [qq, wechat, telegram, email, website, support_hours], function(err) {
                    db.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            ...data,
                            updated_at: new Date().toISOString()
                        });
                    }
                });
            });
        });
    }
    
    // 获取历史记录
    static async getHistory(limit = 10) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            db.all(`
                SELECT * FROM tech_support 
                ORDER BY created_at DESC 
                LIMIT ?
            `, [limit], (err, rows) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = TechSupport;
