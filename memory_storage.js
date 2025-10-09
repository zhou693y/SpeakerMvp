/**
 * 内存存储管理器
 * 提供纯内存数据存储，支持导出/导入功能
 * 不依赖localStorage和LeanCloud
 */

class MemoryStorageManager {
    constructor() {
        // 内存中的数据存储
        this.memoryData = {
            classes: [],
            currentClass: null,
            sessions: {},  // 按班级ID存储会话数据
            systemData: null,
            settings: {
                autoExport: true,
                exportFormat: 'json'
            }
        };
        
        // 数据变更监听器
        this.changeListeners = [];
        
        // 初始化
        this.init();
    }
    
    init() {
        console.log('内存存储管理器已初始化');
        
        // 添加页面卸载时的提醒
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedData()) {
                e.preventDefault();
                e.returnValue = '您有未保存的数据，确定要离开吗？建议先导出数据。';
                return e.returnValue;
            }
        });
    }
    
    // 检查是否有未保存的数据
    hasUnsavedData() {
        return Object.keys(this.memoryData.sessions).length > 0 || 
               this.memoryData.systemData !== null;
    }
    
    // 保存班级数据
    saveClasses(classes, currentClass = null) {
        this.memoryData.classes = JSON.parse(JSON.stringify(classes));
        this.memoryData.currentClass = currentClass ? JSON.parse(JSON.stringify(currentClass)) : null;
        this.notifyChange('classes');
        console.log('班级数据已保存到内存');
    }
    
    // 加载班级数据
    loadClasses() {
        return {
            classes: JSON.parse(JSON.stringify(this.memoryData.classes)),
            currentClass: this.memoryData.currentClass ? JSON.parse(JSON.stringify(this.memoryData.currentClass)) : null
        };
    }
    
    // 保存系统数据
    saveSystemData(data) {
        this.memoryData.systemData = JSON.parse(JSON.stringify(data));
        this.notifyChange('systemData');
        console.log('系统数据已保存到内存');
    }
    
    // 加载系统数据
    loadSystemData() {
        return this.memoryData.systemData ? JSON.parse(JSON.stringify(this.memoryData.systemData)) : null;
    }
    
    // 保存会话数据
    saveSession(sessionData, classId = 'default') {
        if (!this.memoryData.sessions[classId]) {
            this.memoryData.sessions[classId] = [];
        }
        
        const sessionCopy = JSON.parse(JSON.stringify(sessionData));
        sessionCopy.savedAt = new Date().toISOString();
        
        // 检查是否已存在相同sessionId的数据
        const existingIndex = this.memoryData.sessions[classId].findIndex(
            session => session.sessionId === sessionData.sessionId
        );
        
        if (existingIndex >= 0) {
            this.memoryData.sessions[classId][existingIndex] = sessionCopy;
            console.log(`会话数据已更新到内存 (班级: ${classId})`);
        } else {
            this.memoryData.sessions[classId].push(sessionCopy);
            console.log(`会话数据已保存到内存 (班级: ${classId})`);
        }
        
        this.notifyChange('sessions');
    }
    
    // 加载会话数据
    loadSessions(classId = 'default') {
        return this.memoryData.sessions[classId] ? 
               JSON.parse(JSON.stringify(this.memoryData.sessions[classId])) : [];
    }
    
    // 获取所有数据
    getAllData() {
        return JSON.parse(JSON.stringify(this.memoryData));
    }
    
    // 导出数据为JSON
    exportAsJSON() {
        const exportData = {
            exportTime: new Date().toISOString(),
            version: '1.0',
            data: this.getAllData()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `演讲评分系统数据_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('数据已导出为JSON文件');
        return true;
    }
    
    // 导出数据为CSV
    exportAsCSV() {
        const csvData = [];
        
        // 导出会话数据
        Object.keys(this.memoryData.sessions).forEach(classId => {
            this.memoryData.sessions[classId].forEach(session => {
                if (session.results && session.results.length > 0) {
                    session.results.forEach(result => {
                        csvData.push({
                            班级ID: classId,
                            会话ID: session.sessionId,
                            时间: session.timestamp,
                            学生姓名: result.name,
                            总分: result.totalScore,
                            排名: result.rank,
                            评分方法: session.scoringMethod || '未知'
                        });
                    });
                }
            });
        });
        
        if (csvData.length === 0) {
            alert('没有可导出的评分数据');
            return false;
        }
        
        // 转换为CSV格式
        const headers = Object.keys(csvData[0]);
        const csvContent = [
            headers.join(','),
            ...csvData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');
        
        const blob = new Blob(['\ufeff' + csvContent], {
            type: 'text/csv;charset=utf-8'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `演讲评分结果_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('数据已导出为CSV文件');
        return true;
    }
    
    // 从JSON文件导入数据
    importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    if (importData.data) {
                        // 合并数据而不是覆盖
                        this.mergeData(importData.data);
                        console.log('数据导入成功');
                        resolve(true);
                    } else {
                        reject(new Error('无效的数据格式'));
                    }
                } catch (error) {
                    reject(new Error('文件解析失败: ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }
    
    // 合并导入的数据
    mergeData(importedData) {
        // 合并班级数据
        if (importedData.classes && importedData.classes.length > 0) {
            this.memoryData.classes = importedData.classes;
            this.memoryData.currentClass = importedData.currentClass;
        }
        
        // 合并会话数据
        if (importedData.sessions) {
            Object.keys(importedData.sessions).forEach(classId => {
                if (!this.memoryData.sessions[classId]) {
                    this.memoryData.sessions[classId] = [];
                }
                
                importedData.sessions[classId].forEach(session => {
                    const existingIndex = this.memoryData.sessions[classId].findIndex(
                        s => s.sessionId === session.sessionId
                    );
                    
                    if (existingIndex >= 0) {
                        this.memoryData.sessions[classId][existingIndex] = session;
                    } else {
                        this.memoryData.sessions[classId].push(session);
                    }
                });
            });
        }
        
        // 合并系统数据
        if (importedData.systemData) {
            this.memoryData.systemData = importedData.systemData;
        }
        
        this.notifyChange('import');
    }
    
    // 清空所有数据
    clearAllData() {
        this.memoryData = {
            classes: [],
            currentClass: null,
            sessions: {},
            systemData: null,
            settings: this.memoryData.settings
        };
        this.notifyChange('clear');
        console.log('所有数据已清空');
    }
    
    // 添加数据变更监听器
    addChangeListener(callback) {
        this.changeListeners.push(callback);
    }
    
    // 移除数据变更监听器
    removeChangeListener(callback) {
        const index = this.changeListeners.indexOf(callback);
        if (index > -1) {
            this.changeListeners.splice(index, 1);
        }
    }
    
    // 通知数据变更
    notifyChange(type) {
        this.changeListeners.forEach(callback => {
            try {
                callback(type, this.memoryData);
            } catch (error) {
                console.error('数据变更监听器执行失败:', error);
            }
        });
    }
    
    // 获取数据统计信息
    getDataStats() {
        const stats = {
            classCount: this.memoryData.classes.length,
            sessionCount: 0,
            totalStudents: 0
        };
        
        Object.keys(this.memoryData.sessions).forEach(classId => {
            stats.sessionCount += this.memoryData.sessions[classId].length;
            this.memoryData.sessions[classId].forEach(session => {
                if (session.results) {
                    stats.totalStudents += session.results.length;
                }
            });
        });
        
        return stats;
    }
}

// 创建全局实例
window.memoryStorage = new MemoryStorageManager();

console.log('内存存储管理器已加载');