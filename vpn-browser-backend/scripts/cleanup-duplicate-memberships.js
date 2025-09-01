#!/usr/bin/env node

/**
 * 清理重复会员记录脚本
 * 
 * 问题：用户可能有多条活跃的会员记录，导致前端显示不一致
 * 解决：合并同一用户的多条记录为一条，保留最新更新的记录
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/vpn_browser.db');

function cleanupDuplicateMemberships() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        console.log('🔍 开始检查重复会员记录...');
        
        // 查找有多条活跃会员记录的用户
        db.all(`
            SELECT user_id, COUNT(*) as count
            FROM user_memberships 
            WHERE status IN ('active', 'renewal') 
            AND datetime(end_date) > datetime('now')
            GROUP BY user_id
            HAVING COUNT(*) > 1
        `, [], (err, duplicateUsers) => {
            if (err) {
                db.close();
                return reject(err);
            }
            
            if (duplicateUsers.length === 0) {
                console.log('✅ 没有发现重复的会员记录');
                db.close();
                return resolve();
            }
            
            console.log(`⚠️  发现 ${duplicateUsers.length} 个用户有重复会员记录:`);
            duplicateUsers.forEach(user => {
                console.log(`   用户ID ${user.user_id}: ${user.count} 条记录`);
            });
            
            let processedCount = 0;
            
            // 处理每个有重复记录的用户
            duplicateUsers.forEach(user => {
                // 获取该用户的所有活跃会员记录
                db.all(`
                    SELECT * FROM user_memberships 
                    WHERE user_id = ? AND status IN ('active', 'renewal') 
                    AND datetime(end_date) > datetime('now')
                    ORDER BY updated_at DESC, id DESC
                `, [user.user_id], (err, records) => {
                    if (err) {
                        console.error(`❌ 处理用户 ${user.user_id} 失败:`, err);
                        processedCount++;
                        if (processedCount === duplicateUsers.length) {
                            db.close();
                            resolve();
                        }
                        return;
                    }
                    
                    if (records.length <= 1) {
                        processedCount++;
                        if (processedCount === duplicateUsers.length) {
                            db.close();
                            resolve();
                        }
                        return;
                    }
                    
                    // 保留最新的记录，将其他记录设为过期
                    const keepRecord = records[0];
                    const expireRecords = records.slice(1);
                    
                    console.log(`🔧 处理用户 ${user.user_id}:`);
                    console.log(`   保留记录 ID ${keepRecord.id} (${keepRecord.days_purchased}天)`);
                    console.log(`   过期记录 ${expireRecords.length} 条`);
                    
                    // 计算总天数
                    const totalDays = records.reduce((sum, record) => sum + record.days_purchased, 0);
                    
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');
                        
                        // 将其他记录设为过期
                        expireRecords.forEach(record => {
                            db.run(`
                                UPDATE user_memberships 
                                SET status = 'expired', updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [record.id]);
                        });
                        
                        // 更新保留的记录，设置总天数
                        db.run(`
                            UPDATE user_memberships 
                            SET days_purchased = ?, 
                                end_date = datetime('now', '+' || ? || ' days'),
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [totalDays, totalDays, keepRecord.id]);
                        
                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error(`❌ 提交事务失败:`, err);
                                db.run('ROLLBACK');
                            } else {
                                console.log(`✅ 用户 ${user.user_id} 处理完成，合并为 ${totalDays} 天`);
                            }
                            
                            processedCount++;
                            if (processedCount === duplicateUsers.length) {
                                db.close();
                                resolve();
                            }
                        });
                    });
                });
            });
        });
    });
}

// 如果直接运行此脚本
if (require.main === module) {
    cleanupDuplicateMemberships()
        .then(() => {
            console.log('🎉 清理完成！');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 清理失败:', error);
            process.exit(1);
        });
}

module.exports = { cleanupDuplicateMemberships };
