/**
 * 云端轮询同步模块
 * 使用定时轮询替代 LeanCloud 实时订阅功能
 * 避免商业版限制
 */

class CloudPollingSync {
    constructor() {
        this.pollingInterval = null;
        this.pollingFrequency = 3000; // 3秒轮询一次
        this.lastSyncTime = 0;
        this.isPolling = false;
        this.sessionId = null;
        this.classId = null;
        this.onDataUpdate = null; // 数据更新回调

        // 初始化 LeanCloud
        this.initLeanCloud();
    }

    // 初始化 LeanCloud
    initLeanCloud() {
        try {
            if (window.LC_CONFIG && window.AV) {
                AV.init({
                    appId: window.LC_CONFIG.appId,
                    appKey: window.LC_CONFIG.appKey,
                    serverURL: window.LC_CONFIG.serverURL
                });
                console.log('LeanCloud 初始化成功（轮询模式）');
            } else {
                console.warn('LeanCloud 配置未找到');
            }
        } catch (error) {
            console.error('LeanCloud 初始化失败:', error);
        }
    }

    // 设置会话信息
    setSession(sessionId, classId) {
        this.sessionId = sessionId;
        this.classId = classId;
        console.log(`会话已设置: sessionId=${sessionId}, classId=${classId}`);
    }

    // 设置数据更新回调
    setUpdateCallback(callback) {
        this.onDataUpdate = callback;
    }

    // 启动轮询
    startPolling() {
        if (this.isPolling) {
            console.log('轮询已在运行中');
            return;
        }

        if (!this.sessionId || !this.classId) {
            console.warn('会话ID或班级ID未设置，无法启动轮询');
            return;
        }

        this.isPolling = true;
        console.log(`开始轮询同步，频率: ${this.pollingFrequency}ms`);

        // 立即执行一次同步
        this.syncFromCloud();

        // 设置定时轮询
        this.pollingInterval = setInterval(() => {
            this.syncFromCloud();
        }, this.pollingFrequency);
    }

    // 停止轮询
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            this.isPolling = false;
            console.log('轮询已停止');
        }
    }

    // 从云端同步数据
    async syncFromCloud() {
        try {
            if (!window.AV) {
                console.warn('LeanCloud SDK 未加载');
                return;
            }

            if (!this.sessionId || !this.classId) {
                return;
            }

            // 使用 LeanCloud 查询数据（不使用实时订阅）
            const query = new AV.Query('SpeechSession');
            query.equalTo('sessionId', this.sessionId);
            query.equalTo('classId', this.classId);
            query.descending('updatedAt');
            query.limit(1);

            const result = await query.first();

            if (result) {
                const cloudData = {
                    users: result.get('users') || [],
                    speakers: result.get('speakers') || [],
                    judges: result.get('judges') || [],
                    scores: result.get('scores') || {},
                    scoringStarted: result.get('scoringStarted') || false,
                    scoringMethod: result.get('scoringMethod') || 'trimmed',
                    settings: result.get('settings') || {},
                    updatedAt: result.updatedAt.getTime()
                };

                // 只有当云端数据更新时间晚于本地时才更新
                if (cloudData.updatedAt > this.lastSyncTime) {
                    this.lastSyncTime = cloudData.updatedAt;

                    // 触发数据更新回调
                    if (this.onDataUpdate) {
                        this.onDataUpdate(cloudData);
                    }

                    console.log('✓ 数据已从云端同步');
                }
            } else {
                console.log('云端暂无数据');
            }
        } catch (error) {
            console.warn('云端同步失败:', error.message);
            // 同步失败不影响本地使用
        }
    }

    // 保存到云端
    async saveToCloud(data) {
        try {
            if (!window.AV) {
                console.warn('LeanCloud SDK 未加载');
                return false;
            }

            if (!this.sessionId || !this.classId) {
                console.log('会话ID或班级ID未设置，跳过云端保存');
                return false;
            }

            // 查找现有记录
            const query = new AV.Query('SpeechSession');
            query.equalTo('sessionId', this.sessionId);
            query.equalTo('classId', this.classId);

            let sessionObj = await query.first();

            if (!sessionObj) {
                // 创建新记录
                sessionObj = new AV.Object('SpeechSession');
                sessionObj.set('sessionId', this.sessionId);
                sessionObj.set('classId', this.classId);
            }

            // 更新数据
            sessionObj.set('users', data.users || []);
            sessionObj.set('speakers', data.speakers || []);
            sessionObj.set('judges', data.judges || []);
            sessionObj.set('scores', data.scores || {});
            sessionObj.set('scoringStarted', data.scoringStarted || false);
            sessionObj.set('scoringMethod', data.scoringMethod || 'trimmed');
            sessionObj.set('settings', data.settings || {});

            await sessionObj.save();
            this.lastSyncTime = Date.now();

            console.log('✓ 数据已保存到云端');
            return true;
        } catch (error) {
            console.error('云端保存失败:', error.message);
            return false;
        }
    }

    // 保存班级数据到云端
    async saveClassesToCloud(classes, currentClass) {
        try {
            if (!window.AV) {
                return false;
            }

            // 查找或创建班级配置记录
            const query = new AV.Query('ClassConfig');
            query.equalTo('configKey', 'classes');

            let configObj = await query.first();

            if (!configObj) {
                configObj = new AV.Object('ClassConfig');
                configObj.set('configKey', 'classes');
            }

            configObj.set('classes', classes);
            configObj.set('currentClass', currentClass);

            await configObj.save();
            console.log('✓ 班级数据已保存到云端');
            return true;
        } catch (error) {
            console.error('班级数据保存失败:', error.message);
            return false;
        }
    }

    // 从云端加载班级数据
    async loadClassesFromCloud() {
        try {
            if (!window.AV) {
                return null;
            }

            const query = new AV.Query('ClassConfig');
            query.equalTo('configKey', 'classes');

            const result = await query.first();

            if (result) {
                return {
                    classes: result.get('classes') || [],
                    currentClass: result.get('currentClass') || null
                };
            }

            return null;
        } catch (error) {
            console.error('加载班级数据失败:', error.message);
            return null;
        }
    }
}

// 创建全局实例
window.cloudPolling = new CloudPollingSync();

console.log('云端轮询同步模块已加载');
