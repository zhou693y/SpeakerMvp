/**
 * 存储适配器
 * 提供统一的存储接口，支持内存存储、localStorage和LeanCloud
 */

class StorageAdapter {
    constructor() {
        this.storageMode = 'cloud'; // 'memory', 'local', 'cloud' - 默认使用云端存储
        this.memoryStorage = window.memoryStorage;
        this.cloudEnabled = false;

        // 初始化UI控制 - 已禁用，系统固定使用云端存储
        // this.initStorageControls();
    }

    // 初始化存储控制UI
    initStorageControls() {
        // 创建存储控制面板
        const controlPanel = document.createElement('div');
        controlPanel.id = 'storage-control-panel';
        controlPanel.innerHTML = `
            <div class="storage-controls">
                <div class="storage-header" id="storage-header">
                    <h4>📁 数据存储管理</h4>
                    <button class="toggle-btn" id="storage-toggle-btn" title="展开/折叠">▼</button>
                </div>
                <div class="storage-content" id="storage-content">
                    <div class="storage-mode-selector">
                        <label>存储模式：</label>
                        <select id="storage-mode-select">
                            <option value="memory">内存存储</option>
                            <option value="local">本地存储</option>
                            <option value="cloud" selected>云端存储</option>
                        </select>
                    </div>
                    
                    <div class="storage-actions">
                        <button id="clear-data-btn" class="btn-clear">🗑️ 清空数据</button>
                    </div>
                    
                    <div class="storage-mode-info">
                        <h5>存储模式说明：</h5>
                        <ul style="font-size: 10px; margin: 5px 0; padding-left: 15px;">
                            <li><strong>内存存储（推荐）</strong>：数据仅保存在浏览器内存中，刷新页面后数据会丢失，适合临时测试</li>
                            <li><strong>本地存储</strong>：数据保存在浏览器本地存储中，刷新页面后数据仍然保留，适合单机使用</li>
                            <li><strong>云端存储</strong>：数据保存在云端服务器，可以跨设备访问，适合多人协作</li>
                        </ul>
                    </div>
                    
                    <div class="storage-stats" id="storage-stats">
                        <small>数据统计：加载中...</small>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            #storage-control-panel {
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(255, 255, 255, 0.95);
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 1000;
                font-size: 12px;
                max-width: 300px;
                transition: all 0.3s ease;
            }
            
            #storage-control-panel.collapsed {
                max-width: 200px;
            }
            
            .storage-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                user-select: none;
                margin-bottom: 10px;
            }
            
            .storage-header:hover {
                opacity: 0.8;
            }
            
            .storage-controls h4 {
                margin: 0;
                color: #333;
                flex: 1;
            }
            
            .toggle-btn {
                background: none;
                border: none;
                font-size: 14px;
                cursor: pointer;
                padding: 5px;
                transition: transform 0.3s ease;
                color: #666;
            }
            
            .toggle-btn:hover {
                color: #333;
            }
            
            .toggle-btn.collapsed {
                transform: rotate(-90deg);
            }
            
            .storage-content {
                max-height: 1000px;
                overflow: hidden;
                transition: max-height 0.3s ease, opacity 0.3s ease;
                opacity: 1;
            }
            
            .storage-content.collapsed {
                max-height: 0;
                opacity: 0;
            }
            
            .storage-mode-selector {
                margin-bottom: 10px;
            }
            
            .storage-mode-selector label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }
            
            .storage-mode-selector select {
                width: 100%;
                padding: 5px;
                border: 1px solid #ccc;
                border-radius: 4px;
            }
            
            .storage-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-bottom: 10px;
            }
            
            .storage-actions button {
                padding: 5px 8px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                flex: 1;
                min-width: 70px;
            }
            
            .btn-export {
                background: #4CAF50;
                color: white;
            }
            
            .btn-import {
                background: #2196F3;
                color: white;
            }
            
            .btn-clear {
                background: #f44336;
                color: white;
            }
            
            .storage-actions button:hover {
                opacity: 0.8;
            }
            
            .storage-stats {
                padding: 5px;
                background: #f5f5f5;
                border-radius: 4px;
                font-size: 10px;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(controlPanel);

        // 绑定事件
        this.bindStorageEvents();

        // 更新统计信息
        this.updateStorageStats();
    }

    // 绑定存储控制事件
    bindStorageEvents() {
        // 折叠/展开功能
        const header = document.getElementById('storage-header');
        const toggleBtn = document.getElementById('storage-toggle-btn');
        const content = document.getElementById('storage-content');
        const panel = document.getElementById('storage-control-panel');

        // 从localStorage恢复折叠状态
        const isCollapsed = localStorage.getItem('storage-panel-collapsed') === 'true';
        if (isCollapsed) {
            content.classList.add('collapsed');
            toggleBtn.classList.add('collapsed');
            panel.classList.add('collapsed');
        }

        header.addEventListener('click', () => {
            const isCurrentlyCollapsed = content.classList.contains('collapsed');

            if (isCurrentlyCollapsed) {
                // 展开
                content.classList.remove('collapsed');
                toggleBtn.classList.remove('collapsed');
                panel.classList.remove('collapsed');
                localStorage.setItem('storage-panel-collapsed', 'false');
            } else {
                // 折叠
                content.classList.add('collapsed');
                toggleBtn.classList.add('collapsed');
                panel.classList.add('collapsed');
                localStorage.setItem('storage-panel-collapsed', 'true');
            }
        });

        // 存储模式切换
        document.getElementById('storage-mode-select').addEventListener('change', (e) => {
            this.setStorageMode(e.target.value);
        });

        // 清空数据
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
                this.clearAllData();
            }
        });
    }

    // 设置存储模式
    setStorageMode(mode) {
        this.storageMode = mode;
        console.log(`存储模式已切换为: ${mode}`);

        // 显示模式切换提示
        const modeNames = {
            memory: '内存存储',
            local: '本地存储',
            cloud: '云端存储'
        };

        this.showToast(`已切换到${modeNames[mode]}模式`, 'info');
        this.updateStorageStats();
    }

    // 保存班级数据
    saveClasses(classes, currentClass = null) {
        switch (this.storageMode) {
            case 'memory':
                this.memoryStorage.saveClasses(classes, currentClass);
                break;
            case 'local':
                localStorage.setItem('speechScoring_classes', JSON.stringify(classes));
                if (currentClass) {
                    localStorage.setItem('speechScoring_currentClass', JSON.stringify(currentClass));
                } else {
                    localStorage.removeItem('speechScoring_currentClass');
                }
                break;
            case 'cloud':
                // 保持原有的云端存储逻辑
                this.saveToCloud('classes', { classes, currentClass });
                break;
        }
        this.updateStorageStats();
    }

    // 加载班级数据
    loadClasses() {
        switch (this.storageMode) {
            case 'memory':
                return this.memoryStorage.loadClasses();
            case 'local':
                const classesData = localStorage.getItem('speechScoring_classes');
                const currentClassData = localStorage.getItem('speechScoring_currentClass');
                return {
                    classes: classesData ? JSON.parse(classesData) : [],
                    currentClass: currentClassData ? JSON.parse(currentClassData) : null
                };
            case 'cloud':
                // 返回空数据，由原有逻辑处理云端加载
                return { classes: [], currentClass: null };
        }
    }

    // 保存会话数据
    saveSession(sessionData, classId = 'default') {
        switch (this.storageMode) {
            case 'memory':
                this.memoryStorage.saveSession(sessionData, classId);
                break;
            case 'local':
                const sessionsKey = `savedSessions_class_${classId}`;
                const savedSessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]');

                const existingIndex = savedSessions.findIndex(s => s.sessionId === sessionData.sessionId);
                if (existingIndex >= 0) {
                    savedSessions[existingIndex] = sessionData;
                } else {
                    savedSessions.push(sessionData);
                }

                localStorage.setItem(sessionsKey, JSON.stringify(savedSessions));
                break;
            case 'cloud':
                // 保持原有的云端存储逻辑
                this.saveToCloud('session', sessionData);
                break;
        }
        this.updateStorageStats();
    }

    // 加载会话数据
    loadSessions(classId = 'default') {
        switch (this.storageMode) {
            case 'memory':
                return this.memoryStorage.loadSessions(classId);
            case 'local':
                const sessionsKey = `savedSessions_class_${classId}`;
                return JSON.parse(localStorage.getItem(sessionsKey) || '[]');
            case 'cloud':
                // 返回空数组，由原有逻辑处理云端加载
                return [];
        }
    }

    // 保存系统数据
    saveSystemData(data, classId = null) {
        switch (this.storageMode) {
            case 'memory':
                this.memoryStorage.saveSystemData(data);
                break;
            case 'local':
                const key = classId ? `speechScoringSystem_class_${classId}` : 'speechScoringSystem';
                localStorage.setItem(key, JSON.stringify(data));
                break;
            case 'cloud':
                this.saveToCloud('system', data);
                break;
        }
        this.updateStorageStats();
    }

    // 加载系统数据
    loadSystemData(classId = null) {
        switch (this.storageMode) {
            case 'memory':
                return this.memoryStorage.loadSystemData();
            case 'local':
                const key = classId ? `speechScoringSystem_class_${classId}` : 'speechScoringSystem';
                const saved = localStorage.getItem(key);
                return saved ? JSON.parse(saved) : null;
            case 'cloud':
                return null; // 由原有逻辑处理
        }
    }

    // 导出数据
    exportData(format) {
        if (format === 'xlsx') {
            this.exportAsExcel();
        }
    }

    // 导出为Excel格式
    exportAsExcel() {
        // 动态加载SheetJS库
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => {
                this.generateExcelExport();
            };
            script.onerror = () => {
                this.showToast('Excel处理库加载失败，请检查网络连接', 'error');
            };
            document.head.appendChild(script);
        } else {
            this.generateExcelExport();
        }
    }

    // 生成Excel导出文件
    generateExcelExport() {
        const data = this.memoryStorage.loadSystemData();
        if (!data) {
            this.showToast('没有可导出的数据', 'warning');
            return;
        }

        const wb = XLSX.utils.book_new();

        // 创建系统数据工作表
        const systemData = [
            ['系统数据导出'],
            ['导出时间', new Date().toLocaleString()],
            ['会话ID', data.sessionId || ''],
            [],
            ['用户列表'],
            ['姓名', '角色']
        ];

        if (data.users && data.users.length > 0) {
            data.users.forEach(user => {
                const roleText = user.role === 'speaker' ? '演讲者' :
                    user.role === 'judge' ? '评委' : '普通用户';
                systemData.push([user.name, roleText]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(systemData);
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, '系统数据');

        // 下载文件
        const fileName = `演讲评分系统数据_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        this.showToast('数据已导出为Excel文件', 'success');
    }

    // 导入数据
    async importData(file) {
        try {
            await this.memoryStorage.importFromJSON(file);
            this.showToast('数据导入成功！', 'success');
            this.updateStorageStats();

            // 刷新页面以应用导入的数据
            if (confirm('数据导入成功！是否刷新页面以应用新数据？')) {
                location.reload();
            }
        } catch (error) {
            this.showToast('数据导入失败: ' + error.message, 'error');
        }
    }

    // 清空所有数据
    clearAllData() {
        switch (this.storageMode) {
            case 'memory':
                this.memoryStorage.clearAllData();
                break;
            case 'local':
                // 清空localStorage中的相关数据
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('speechScoring') || key.startsWith('savedSessions')) {
                        localStorage.removeItem(key);
                    }
                });
                break;
            case 'cloud':
                // 这里可以添加云端数据清空逻辑
                break;
        }

        this.showToast('数据已清空', 'info');
        this.updateStorageStats();

        // 刷新页面
        setTimeout(() => location.reload(), 1000);
    }

    // 更新存储统计信息
    updateStorageStats() {
        const statsElement = document.getElementById('storage-stats');
        if (!statsElement) return;

        if (this.storageMode === 'memory') {
            const stats = this.memoryStorage.getDataStats();
            statsElement.innerHTML = `
                <small>
                    模式: ${this.storageMode === 'memory' ? '内存' : this.storageMode === 'local' ? '本地' : '云端'} | 
                    班级: ${stats.classCount} | 
                    会话: ${stats.sessionCount} | 
                    学生: ${stats.totalStudents}
                </small>
            `;
        } else {
            statsElement.innerHTML = `<small>模式: ${this.storageMode === 'memory' ? '内存' : this.storageMode === 'local' ? '本地' : '云端'}</small>`;
        }
    }

    // 云端保存（保持兼容性）
    saveToCloud(type, data) {
        // 这里保持原有的LeanCloud保存逻辑
        console.log(`云端保存 ${type}:`, data);
    }

    // 显示提示
    showToast(message, type = 'info') {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = `storage-toast toast-${type}`;
        toast.textContent = message;

        // 添加样式
        toast.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 12px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(toast);

        // 3秒后自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}

// 创建全局存储适配器实例
window.storageAdapter = new StorageAdapter();

console.log('存储适配器已加载');