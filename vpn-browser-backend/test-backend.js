const express = require('express');
const { initDatabase } = require('./database/init');

async function testBackend() {
    console.log('🧪 开始测试VPN浏览器后端系统...\n');
    
    try {
        // 测试数据库初始化
        console.log('1️⃣ 测试数据库初始化...');
        await initDatabase();
        console.log('✅ 数据库初始化成功\n');
        
        // 测试Express应用创建
        console.log('2️⃣ 测试Express应用...');
        const app = express();
        app.get('/test', (req, res) => {
            res.json({ message: 'Backend is working!' });
        });
        
        const server = app.listen(3001, () => {
            console.log('✅ Express应用启动成功 (端口: 3001)\n');
            
            // 测试API响应
            console.log('3️⃣ 测试API响应...');
            const http = require('http');
            
            const options = {
                hostname: 'localhost',
                port: 3001,
                path: '/test',
                method: 'GET'
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        console.log('✅ API响应正常:', response.message);
                        console.log('\n🎉 后端系统测试完成！所有功能正常运行。');
                        
                        server.close();
                        process.exit(0);
                    } catch (error) {
                        console.error('❌ API响应解析失败:', error);
                        server.close();
                        process.exit(1);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('❌ API请求失败:', error);
                server.close();
                process.exit(1);
            });
            
            req.end();
        });
        
        server.on('error', (error) => {
            console.error('❌ 服务器启动失败:', error);
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ 后端系统测试失败:', error);
        process.exit(1);
    }
}

testBackend();
