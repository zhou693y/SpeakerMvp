// 演讲评分系统
class SpeechScoringSystem {
    constructor() {
        this.sessionId = this.getSessionIdFromUrl() || this.generateSessionId();
        // 确保 URL 持久包含 sid 以便他端加入同一会话
        this.ensureSidInUrl(this.sessionId);
        this.users = [];
        this.speakers = [];
        this.judges = [];
        this.scores = {};
        this.scoringMethod = 'trimmed';
        this.scoringStarted = false;
        this.settings = { maxUsers: 6, maxSpeakers: 2, maxJudges: 4 };
        this.currentUser = null;
        this.classes = [];
        this.currentClass = null;

        // 时间戳增量轮询相�?
        this.lastSyncTimestamp = Date.now(); // 记录最后一次同步的时间戳，初始化为当前时间
        this.pollingInterval = null; // 轮询定时�?
        this.pollingFrequency = 5000; // 轮询频率（毫秒），默�?�?
        this.isPolling = false; // 是否正在轮询

        // 初始化班级数�?
        this.loadClassesFromLocalStorage();

        // 监听URL变化，自动加载云端数�?
        this.setupUrlChangeListener();
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2);
    }

    // 网络状态提示方�?
    showNetworkError(message) {
        console.error('网络错误:', message);
        this.showToast(message, 'error');
    }

    showNetworkWarning(message) {
        console.warn('网络警告:', message);
        this.showToast(message, 'warning');
    }

    showNetworkSuccess(message) {

        this.showToast(message, 'success');
    }

    // 通用提示方法
    showToast(message, type = 'info') {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // 添加样式
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
        `;

        // 根据类型设置颜色
        switch (type) {
            case 'error':
                toast.style.backgroundColor = '#f56565';
                break;
            case 'warning':
                toast.style.backgroundColor = '#ed8936';
                break;
            case 'success':
                toast.style.backgroundColor = '#48bb78';
                break;
            default:
                toast.style.backgroundColor = '#4299e1';
        }

        // 添加到页�?
        document.body.appendChild(toast);

        // 3秒后自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 3000);
    }

    // 解析 URL 中的 sid/session/sessionId 参数，用于跨设备共享会话
    getSessionIdFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const sid = params.get('sid') || params.get('session') || params.get('sessionId');
            return sid || null;
        } catch (_) {
            return null;
        }
    }

    // 将当前会话ID写入 URL，便于他人通过链接加入
    ensureSidInUrl(sid) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('sid', sid);
            window.history.replaceState(null, '', url.toString());
            const sessionSpan = document.getElementById('currentSessionId');
            if (sessionSpan) sessionSpan.textContent = sid;
        } catch (_) { }
    }

    // 监听URL变化，自动加载云端数�?
    setupUrlChangeListener() {
        // 监听popstate事件（浏览器前进/后退�?
        window.addEventListener('popstate', () => {
            this.handleUrlChange();
        });

        // 监听hashchange事件
        window.addEventListener('hashchange', () => {
            this.handleUrlChange();
        });

        // 定期检查URL是否变化（处理手动修改URL的情况）
        let lastUrl = window.location.href;
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                this.handleUrlChange();
            }
        }, 1000);
    }

    // 处理URL变化
    async handleUrlChange() {
        const newSessionId = this.getSessionIdFromUrl();

        // 如果URL中的sessionId与当前sessionId不同，说明用户输入了新的ID
        if (newSessionId && newSessionId !== this.sessionId) {


            // 停止当前轮询
            this.stopIncrementalPolling();

            // 更新sessionId
            this.sessionId = newSessionId;

            // 重置数据
            this.users = [];
            this.speakers = [];
            this.judges = [];
            this.scores = {};
            this.scoringStarted = false;
            this.currentUser = null;

            // 重置时间�?
            this.lastSyncTimestamp = 0;

            // 显示加载提示
            this.showToast('正在加载会话数据...', 'info');

            // 尝试从云端加载数�?
            const loaded = await this.loadFromCloud();

            if (loaded) {
                this.showToast('会话数据加载成功�?, 'success');

                // 更新界面
                this.updateAdminInterface();
                this.updateJudgeInterface();

                // 启动轮询
                this.startIncrementalPolling();
            } else {
                this.showToast('这是一个新会话，暂无数�?, 'info');

                // 即使没有数据，也启动轮询以便接收后续更新
                this.startIncrementalPolling();
            }

            // 更新URL显示
            this.ensureSidInUrl(this.sessionId);
        }
    }

    // ==================== 时间戳增量轮询功�?====================

    // 初始化LeanCloud（只初始化一次）
    initLeanCloud() {
        try {
            // 检查是否已经初始化
            if (window.LC_INITIALIZED) {
                return true;
            }

            if (typeof AV !== 'undefined' && window.LC_CONFIG) {
                AV.init({
                    appId: window.LC_CONFIG.appId,
                    appKey: window.LC_CONFIG.appKey,
                    serverURL: window.LC_CONFIG.serverURL
                });
                window.LC_INITIALIZED = true; // 标记已初始化

                return true;
            } else {
                console.warn('LeanCloud SDK未加载或配置缺失');
                return false;
            }
        } catch (error) {
            console.error('LeanCloud初始化失�?', error);
            return false;
        }
    }

    // 启动增量轮询
    startIncrementalPolling(forceRestart = false) {




        if (this.isPolling && !forceRestart) {

            return;
        }

        // 如果是强制重启，先停止现有轮�?
        if (forceRestart && this.isPolling) {

            this.stopIncrementalPolling();
        }


        const lcInitialized = this.initLeanCloud();


        if (!lcInitialized) {
            console.error('[启动轮询] �?LeanCloud未初始化，无法启动轮�?);
            console.error('[启动轮询] 请检查LeanCloud配置和SDK加载');
            return;
        }

        this.isPolling = true;



        // 立即执行一次同�?

        this.fetchIncrementalUpdates();

        // 设置定时轮询

        this.pollingInterval = setInterval(() => {
            this.fetchIncrementalUpdates();
        }, this.pollingFrequency);


    }

    // 停止轮询
    stopIncrementalPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;

    }

    // 获取增量更新数据
    async fetchIncrementalUpdates() {
        try {
            if (!this.sessionId) {
                console.warn('会话ID未设置，跳过同步');
                return;
            }

            console.log(`[增量轮询] 查询会话 ${this.sessionId} �?${new Date(this.lastSyncTimestamp).toLocaleString()} 之后的更新`);

            // 查询该会话在lastSyncTimestamp之后的所有更�?
            const SessionData = AV.Object.extend('SessionData');
            const query = new AV.Query(SessionData);
            query.equalTo('sessionId', this.sessionId);
            query.greaterThan('updatedAt', new Date(this.lastSyncTimestamp));
            query.ascending('updatedAt');
            query.limit(100); // 限制每次获取的数�?

            const results = await query.find();

            if (results.length > 0) {


                // 处理每条更新
                for (const result of results) {
                    const dataType = result.get('dataType');

                    await this.processIncrementalUpdate(result);

                    // 更新最后同步时间戳
                    const updateTime = result.updatedAt.getTime();
                    if (updateTime > this.lastSyncTimestamp) {
                        this.lastSyncTimestamp = updateTime;
                    }
                }

                // 保存最后同步时间戳到本�?
                localStorage.setItem(`lastSyncTimestamp_${this.sessionId}`, this.lastSyncTimestamp.toString());
                console.log(`[增量轮询] 更新时间�? ${new Date(this.lastSyncTimestamp).toLocaleString()}`);

                // 检测当前打开的界面并更新
                const adminSection = document.getElementById('adminSection');
                const judgeSection = document.getElementById('judgeSection');
                const resultsSection = document.getElementById('resultsSection');

                // 如果当前在管理员界面，更新管理员界面
                if (adminSection && adminSection.style.display !== 'none') {

                    this.updateAdminInterface();
                }

                // 如果当前在评委界面，更新评委界面
                if (judgeSection && judgeSection.style.display !== 'none') {

                    this.updateJudgeInterface();
                }

                // 如果当前在结果页面，更新结果显示
                if (resultsSection && resultsSection.style.display !== 'none') {

                    const results = this.calculateFinalScores();
                    this.displayResults(results);
                }

                this.showNetworkSuccess(`同步成功：更新了 ${results.length} 条数据`);
            } else {
                // 只在第一次查询时显示日志，避免刷�?
                if (this.lastSyncTimestamp === 0 || Date.now() - this.lastSyncTimestamp > 60000) {

                }
            }

        } catch (error) {
            console.error('[增量轮询] 获取增量更新失败:', error);
            this.showNetworkError('数据同步失败: ' + error.message);
        }
    }

    // 处理单条增量更新
    async processIncrementalUpdate(cloudData) {
        try {
            const dataType = cloudData.get('dataType');
            const data = cloudData.get('data');



            switch (dataType) {
                case 'users':
                    // 合并用户数据 - 从包装对象中提取
                    if (data && data.list && Array.isArray(data.list)) {
                        this.mergeUsers(data.list);
                    } else if (data && Array.isArray(data)) {
                        // 兼容旧格�?
                        this.mergeUsers(data);
                    }
                    break;

                case 'scores':
                    // 合并评分数据
                    if (data) {
                        this.mergeScores(data);
                    }
                    break;

                case 'settings':
                    // 更新设置
                    if (data) {
                        this.settings = { ...this.settings, ...data };
                    }
                    break;

                case 'scoringStatus':
                    // 更新评分状�?
                    if (data && typeof data.scoringStarted !== 'undefined') {
                        this.scoringStarted = data.scoringStarted;
                        this.scoringMethod = data.scoringMethod || this.scoringMethod;
                    }
                    break;

                default:
                    console.warn('未知的数据类�?', dataType);
            }

        } catch (error) {
            console.error('处理增量更新失败:', error);
        }
    }

    // 合并用户数据
    mergeUsers(newUsers) {
        // 如果是固定班级，不合并数据，直接替换
        if (this.currentClass && this.currentClass.isFixed) {

            return;
        }

        newUsers.forEach(newUser => {
            const existingIndex = this.users.findIndex(u => u.id === newUser.id);
            if (existingIndex >= 0) {
                // 更新现有用户
                this.users[existingIndex] = { ...this.users[existingIndex], ...newUser };
            } else {
                // 添加新用�?
                this.users.push(newUser);
            }
        });

        // 更新角色列表
        this.updateRoleLists();

    }

    // 合并评分数据
    mergeScores(newScores) {
        Object.keys(newScores).forEach(speakerId => {
            if (!this.scores[speakerId]) {
                this.scores[speakerId] = {};
            }

            Object.keys(newScores[speakerId]).forEach(judgeId => {
                this.scores[speakerId][judgeId] = newScores[speakerId][judgeId];
            });
        });


    }

    // 保存数据到云端（带时间戳�?
    async saveToCloud(dataType, data) {
        try {
            if (!this.initLeanCloud()) {
                console.warn('LeanCloud未初始化，无法保存到云端');
                return false;
            }

            if (!this.sessionId) {
                console.warn('会话ID未设置，无法保存到云�?);
                return false;
            }

            if (!window.networkStatus.isOnline) {

                return false;
            }

            // 确保数据可以被JSON序列�?
            let cleanData;
            try {
                cleanData = JSON.parse(JSON.stringify(data));
            } catch (serializeError) {
                console.error('数据序列化失�?', serializeError);
                return false;
            }

            const SessionData = AV.Object.extend('SessionData');
            const sessionData = new SessionData();

            sessionData.set('sessionId', this.sessionId);
            sessionData.set('dataType', dataType);
            sessionData.set('data', cleanData);
            sessionData.set('timestamp', Date.now().toString()); // 转换为字符串类型

            await sessionData.save();



            // 保存成功后，立即更新当前界面（如果是管理员界面）
            const adminSection = document.getElementById('adminSection');
            if (adminSection && adminSection.style.display !== 'none') {

                // 使用 setTimeout 确保在当前调用栈完成后执�?
                setTimeout(() => {
                    this.updateAdminInterface();
                }, 100);
            }

            return true;

        } catch (error) {
            console.error('保存到云端失�?', error);
            // 不显示错误提示，避免频繁打扰用户
            return false;
        }
    }

    // 加载初始数据（仅加载最新状态）
    async loadFromCloud() {
        try {
            if (!this.initLeanCloud()) {
                console.warn('LeanCloud未初始化，无法从云端加载');
                return false;
            }

            if (!this.sessionId) {
                console.warn('会话ID未设置，无法从云端加�?);
                return false;
            }



            // 获取该会话的最新数�?
            const SessionData = AV.Object.extend('SessionData');
            const query = new AV.Query(SessionData);
            query.equalTo('sessionId', this.sessionId);
            query.descending('updatedAt');
            query.limit(50); // 获取最近的50条记�?

            const results = await query.find();

            if (results.length > 0) {


                // 按数据类型分组处�?
                const dataByType = {};
                results.forEach(result => {
                    const dataType = result.get('dataType');
                    if (!dataByType[dataType]) {
                        dataByType[dataType] = [];
                    }
                    dataByType[dataType].push({
                        data: result.get('data'),
                        updatedAt: result.updatedAt
                    });
                });

                // 处理每种类型的数据（取最新的�?
                Object.keys(dataByType).forEach(dataType => {
                    const items = dataByType[dataType];
                    // 按时间排序，取最新的
                    items.sort((a, b) => b.updatedAt - a.updatedAt);
                    const latestData = items[0].data;

                    switch (dataType) {
                        case 'users':
                            if (latestData && latestData.list && Array.isArray(latestData.list)) {
                                this.users = latestData.list;
                                this.updateRoleLists();
                            } else if (latestData && Array.isArray(latestData)) {
                                // 兼容旧格�?
                                this.users = latestData;
                                this.updateRoleLists();
                            }
                            break;
                        case 'scores':
                            if (latestData) {
                                this.scores = latestData;
                            }
                            break;
                        case 'settings':
                            if (latestData) {
                                this.settings = { ...this.settings, ...latestData };
                            }
                            break;
                        case 'scoringStatus':
                            if (latestData) {
                                this.scoringStarted = latestData.scoringStarted || false;
                                this.scoringMethod = latestData.scoringMethod || 'trimmed';
                            }
                            break;
                    }
                });

                // 设置最后同步时间戳为最新记录的时间（减�?秒，以确保能获取到边界数据）
                const latestUpdate = results[0].updatedAt.getTime();
                this.lastSyncTimestamp = latestUpdate - 1000;  // 减去1�?
                localStorage.setItem(`lastSyncTimestamp_${this.sessionId}`, this.lastSyncTimestamp.toString());

                this.showNetworkSuccess('云端数据加载成功');
                return true;
            } else {

                // 设置一个较早的时间戳（5分钟前），以便能够获取到刚保存的数据
                this.lastSyncTimestamp = Date.now() - (5 * 60 * 1000);
                localStorage.setItem(`lastSyncTimestamp_${this.sessionId}`, this.lastSyncTimestamp.toString());
                return false;
            }

        } catch (error) {
            console.error('从云端加载失�?', error);
            this.showNetworkError('云端加载失败: ' + error.message);
            return false;
        }
    }

    // 恢复最后同步时间戳
    restoreLastSyncTimestamp() {
        const saved = localStorage.getItem(`lastSyncTimestamp_${this.sessionId}`);
        if (saved) {
            this.lastSyncTimestamp = parseInt(saved, 10);
            console.log('恢复最后同步时间戳:', new Date(this.lastSyncTimestamp).toLocaleString());
        } else {
            this.lastSyncTimestamp = Date.now();
            console.log('初始化同步时间戳:', new Date(this.lastSyncTimestamp).toLocaleString());
        }
    }

    processBatchAdd(names) {
        try {

            let addedCount = 0;
            let duplicateCount = 0;

            for (const name of names) {
                if (!name || typeof name !== 'string') {
                    console.warn('跳过无效姓名:', name);
                    continue;
                }

                if (this.users.find(user => user.name === name)) {
                    duplicateCount++;
                    continue;
                }

                if (this.users.length >= this.settings.maxUsers) {
                    alert(`添加后将超过用户上限�?{this.settings.maxUsers}人）`);
                    break;
                }

                const user = {
                    id: Date.now() + addedCount,
                    name: name,
                    role: 'participant'
                };

                this.users.push(user);
                addedCount++;

            }

            this.saveToLocalStorage();
            this.updateAdminInterface();

            alert(`成功添加 ${addedCount} 个用�?{duplicateCount > 0 ? `，跳�?${duplicateCount} 个重复用户` : ''}`);

        } catch (error) {
            console.error('批量添加用户时发生错�?', error);
            alert('添加用户失败，请重试');
        }
    }

    // 处理Excel文件导入
    processExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // 获取第一个工作表
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // 将工作表转换为JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    // 提取第一列的数据作为用户�?
                    const names = [];
                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (row && row[0] && typeof row[0] === 'string') {
                            const name = row[0].toString().trim();
                            if (name && name !== '用户�? && name !== '姓名' && name !== 'Name') {
                                names.push(name);
                            }
                        }
                    }

                    if (names.length === 0) {
                        reject(new Error('Excel文件第一列中未找到有效的用户�?));
                        return;
                    }

                    resolve(names);
                } catch (error) {
                    reject(new Error('Excel文件解析失败�? + error.message));
                }
            };

            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    assignRole(userId, role) {
        try {

            const user = this.users.find(u => u.id === userId);
            if (!user) {
                console.error('未找到用�?', userId);
                alert('未找到指定用�?);
                return;
            }

            // 检查数量限�?
            if (role === 'speaker') {
                const speakerCount = this.users.filter(u => u.role === 'speaker').length;
                if (speakerCount >= this.settings.maxSpeakers) {
                    alert(`演讲者数量已达上限（${this.settings.maxSpeakers}人）`);
                    return;
                }
            } else if (role === 'judge') {
                const judgeCount = this.users.filter(u => u.role === 'judge').length;
                if (judgeCount >= this.settings.maxJudges) {
                    alert(`评委数量已达上限�?{this.settings.maxJudges}人）`);
                    return;
                }
            }

            user.role = role;
            this.updateRoleLists();
            this.saveToLocalStorage();
            this.updateAdminInterface();

        } catch (error) {
            console.error('分配角色时发生错�?', error);
            alert('分配角色失败，请重试');
        }
    }

    removeRole(userId) {
        const user = this.users.find(u => u.id === userId);
        if (user) {
            user.role = 'participant';
            this.updateRoleLists();
            this.saveToLocalStorage();
            this.updateAdminInterface();
        }
    }

    updateRoleLists() {
        // 过滤掉无效的用户数据（包括null、undefined和没有name的对象）
        this.speakers = this.users.filter(u => u != null && u.role === 'speaker' && u.name);
        this.judges = this.users.filter(u => u != null && u.role === 'judge' && u.name);
    }

    autoAssignRoles() {
        const availableUsers = this.users.filter(u => u.role === 'participant');

        if (availableUsers.length < this.settings.maxSpeakers + this.settings.maxJudges) {
            alert('可用用户数量不足以完成自动分�?);
            return;
        }

        // 清空现有角色
        this.users.forEach(user => {
            if (user.role !== 'participant') {
                user.role = 'participant';
            }
        });

        // 按顺序分配：前N个为演讲者，后M个为评委
        for (let i = 0; i < this.settings.maxSpeakers && i < availableUsers.length; i++) {
            availableUsers[i].role = 'speaker';
        }

        for (let i = this.settings.maxSpeakers; i < this.settings.maxSpeakers + this.settings.maxJudges && i < availableUsers.length; i++) {
            availableUsers[i].role = 'judge';
        }

        this.updateRoleLists();
        this.saveToLocalStorage();
        this.updateAdminInterface();

        alert('自动分配完成�?);
    }

    randomAssignRoles() {
        const availableUsers = this.users.filter(u => u.role === 'participant');

        if (availableUsers.length < this.settings.maxSpeakers + this.settings.maxJudges) {
            alert('可用用户数量不足以完成随机分�?);
            return;
        }

        // 清空现有角色
        this.users.forEach(user => {
            if (user.role !== 'participant') {
                user.role = 'participant';
            }
        });

        // 随机打乱用户顺序
        const shuffled = [...availableUsers].sort(() => Math.random() - 0.5);

        // 分配角色
        for (let i = 0; i < this.settings.maxSpeakers; i++) {
            shuffled[i].role = 'speaker';
        }

        for (let i = this.settings.maxSpeakers; i < this.settings.maxSpeakers + this.settings.maxJudges; i++) {
            shuffled[i].role = 'judge';
        }

        this.updateRoleLists();
        this.saveToLocalStorage();
        this.updateAdminInterface();

        alert('随机分配完成�?);
    }

    clearAllRoles() {
        if (confirm('确定要清空所有用户的角色分配吗？')) {
            this.users.forEach(user => {
                user.role = 'participant';
            });

            this.updateRoleLists();
            this.saveToLocalStorage();
            this.updateAdminInterface();

            alert('所有角色已清空�?);
        }
    }

    updateAdminInterface() {


        // 更新用户列表
        const allUsersList = document.getElementById('allUsersList');
        const totalUsersSpan = document.getElementById('totalUsers');

        if (totalUsersSpan) {
            totalUsersSpan.textContent = this.users.length;
        }

        if (allUsersList) {
            allUsersList.innerHTML = '';
            this.users.forEach(user => {
                const li = document.createElement('li');
                li.className = `user-item ${user.role}`;
                li.innerHTML = `
                    <span>${user.name}</span>
                    <span>${this.getRoleText(user.role)}</span>
                    <button class="btn remove-btn btn-small" onclick="system.removeUser(${user.id})">删除</button>
                `;
                allUsersList.appendChild(li);
            });
        }

        // 更新可选用户列�?
        const availableUsersList = document.getElementById('availableUsersList');
        const availableCountSpan = document.getElementById('availableCount');
        const availableUsers = this.users.filter(user => user.role === 'participant');

        if (availableCountSpan) {
            availableCountSpan.textContent = availableUsers.length;
        }

        if (availableUsersList) {
            availableUsersList.innerHTML = '';
            availableUsers.forEach(user => {
                const li = document.createElement('li');
                li.className = 'user-item';
                li.innerHTML = `
                    <span>${user.name}</span>
                    <div>
                        <button class="btn assign-btn" onclick="system.assignRole(${user.id}, 'speaker')">设为演讲�?/button>
                        <button class="btn assign-btn" onclick="system.assignRole(${user.id}, 'judge')">设为评委</button>
                    </div>
                `;
                availableUsersList.appendChild(li);
            });
        }

        // 更新已指派演讲者列�?
        const assignedSpeakersList = document.getElementById('assignedSpeakersList');
        const speakerCountSpan = document.getElementById('speakerCount');

        if (speakerCountSpan) {
            speakerCountSpan.textContent = this.speakers.length;
        }

        if (assignedSpeakersList) {
            assignedSpeakersList.innerHTML = '';
            this.speakers.forEach(speaker => {
                const li = document.createElement('li');
                li.className = 'user-item speaker';
                li.innerHTML = `
                    <span>${speaker.name}</span>
                    <button class="btn remove-btn" onclick="system.removeRole(${speaker.id})">移除</button>
                `;
                assignedSpeakersList.appendChild(li);
            });
        }

        // 更新已指派评委列�?
        const assignedJudgesList = document.getElementById('assignedJudgesList');
        const judgeCountSpan = document.getElementById('judgeCount');

        if (judgeCountSpan) {
            judgeCountSpan.textContent = this.judges.length;
        }

        if (assignedJudgesList) {
            assignedJudgesList.innerHTML = '';
            this.judges.forEach(judge => {
                const li = document.createElement('li');
                li.className = 'user-item judge';
                li.innerHTML = `
                    <span>${judge.name}</span>
                    <button class="btn remove-btn" onclick="system.removeRole(${judge.id})">移除</button>
                `;
                assignedJudgesList.appendChild(li);
            });
        }

        // 更新班级管理界面
        this.updateClassManagementInterface();

        // 更新评分进度显示
        this.updateScoringProgress();
    }

    // 更新评分进度显示
    updateScoringProgress() {
        // 如果评分已开始，显示评分进度
        if (this.scoringStarted && this.speakers.length > 0 && this.judges.length > 0) {
            // 查找或创建评分进度显示区�?
            let progressArea = document.getElementById('scoringProgressArea');

            if (!progressArea) {
                // 如果不存在，创建一个新的区�?
                const scoringSettings = document.querySelector('.scoring-settings');
                if (scoringSettings) {
                    progressArea = document.createElement('div');
                    progressArea.id = 'scoringProgressArea';
                    progressArea.className = 'scoring-progress';
                    scoringSettings.appendChild(progressArea);
                }
            }

            if (progressArea) {
                // 计算评分进度
                let totalScores = 0;
                let completedScores = 0;

                this.speakers.forEach(speaker => {
                    this.judges.forEach(judge => {
                        totalScores++;
                        if (this.scores[speaker.id] && this.scores[speaker.id][judge.name]) {
                            completedScores++;
                        }
                    });
                });

                const progressPercent = totalScores > 0 ? Math.round((completedScores / totalScores) * 100) : 0;

                // 生成详细的评分状态表�?
                let progressHTML = `
                    <h4>📊 评分进度</h4>
                    <div class="progress-summary">
                        <p><strong>总体进度�?/strong> ${completedScores} / ${totalScores} (${progressPercent}%)</p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%; background: ${progressPercent === 100 ? '#4caf50' : '#2196f3'}"></div>
                        </div>
                    </div>
                    <div class="progress-details">
                        <table class="progress-table">
                            <thead>
                                <tr>
                                    <th>演讲�?/th>
                `;

                // 添加评委列标�?
                this.judges.forEach(judge => {
                    progressHTML += `<th>${judge.name}</th>`;
                });
                progressHTML += `<th>完成�?/th></tr></thead><tbody>`;

                // 添加每个演讲者的评分状�?
                this.speakers.forEach(speaker => {
                    let speakerCompleted = 0;
                    progressHTML += `<tr><td><strong>${speaker.name}</strong></td>`;

                    this.judges.forEach(judge => {
                        const hasScore = this.scores[speaker.id] && this.scores[speaker.id][judge.name];
                        if (hasScore) {
                            speakerCompleted++;
                            const score = this.scores[speaker.id][judge.name].total || 0;
                            progressHTML += `<td class="scored">�?${score}�?/td>`;
                        } else {
                            progressHTML += `<td class="not-scored">�?未评�?/td>`;
                        }
                    });

                    const speakerPercent = Math.round((speakerCompleted / this.judges.length) * 100);
                    progressHTML += `<td>${speakerCompleted}/${this.judges.length} (${speakerPercent}%)</td>`;
                    progressHTML += `</tr>`;
                });

                progressHTML += `</tbody></table></div>`;

                // 如果所有评分都完成了，显示特殊提示
                if (completedScores === totalScores && totalScores > 0) {
                    progressHTML += `
                        <div class="all-completed-notice">
                            <p style="color: #4caf50; font-weight: bold; font-size: 16px;">
                                🎉 所有评分已完成！可以查看最终结果了�?
                            </p>
                        </div>
                    `;
                }

                progressArea.innerHTML = progressHTML;
                progressArea.style.display = 'block';
            }
        } else {
            // 如果评分未开始，隐藏进度显示
            const progressArea = document.getElementById('scoringProgressArea');
            if (progressArea) {
                progressArea.style.display = 'none';
            }
        }
    }

    getRoleText(role) {
        const roles = {
            'participant': '普通用�?,
            'speaker': '演讲�?,
            'judge': '评委'
        };
        return roles[role] || role;
    }

    // 班级管理功能
    updateClassManagementInterface() {
        const currentClassSelect = document.getElementById('currentClassSelect');
        const classInfoDisplay = document.getElementById('classInfoDisplay');
        const classDataCount = document.getElementById('classDataCount');

        if (currentClassSelect) {
            // 更新班级选择下拉�?
            currentClassSelect.innerHTML = '<option value="">选择班级</option>';
            this.classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.id;
                // 为固定班级添加标�?
                option.textContent = cls.isFixed ? `${cls.name} [固定]` : cls.name;
                option.selected = this.currentClass && this.currentClass.id === cls.id;
                currentClassSelect.appendChild(option);
            });
        }

        if (classInfoDisplay) {
            if (this.currentClass) {
                const fixedLabel = this.currentClass.isFixed ? ' [固定班级]' : '';
                classInfoDisplay.textContent = `${this.currentClass.name}${fixedLabel} (创建�? ${this.currentClass.createdAt})`;
            } else {
                classInfoDisplay.textContent = '请选择班级';
            }
        }

        // 更新班级总人�?
        const classTotalUsers = document.getElementById('classTotalUsers');
        if (classTotalUsers) {
            classTotalUsers.textContent = this.users.length;
        }

        if (classDataCount) {
            const sessionCount = this.currentClass ? this.getClassSessionCount(this.currentClass.id) : 0;
            classDataCount.textContent = sessionCount;
        }
    }

    async createNewClass() {
        const className = prompt('请输入班级名�?');
        if (!className || className.trim() === '') {
            this.showToast('班级名称不能为空', 'warning');
            return;
        }

        try {
            const newClass = {
                id: Date.now().toString(),
                name: className.trim(),
                createdAt: new Date().toLocaleString(),
                sessions: []
            };

            this.classes.push(newClass);
            this.currentClass = newClass;
            this.currentClassId = newClass.id;

            // 重置当前会话数据，为新班级准备干净的环�?
            this.users = [];
            this.speakers = [];
            this.judges = [];
            this.scores = {};
            this.scoringStarted = false;

            // 保存班级信息到本�?
            this.saveClassesToLocalStorage();

            this.updateClassManagementInterface();
            this.updateAdminInterface();

            this.showToast(`班级 "${className}" 创建成功！`, 'success');

        } catch (error) {
            console.error('创建班级时发生错�?', error);
            this.showToast(`创建班级失败: ${error.message || '未知错误'}`, 'error');
        }
    }

    // 云端重试功能已移�?

    editCurrentClass() {
        if (!this.currentClass) {
            alert('请先选择一个班�?);
            return;
        }

        // 检查是否为固定班级
        if (this.currentClass.isFixed) {
            alert('固定班级不能编辑�?);
            return;
        }

        const newName = prompt('请输入新的班级名�?', this.currentClass.name);
        if (!newName || newName.trim() === '') {
            alert('班级名称不能为空');
            return;
        }

        this.currentClass.name = newName.trim();
        this.saveClassesToLocalStorage();
        this.updateClassManagementInterface();
        alert('班级名称修改成功�?);
    }

    deleteCurrentClass() {
        if (!this.currentClass) {
            alert('请先选择一个班�?);
            return;
        }

        // 检查是否为固定班级
        if (this.currentClass.isFixed) {
            alert('固定班级不能删除�?);
            return;
        }

        const sessionCount = this.getClassSessionCount(this.currentClass.id);
        const confirmMessage = sessionCount > 0
            ? `确定要删除班�?"${this.currentClass.name}" 吗？\n这将删除该班级的 ${sessionCount} 个会话记录，此操作不可恢复！`
            : `确定要删除班�?"${this.currentClass.name}" 吗？`;

        if (confirm(confirmMessage)) {
            this.classes = this.classes.filter(cls => cls.id !== this.currentClass.id);
            this.currentClass = null;
            this.saveClassesToLocalStorage();
            this.updateClassManagementInterface();
            alert('班级删除成功�?);
        }
    }

    async switchToClass(classId) {
        try {
            if (!classId) {
                this.currentClass = null;
                this.currentClassId = null;
                this.updateClassManagementInterface();
                return;
            }

            const selectedClass = this.classes.find(cls => cls.id === classId);
            if (!selectedClass) {
                console.error('未找到指定的班级:', classId);
                alert('未找到指定的班级，请重新选择');
                return;
            }

            // 先保存当前班级的数据到本�?
            if (this.currentClassId) {
                try {
                    this.saveToLocalStorage();
                } catch (saveError) {
                    console.error('保存当前班级数据失败:', saveError);
                    // 继续执行切换，不中断流程
                }
            }

            // 切换到新班级
            this.currentClass = selectedClass;
            this.currentClassId = classId;

            // 保存当前班级信息到本地存�?
            this.saveClassesToLocalStorage();

            // 停止当前的云端同�?
            this.stopIncrementalPolling();

            // 重置当前会话数据
            this.users = [];
            this.speakers = [];
            this.judges = [];
            this.scores = {};
            this.scoringStarted = false;

            // 注意：不生成新的sessionId，保持原有sessionId
            // 这样评委可以继续使用相同的会话ID登录

            // 如果是固定班级，直接加载学生名单
            if (selectedClass.isFixed && selectedClass.students && selectedClass.students.length > 0) {

                this.users = selectedClass.students.map((studentName, index) => ({
                    id: Date.now() + index,
                    name: studentName,
                    role: 'participant'
                }));


                // 更新总人数限制为班级人数
                this.settings.maxUsers = this.users.length;


                this.updateRoleLists();
                // 保存到本地存储（不触发云端同步）
                const data = {
                    sessionId: this.sessionId,
                    users: this.users,
                    speakers: this.speakers,
                    judges: this.judges,
                    scores: this.scores,
                    scoringMethod: this.scoringMethod,
                    scoringStarted: this.scoringStarted,
                    settings: this.settings,
                    currentUser: this.currentUser
                };
                if (this.currentClassId) {
                    const classKey = `speechScoringSystem_class_${this.currentClassId}`;
                    localStorage.setItem(classKey, JSON.stringify(data));

                }
            } else {
                // 非固定班级，从本地加载数�?
                try {
                    this.loadFromLocalStorage();
                } catch (localLoadError) {
                    console.error('从本地加载数据失�?', localLoadError);
                }
            }

            // 重新启动轮询（切换班级后需要重新启动）

            this.startIncrementalPolling();

            // 更新界面
            try {
                this.updateClassManagementInterface();
                this.updateAdminInterface();
                this.updateSettingsDisplay(); // 更新设置显示，包括maxUsersDisplay

                // 更新设置输入框的显示
                const maxUsersInput = document.getElementById('maxUsersInput');
                if (maxUsersInput) {
                    maxUsersInput.value = this.settings.maxUsers;
                }

                // 确保下拉框显示正确的选中状�?
                const currentClassSelect = document.getElementById('currentClassSelect');
                if (currentClassSelect) {
                    currentClassSelect.value = classId;
                }
            } catch (updateError) {
                console.error('更新界面失败:', updateError);
            }


            alert(`已切换到班级: ${selectedClass.name}`);

        } catch (error) {
            console.error('切换班级时发生错�?', error);
            alert('切换班级失败，请重试');
        }
    }

    getClassSessionCount(classId) {
        // 从localStorage获取该班级的会话数量
        const classKey = `speechScoring_class_${classId}`;
        const classData = localStorage.getItem(classKey);
        if (classData) {
            try {
                const data = JSON.parse(classData);
                return data.sessions ? data.sessions.length : 0;
            } catch (e) {
                return 0;
            }
        }
        return 0;
    }

    loadClassData(classId) {
        // 加载指定班级的数�?
        const classKey = `speechScoring_class_${classId}`;
        const classData = localStorage.getItem(classKey);
        if (classData) {
            try {
                const data = JSON.parse(classData);
                // 这里可以加载班级特定的用户、会话等数据
                // 暂时保持当前实现，后续可以扩�?
            } catch (e) {
                console.warn('加载班级数据失败:', e);
            }
        }
    }

    saveClassesToLocalStorage() {
        localStorage.setItem('speechScoring_classes', JSON.stringify(this.classes));
        if (this.currentClass) {
            localStorage.setItem('speechScoring_currentClass', JSON.stringify(this.currentClass));
        } else {
            localStorage.removeItem('speechScoring_currentClass');
        }
    }

    loadClassesFromLocalStorage() {
        try {
            const classesData = localStorage.getItem('speechScoring_classes');
            if (classesData) {
                const loadedClasses = JSON.parse(classesData);
                // 只保留固定班�?
                this.classes = loadedClasses.filter(cls => cls.isFixed);
            } else {
                this.classes = [];
            }

            // 初始化固定班级（如果还没有的话）
            this.initializeFixedClasses();

            const currentClassData = localStorage.getItem('speechScoring_currentClass');
            if (currentClassData) {
                const loadedCurrentClass = JSON.parse(currentClassData);
                // 只有当前班级是固定班级时才恢�?
                if (loadedCurrentClass && loadedCurrentClass.isFixed) {
                    this.currentClass = loadedCurrentClass;
                } else {
                    this.currentClass = null;
                }
            }
        } catch (e) {
            console.warn('加载班级数据失败:', e);
            this.classes = [];
            this.currentClass = null;
            // 即使出错也要初始化固定班�?
            this.initializeFixedClasses();
        }
    }

    // 初始化固定班�?
    initializeFixedClasses() {
        // �?fixed_classes_data.js 获取学生名单
        const studentsData = window.FIXED_CLASS_STUDENTS || {};

        const fixedClasses = [
            {
                id: "fixed_youhao101",
                name: "友好101",
                createdAt: "2024-01-01T00:00:00.000Z",
                isFixed: true,
                students: studentsData["友好101"] || [],
                studentCount: (studentsData["友好101"] || []).length,
                sessions: []
            },
            {
                id: "fixed_youhao102",
                name: "友好102",
                createdAt: "2024-01-01T00:00:00.000Z",
                isFixed: true,
                students: studentsData["友好102"] || [],
                studentCount: (studentsData["友好102"] || []).length,
                sessions: []
            },
            {
                id: "fixed_youhao103",
                name: "友好103",
                createdAt: "2024-01-01T00:00:00.000Z",
                isFixed: true,
                students: studentsData["友好103"] || [],
                studentCount: (studentsData["友好103"] || []).length,
                sessions: []
            }
        ];

        // 检查并添加不存在的固定班级
        fixedClasses.forEach(fixedClass => {
            const existingClass = this.classes.find(cls => cls.id === fixedClass.id);
            if (!existingClass) {
                this.classes.unshift(fixedClass); // 添加到数组开�?

            } else {
                // 确保现有的固定班级有正确的标记和学生数据
                existingClass.isFixed = true;
                if (!existingClass.students) {
                    existingClass.students = fixedClass.students;
                    existingClass.studentCount = fixedClass.studentCount;
                }
            }
        });

        // 保存更新后的班级列表
        this.saveClassesToLocalStorage();
    }

    // 评分系统
    startScoring() {
        if (this.speakers.length === 0) {
            alert('请先指派演讲�?);
            return;
        }

        if (this.judges.length === 0) {
            alert('请先指派评委');
            return;
        }

        // 从界面读取评分方�?
        const selected = document.querySelector('input[name="scoringMethod"]:checked');
        if (selected) this.scoringMethod = selected.value || 'trimmed';

        this.scoringStarted = true;
        this.initializeScores();
        this.saveToLocalStorage();

        // 云端同步功能已移�?

        alert(`评分开始！共有 ${this.speakers.length} 位演讲者，${this.judges.length} 位评委`);
        this.updateAdminInterface();
    }

    initializeScores() {
        this.speakers.forEach(speaker => {
            if (!this.scores[speaker.id]) {
                this.scores[speaker.id] = {};
            }
        });
    }

    updateJudgeInterface() {

        const container = document.getElementById('speakersToScore');

        if (!container) return;

        // 检查当前用户是否存�?
        if (!this.currentUser || !this.currentUser.name) {
            container.innerHTML = '<p>请先登录�?/p>';
            return;
        }

        if (!this.scoringStarted) {
            container.innerHTML = '<p>评分尚未开始，请等待管理员开启评分�?/p>';
            return;
        }

        // 检查当前用户是否是评委
        const isJudge = this.judges.find(judge => judge != null && judge.name === this.currentUser.name);
        if (!isJudge) {
            container.innerHTML = '<p>您不是评委，无法进行评分�?/p>';
            return;
        }

        // 检查当前评委是否已完成所有评�?
        const hasCompletedAllScoring = this.checkJudgeCompletedScoring(this.currentUser.name);

        container.innerHTML = '';

        // 如果已完成所有评分，显示特殊的状态说�?
        if (hasCompletedAllScoring) {
            const completedNoticeDiv = document.createElement('div');
            completedNoticeDiv.innerHTML = `
                <div style="background: #e8f5e8; border: 2px solid #4caf50; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                    <h3 style="color: #2e7d32; margin-bottom: 10px;">�?评分已完�?/h3>
                    <p style="color: #2e7d32; font-size: 16px; margin-bottom: 15px;">
                        您已完成对所�?${this.speakers.length} 位演讲者的评分�?
                    </p>
                    <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                        下方显示的是您的评分记录，所有评分项目已锁定，无法修改�?
                    </p>
                    <button class="btn" onclick="system.backToLogin()" style="margin-right: 10px;">
                        返回登录
                    </button>
                    <button class="btn btn-secondary" onclick="system.exportJudgeResults()">
                        导出我的评分记录
                    </button>
                </div>
            `;
            container.appendChild(completedNoticeDiv);
        } else {
            // 添加一键提交按钮和返回按钮
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'submit-all-section';
            controlsDiv.innerHTML = `
                <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4>批量操作</h4>
                    <button class="btn btn-primary" onclick="system.submitAllScores()">
                        一键提交所有评�?
                    </button>
                    <button class="btn" onclick="system.backToLogin()">
                        返回登录
                    </button>
                </div>
            `;
            container.appendChild(controlsDiv);
        }

        this.speakers.forEach(speaker => {
            const card = document.createElement('div');
            card.className = 'speaker-card';

            const speakerScores = this.scores[speaker.id] || {};
            const currentScores = speakerScores[this.currentUser.name] || {};
            const hasScored = currentScores.total !== undefined;

            // 评分项目定义
            const scoreItems = [
                { key: 'content', name: '讲稿内容', max: 40 },
                { key: 'language_speed', name: '语�?, max: 10 },
                { key: 'language_pause', name: '停顿强调', max: 10 },
                { key: 'language_fluency', name: '流利�?, max: 15 },
                { key: 'appearance', name: '衣着形象', max: 10 },
                { key: 'body', name: '肢体语言', max: 15 }
            ];

            let scoreInputsHTML = '';
            scoreItems.forEach(item => {
                const value = currentScores[item.key] || '';
                scoreInputsHTML += `
                    <div class="score-item">
                        <label>${item.name} (0-${item.max}�? ${item.desc || ''}:</label>
                        <input type="number" 
                               min="0" 
                               max="${item.max}" 
                               value="${value}"
                               id="score-${speaker.id}-${item.key}"
                               class="judge-score-input"
                               ${hasScored ? 'readonly' : ''}
                               onchange="system.calculateTotalScore(${speaker.id})">
                    </div>
                `;
            });

            const totalScore = currentScores.total || '';

            card.innerHTML = `
                <h3>${speaker.name}</h3>
                <div class="score-inputs">
                    ${scoreInputsHTML}
                    <div class="total-score">
                        <label><strong>总分 (0-100):</strong></label>
                        <input type="number" 
                               id="total-score-${speaker.id}"
                               class="total-score-input"
                               value="${totalScore}"
                               readonly>
                    </div>
                    <button class="btn btn-primary" 
                            onclick="system.submitScore(${speaker.id})"
                            ${hasScored ? 'disabled' : ''}>
                        ${hasScored ? '已评�? : '提交评分'}
                    </button>
                </div>
                ${hasScored ? `<p style="color: green;">您已为此演讲者评分，总分: ${totalScore}�?/p>` : ''}
            `;
            container.appendChild(card);
        });

        this.checkAllScoresComplete();
    }

    // 计算总分
    calculateTotalScore(speakerId) {
        const scoreItems = ['content', 'language_speed', 'language_pause', 'language_fluency', 'appearance', 'body'];
        let total = 0;
        let allFilled = true;

        scoreItems.forEach(item => {
            const input = document.getElementById(`score-${speakerId}-${item}`);
            if (input) {
                const value = parseFloat(input.value) || 0;
                total += value;
                if (!input.value) allFilled = false;
            }
        });

        const totalInput = document.getElementById(`total-score-${speakerId}`);
        if (totalInput) {
            totalInput.value = total;
        }

        return { total, allFilled };
    }

    // 在提交评分后，写�?Score 以通知其他设备
    submitScore(speakerId, score) {
        // 检查是否已经评过分（防止重复评分）
        const existingScores = this.scores[speakerId] || {};
        const currentJudgeScore = existingScores[this.currentUser.name];

        if (currentJudgeScore && currentJudgeScore.total !== undefined) {
            const confirmOverwrite = confirm(
                `您已经为该演讲者评过分了（总分�?{currentJudgeScore.total}分）。\n\n` +
                `是否要覆盖之前的评分？\n\n` +
                `点击"确定"覆盖，点�?取消"保留原评分。`
            );

            if (!confirmOverwrite) {
                return; // 用户选择不覆盖，退出评�?
            }
        }

        // 收集所有评分项目的分数
        const scoreItems = [
            { key: 'content', name: '讲稿内容', max: 40 },
            { key: 'language_speed', name: '语�?, max: 10 },
            { key: 'language_pause', name: '停顿强调', max: 10 },
            { key: 'language_fluency', name: '流利�?, max: 15 },
            { key: 'appearance', name: '衣着形象', max: 10 },
            { key: 'body', name: '肢体语言', max: 15 }
        ];

        const scores = {};
        let totalScore = 0;
        let hasError = false;

        // 验证每个评分项目
        scoreItems.forEach(item => {
            const input = document.getElementById(`score-${speakerId}-${item.key}`);
            if (input) {
                const value = parseFloat(input.value);
                if (isNaN(value) || value < 0 || value > item.max) {
                    alert(`请为"${item.name}"输入0-${item.max}之间的有效分数`);
                    hasError = true;
                    return;
                }
                scores[item.key] = value;
                totalScore += value;
            }
        });

        if (hasError) return;

        // 检查是否所有项目都已填�?
        if (Object.keys(scores).length !== scoreItems.length) {
            alert('请完成所有评分项�?);
            return;
        }

        if (totalScore > 100) {
            alert('总分不能超过100分，请调整各项评�?);
            return;
        }

        // 确保scores对象存在
        if (!this.scores[speakerId]) {
            this.scores[speakerId] = {};
        }

        // 保存详细评分和总分
        scores.total = totalScore;
        this.scores[speakerId][this.currentUser.name] = scores;

        this.saveToLocalStorage();
        this.updateJudgeInterface();

        // 保存评分数据到云�?
        this.saveToCloud('scores', this.scores).then(success => {
            if (success) {

            }
        });

        // 改进的用户反�?
        this.showScoreSubmissionFeedback(speakerId, totalScore, scores);
    }

    submitAllScores() {
        let submittedCount = 0;
        let errorMessages = [];
        let allValid = true;

        // 评分项目定义
        const scoreItems = [
            { key: 'content', name: '讲稿内容', max: 40 },
            { key: 'language_speed', name: '语�?, max: 10 },
            { key: 'language_pause', name: '停顿强调', max: 10 },
            { key: 'language_fluency', name: '流利�?, max: 15 },
            { key: 'appearance', name: '衣着形象', max: 10 },
            { key: 'body', name: '肢体语言', max: 15 }
        ];

        // 遍历每个演讲�?
        this.speakers.forEach(speaker => {
            const speakerScores = this.scores[speaker.id] || {};
            const currentScores = speakerScores[this.currentUser.name] || {};

            // 如果已经评分，跳�?
            if (currentScores.total !== undefined) return;

            const scores = {};
            let totalScore = 0;
            let speakerHasError = false;
            let incompleteItems = [];

            // 收集该演讲者的所有评分项�?
            scoreItems.forEach(item => {
                const input = document.getElementById(`score-${speaker.id}-${item.key}`);
                if (input && input.value) {
                    const value = parseFloat(input.value);
                    if (isNaN(value) || value < 0 || value > item.max) {
                        speakerHasError = true;
                        errorMessages.push(`${speaker.name} - ${item.name}: 请输�?-${item.max}之间的有效分数`);
                        return;
                    }
                    scores[item.key] = value;
                    totalScore += value;
                } else {
                    incompleteItems.push(item.name);
                }
            });

            // 检查是否所有项目都已填�?
            if (incompleteItems.length > 0) {
                errorMessages.push(`${speaker.name}: 请完成以下评分项�?- ${incompleteItems.join(', ')}`);
                allValid = false;
                return;
            }

            if (speakerHasError) {
                allValid = false;
                return;
            }

            if (totalScore > 100) {
                errorMessages.push(`${speaker.name}: 总分${totalScore}分超�?00分，请调整各项评分`);
                allValid = false;
                return;
            }

            // 确保scores对象存在
            if (!this.scores[speaker.id]) {
                this.scores[speaker.id] = {};
            }

            // 保存详细评分和总分
            scores.total = totalScore;
            this.scores[speaker.id][this.currentUser.name] = scores;
            submittedCount++;
        });

        if (!allValid) {
            alert('以下评分有误，请检查：\n' + errorMessages.join('\n'));
            return;
        }

        if (submittedCount === 0) {
            alert('没有新的评分需要提�?);
            return;
        }

        this.saveToLocalStorage();
        this.updateJudgeInterface();

        // 保存评分数据到云�?
        this.saveToCloud('scores', this.scores).then(success => {
            if (success) {

            }
        });

        // 改进的批量提交反�?
        this.showBatchSubmissionFeedback(submittedCount);
    }

    backToLogin() {
        this.currentUser = null;
        this.updateUserInfo();
        this.showSection('loginSection');
    }

    updateSpeakerInterface() {

        const container = document.getElementById('speakerInfo');

        if (!container) return;

        if (!this.scoringStarted) {
            container.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <button class="btn" onclick="system.backToLogin()">返回登录</button>
                </div>
                <p>评分尚未开始，请等待管理员开启评分�?/p>
            `;
            return;
        }

        const speaker = this.speakers.find(s => s.name === this.currentUser.name);
        if (!speaker) {
            container.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <button class="btn" onclick="system.backToLogin()">返回登录</button>
                </div>
                <p>您不在演讲者名单中�?/p>
            `;
            return;
        }

        const speakerScores = this.scores[speaker.id] || {};
        const scoreCount = Object.keys(speakerScores).length;
        const totalJudges = this.judges.length;

        let html = `
            <div style="margin-bottom: 20px;">
                <button class="btn" onclick="system.backToLogin()">返回登录</button>
            </div>
            <h3>演讲者信�?/h3>
            <p><strong>姓名:</strong> ${speaker.name}</p>
            <p><strong>评分进度:</strong> ${scoreCount}/${totalJudges} 位评委已评分</p>
        `;

        if (scoreCount > 0 && scoreCount < totalJudges) {
            html += `
                <p style="color: #666;">已收�?${scoreCount} 位评委的评分，等待其他评委完成评�?..</p>
            `;
        }

        if (scoreCount === totalJudges) {
            // 提取分数值，处理对象和数字两种格�?
            const scores = Object.values(speakerScores).map(score => {
                if (typeof score === 'object' && score.total !== undefined) {
                    return score.total;
                } else if (typeof score === 'number') {
                    return score;
                }
                return 0;
            }).filter(score => !isNaN(score) && score > 0);

            let finalScore = 0;

            if (scores.length > 0) {
                if (this.scoringMethod === 'trimmed' && scores.length > 2) {
                    const sortedScores = [...scores].sort((a, b) => a - b);
                    const trimmedScores = sortedScores.slice(1, -1);
                    finalScore = trimmedScores.reduce((sum, score) => sum + score, 0) / trimmedScores.length;
                } else {
                    finalScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
                }
            }

            html += `
                <div style="background: #e6fffa; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <h4>最终得�? ${finalScore.toFixed(2)}�?/h4>
                    <p>评分方法: ${this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均�? : '加权平均'}</p>
                    <p style="color: #666; font-size: 14px; margin-top: 10px;">详细评分: ${scores.map(s => s.toFixed(2)).join(', ')}</p>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    // 显示单个评分提交的详细反�?
    showScoreSubmissionFeedback(speakerId, totalScore, scores) {
        const speaker = this.speakers.find(s => s.id === speakerId);
        const speakerName = speaker ? speaker.name : `演讲�?{speakerId}`;

        // 计算已完成评分的演讲者数�?
        const completedCount = this.speakers.filter(s => {
            const speakerScores = this.scores[s.id] || {};
            return speakerScores[this.currentUser.name] && speakerScores[this.currentUser.name].total !== undefined;
        }).length;

        const totalSpeakers = this.speakers.length;
        const remainingCount = totalSpeakers - completedCount;

        // 创建详细的评分反馈模态框
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
            z-index: 1000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); text-align: center;
        `;

        // 评分详情
        const scoreDetails = [
            { key: 'content', name: '讲稿内容', max: 40 },
            { key: 'language_speed', name: '语�?, max: 10 },
            { key: 'language_pause', name: '停顿强调', max: 10 },
            { key: 'language_fluency', name: '流利�?, max: 15 },
            { key: 'appearance', name: '衣着形象', max: 10 },
            { key: 'body', name: '肢体语言', max: 15 }
        ];

        const detailsHtml = scoreDetails.map(item =>
            `<div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>${item.name}:</span>
                <span><strong>${scores[item.key] || 0}</strong>/${item.max}�?/span>
            </div>`
        ).join('');

        content.innerHTML = `
            <div style="color: #4caf50; font-size: 48px; margin-bottom: 15px;">�?/div>
            <h3 style="color: #2e7d32; margin-bottom: 20px;">评分提交成功�?/h3>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px; color: #333;">评分详情 - ${speakerName}</h4>
                ${detailsHtml}
                <hr style="margin: 15px 0; border: none; border-top: 2px solid #e0e0e0;">
                <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold;">
                    <span>总分:</span>
                    <span style="color: #2e7d32;">${totalScore}/100�?/span>
                </div>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #1976d2;">评分进度</h4>
                <p style="margin: 5px 0; font-size: 16px;">
                    已完�? <strong>${completedCount}</strong>/${totalSpeakers} 位演讲�?
                </p>
                ${remainingCount > 0 ?
                `<p style="margin: 5px 0; color: #ff9800;">还需评分: <strong>${remainingCount}</strong> 位演讲�?/p>` :
                `<p style="margin: 5px 0; color: #4caf50; font-weight: bold;">🎉 所有演讲者评分已完成�?/p>`
            }
            </div>
            
            <div style="margin-top: 20px;">
                ${remainingCount > 0 ?
                `<button class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.remove()" style="margin-right: 10px;">
                        继续评分
                    </button>` : ''
            }
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">
                    关闭
                </button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        // 3秒后自动关闭（如果还有未完成的评分）
        if (remainingCount > 0) {
            setTimeout(() => {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            }, 3000);
        }
    }

    // 显示批量提交的反�?
    showBatchSubmissionFeedback(submittedCount) {
        const totalSpeakers = this.speakers.length;
        const completedCount = this.speakers.filter(s => {
            const speakerScores = this.scores[s.id] || {};
            return speakerScores[this.currentUser.name] && speakerScores[this.currentUser.name].total !== undefined;
        }).length;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
            z-index: 1000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 30px; border-radius: 12px; max-width: 450px; width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); text-align: center;
        `;

        const isAllCompleted = completedCount === totalSpeakers;

        content.innerHTML = `
            <div style="color: #4caf50; font-size: 48px; margin-bottom: 15px;">
                ${isAllCompleted ? '🎉' : '�?}
            </div>
            <h3 style="color: #2e7d32; margin-bottom: 20px;">
                ${isAllCompleted ? '所有评分已完成�? : '批量提交成功�?}
            </h3>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <p style="font-size: 18px; margin-bottom: 15px;">
                    本次提交: <strong style="color: #2e7d32;">${submittedCount}</strong> 个演讲�?
                </p>
                <p style="font-size: 16px; margin-bottom: 10px;">
                    总进�? <strong>${completedCount}</strong>/${totalSpeakers} 位演讲者已评分
                </p>
                <div style="background: #e0e0e0; height: 8px; border-radius: 4px; margin: 10px 0;">
                    <div style="background: #4caf50; height: 100%; width: ${(completedCount / totalSpeakers) * 100}%; border-radius: 4px; transition: width 0.3s;"></div>
                </div>
            </div>
            
            ${isAllCompleted ?
                `<div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="color: #2e7d32; font-weight: bold; margin: 0;">
                        🎊 恭喜！您已完成所有演讲者的评分工作�?
                    </p>
                </div>` :
                `<div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="color: #f57c00; margin: 0;">
                        还有 <strong>${totalSpeakers - completedCount}</strong> 位演讲者等待评�?
                    </p>
                </div>`
            }
            
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.remove()">
                    ${isAllCompleted ? '完成' : '继续'}
                </button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        // 如果未全部完成，3秒后自动关闭
        if (!isAllCompleted) {
            setTimeout(() => {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            }, 3000);
        }
    }

    checkAllScoresComplete() {
        let allComplete = true;

        for (let speakerId of Object.keys(this.scores)) {
            const speakerScores = this.scores[speakerId];
            for (let judge of this.judges) {
                if (speakerScores[judge.name] === undefined) {
                    allComplete = false;
                    break;
                }
            }
            if (!allComplete) break;
        }

        if (allComplete && this.judges.length > 0) {
            this.showResults();
        }
    }

    calculateFinalScores() {
        const results = [];

        this.speakers.forEach(speaker => {
            const speakerScores = this.scores[speaker.id] || {};
            const judgeScores = Object.values(speakerScores);

            // 提取总分数组（兼容新旧格式）
            const totalScores = judgeScores.map(score => {
                if (typeof score === 'object' && score.total !== undefined) {
                    return score.total; // 新格式：多项评分
                } else if (typeof score === 'number') {
                    return score; // 旧格式：单一评分
                } else {
                    return 0;
                }
            }).filter(score => score !== undefined && score !== null);

            let finalScore = 0;

            if (totalScores.length === 0) {
                finalScore = 0;
            } else if (this.scoringMethod === 'trimmed' && totalScores.length > 2) {
                // 去掉最高分和最低分求平均�?
                const sortedScores = [...totalScores].sort((a, b) => a - b);
                const trimmedScores = sortedScores.slice(1, -1);
                finalScore = trimmedScores.reduce((sum, score) => sum + score, 0) / trimmedScores.length;
            } else {
                // 直接求平均值（加权平均，这里权重相等）
                finalScore = totalScores.reduce((sum, score) => sum + score, 0) / totalScores.length;
            }

            results.push({
                speaker: speaker,
                scores: totalScores,
                detailedScores: judgeScores, // 保存详细评分信息
                finalScore: finalScore.toFixed(2),
                method: this.scoringMethod
            });
        });

        return results.sort((a, b) => b.finalScore - a.finalScore);
    }

    showResults() {
        const results = this.calculateFinalScores();
        this.displayResults(results);
        this.showSection('resultsSection');

        // 根据用户类型显示返回按钮
        const backBtn = document.getElementById('backToAdminBtn');
        if (backBtn) {
            if (this.currentUser && this.currentUser.type === 'admin') {
                backBtn.style.display = 'inline-block';
            } else {
                backBtn.style.display = 'none';
            }
        }
    }

    displayResults(results) {
        const container = document.getElementById('resultsDisplay');
        if (!container) return;

        // 根据用户角色显示不同的结�?
        if (this.currentUser && this.currentUser.type === 'admin') {
            this.displayAdminResults(results, container);
        } else {
            this.displayPublicResults(results, container);
        }
    }

    displayAdminResults(results, container) {
        let html = `
            <h3>管理员视�?- 详细评分结果 (${this.scoringMethod === 'trimmed' ? '去掉最高最低分平均�? : '加权平均'})</h3>
            <p><strong>会话ID:</strong> ${this.sessionId}</p>
            <p><strong>评分标准:</strong> 讲稿内容(40�? + 语�?10�? + 停顿强调(10�? + 流利�?15�? + 衣着形象(10�? + 肢体语言(15�? = 总分(100�?</p>
        `;

        results.forEach((result, index) => {
            html += `
                <div style="margin-bottom: 30px; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
                    <h4>${index + 1}. ${result.speaker.name} - 最终得�? ${result.finalScore}�?/h4>
                    <table class="results-table">
                        <thead>
                            <tr>
                                <th>评委姓名</th>
                                <th>讲稿内容<br>(40�?</th>
                                <th>语�?br>(10�?</th>
                                <th>停顿强调<br>(10�?</th>
                                <th>流利�?br>(15�?</th>
                                <th>衣着形象<br>(10�?</th>
                                <th>肢体语言<br>(15�?</th>
                                <th>总分</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            // 显示每个评委的详细评�?
            const speakerScores = this.scores[result.speaker.id] || {};
            this.judges.forEach(judge => {
                const score = speakerScores[judge.name];
                if (score !== undefined) {
                    if (typeof score === 'object') {
                        // 新格式：多项评分
                        if (score.language_speed !== undefined) {
                            // 新的细分格式
                            html += `
                                <tr>
                                    <td>${judge.name}</td>
                                    <td>${score.content || 0}�?/td>
                                    <td>${score.language_speed || 0}�?/td>
                                    <td>${score.language_pause || 0}�?/td>
                                    <td>${score.language_fluency || 0}�?/td>
                                    <td>${score.appearance || 0}�?/td>
                                    <td>${score.body || 0}�?/td>
                                    <td><strong>${score.total || 0}�?/strong></td>
                                </tr>
                            `;
                        } else {
                            // 旧的语言表达格式
                            html += `
                                <tr>
                                    <td>${judge.name}</td>
                                    <td>${score.content || 0}�?/td>
                                    <td colspan="3">${score.language || 0}�?(旧格�?</td>
                                    <td>${score.appearance || 0}�?/td>
                                    <td>${score.body || 0}�?/td>
                                    <td><strong>${score.total || 0}�?/strong></td>
                                </tr>
                            `;
                        }
                    } else {
                        // 旧格式：单一评分
                        html += `
                            <tr>
                                <td>${judge.name}</td>
                                <td colspan="6" style="text-align: center;">旧格式评�?/td>
                                <td><strong>${score}�?/strong></td>
                            </tr>
                        `;
                    }
                } else {
                    html += `
                        <tr>
                            <td>${judge.name}</td>
                            <td colspan="6" style="text-align: center;">未评�?/td>
                            <td><strong>-</strong></td>
                        </tr>
                    `;
                }
            });

            html += `
                        </tbody>
                    </table>
                    <p><strong>总分列表:</strong> ${result.scores.join(', ')}</p>
                </div>
            `;
        });

        html += `
            <div style="margin-top: 20px; background: #f7fafc; padding: 15px; border-radius: 8px;">
                <p><strong>评分统计:</strong></p>
                <p>总演讲者数: ${this.speakers.length}</p>
                <p>总评委数: ${this.judges.length}</p>
                <p>评分方法: ${this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均�? : '加权平均'}</p>
                <p>生成时间: ${new Date().toLocaleString()}</p>
            </div>
        `;

        container.innerHTML = html;
    }

    displayPublicResults(results, container) {
        let html = `
            <h3>评分结果 (${this.scoringMethod === 'trimmed' ? '去掉最高最低分平均�? : '加权平均'})</h3>
            <table class="results-table">
                <thead>
                    <tr>
                        <th>排名</th>
                        <th>演讲�?/th>
                        <th>最终得�?/th>
                        <th>评委数量</th>
                    </tr>
                </thead>
                <tbody>
        `;

        results.forEach((result, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${result.speaker.name}</td>
                    <td><strong>${result.finalScore}</strong></td>
                    <td>${result.scores.length}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            <div style="margin-top: 20px;">
                <p><strong>评分统计:</strong></p>
                <p>总演讲者数: ${this.speakers.length}</p>
                <p>总评委数: ${this.judges.length}</p>
                <p>评分方法: ${this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均�? : '加权平均'}</p>
                <p>生成时间: ${new Date().toLocaleString()}</p>
            </div>
        `;

        container.innerHTML = html;
    }
    // 会话管理和其他功�?
    async saveCurrentSession() {
        if (!this.scoringStarted) {
            alert('评分尚未开始，无需保存');
            return;
        }

        // 显示保存进度
        const progressModal = this.showProgressModal('正在保存评选数�?..');

        try {
            const results = this.calculateFinalScores();
            const sessionData = {
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(), // 确保是字符串格式
                results: results,
                users: this.users,
                speakers: this.speakers,
                judges: this.judges,
                scores: this.scores,
                settings: this.settings,
                scoringMethod: this.scoringMethod
            };

            // 添加班级信息到会话数�?
            if (this.currentClass) {
                sessionData.classInfo = {
                    id: this.currentClass.id,
                    name: this.currentClass.name
                };
            }

            // 云端保存功能已移�?

            // 保存到本地存储的历史记录（按班级分别存储�?
            const sessionsKey = this.currentClassId ? `savedSessions_class_${this.currentClassId}` : 'savedSessions';
            const savedSessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
            savedSessions.push(sessionData);
            localStorage.setItem(sessionsKey, JSON.stringify(savedSessions));

            // 关闭进度模态框
            this.closeProgressModal(progressModal);

            // 显示成功消息
            this.showSuccessModal(`评选已保存成功！\n\n保存位置: 本地存储\n会话ID: ${this.sessionId}\n时间: ${new Date().toLocaleString()}\n\n是否要开始新的评选活动？`, () => {
                this.createNewSession();
            });

        } catch (error) {
            this.closeProgressModal(progressModal);
            alert('保存失败�? + error.message);
        }
    }

    showProgressModal(message) {
        const modal = document.createElement('div');
        modal.className = 'progress-modal';
        modal.innerHTML = `
            <div class="progress-content">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    closeProgressModal(modal) {
        if (modal && modal.parentNode) {
            document.body.removeChild(modal);
        }
    }

    showSuccessModal(message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'success-modal';
        modal.innerHTML = `
            <div class="success-content">
                <div class="success-icon">�?/div>
                <p style="white-space: pre-line;">${message}</p>
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.remove(); (${onConfirm.toString()})()">是的，开始新评�?/button>
                    <button class="btn" onclick="this.parentElement.parentElement.parentElement.remove()">暂时不用</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    discardCurrentSession() {
        if (confirm('确定不保留此次评选吗？所有数据将被清空且无法恢复�?)) {
            // 重置所有数�?
            this.users = [];
            this.speakers = [];
            this.judges = [];
            this.scores = {};
            this.scoringStarted = false;
            this.scoringMethod = 'trimmed';
            this.settings = { maxUsers: 6, maxSpeakers: 2, maxJudges: 4 };
            this.sessionId = this.generateSessionId();

            this.saveToLocalStorage();
            this.updateSessionDisplay();
            this.updateSettingsDisplay();
            this.updateAdminInterface();

            alert('当前评选已清空，可以开始新的评选活�?);
        }
    }

    createNewSession() {
        this.sessionId = this.generateSessionId();
        this.users = [];
        this.speakers = [];
        this.judges = [];
        this.scores = {};
        this.scoringStarted = false;
        this.scoringMethod = 'trimmed';
        this.settings = { maxUsers: 6, maxSpeakers: 2, maxJudges: 4 };

        this.saveToLocalStorage();
        this.updateSessionDisplay();
        this.updateSettingsDisplay();
        this.updateAdminInterface();

        alert(`新会话已创建！会话ID: ${this.sessionId}`);
    }

    async showHistorySection() {
        const progressModal = this.showProgressModal('正在加载历史记录...');

        try {
            // 从本地存储加载（按班级分别加载）
            const sessionsKey = this.currentClassId ? `savedSessions_class_${this.currentClassId}` : 'savedSessions';
            let savedSessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]');

            // 尝试从云端加载历史记�?
            try {
                if (typeof AV !== 'undefined' && window.networkStatus.isOnline) {
                    const query = new AV.Query('SessionData');
                    if (this.currentClassId) {
                        query.equalTo('classId', this.currentClassId);
                    }
                    query.descending('createdAt');
                    query.limit(1000);

                    const cloudRecords = await query.find();
                    const cloudData = cloudRecords.map(record => {
                        const data = record.toJSON();
                        return {
                            id: data.objectId,
                            timestamp: data.createdAt,
                            classId: data.classId,
                            sessionData: data.sessionData,
                            source: 'cloud'
                        };
                    });

                    // 合并云端和本地数据，去重
                    const allRecords = [...cloudData, ...savedSessions];
                    const uniqueRecords = allRecords.reduce((acc, record) => {
                        const key = record.id || record.timestamp;
                        if (!acc.find(r => (r.id || r.timestamp) === key)) {
                            acc.push(record);
                        }
                        return acc;
                    }, []);

                    // 按时间戳排序
                    uniqueRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                    savedSessions = uniqueRecords;

                }
            } catch (error) {
                console.error('从云端加载历史记录失败：', error);
                window.showGlobalToast('云端数据加载失败，使用本地数�?, 'warning');
            }

            this.closeProgressModal(progressModal);

            const classInfo = this.currentClass ? ` - ${this.currentClass.name}` : '';
            if (savedSessions.length === 0) {
                this.showHistoryModal(`暂无历史记录${classInfo}`, []);
                return;
            }

            this.showHistoryModal(`历史评选记�?{classInfo}`, savedSessions);
        } catch (error) {
            this.closeProgressModal(progressModal);
            alert('加载历史记录失败�? + error.message);
        }
    }

    showHistoryModal(title, sessions) {
        const modal = document.createElement('div');
        modal.className = 'history-modal';

        let content = `
            <div class="history-content">
                <div class="history-header">
                    <h3>${title}</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
        `;

        if (sessions.length === 0) {
            content += `
                <div class="no-history">
                    <div class="no-history-icon">📋</div>
                    <p>还没有历史评选记�?/p>
                    <p>完成评选后保存即可在此查看</p>
                </div>
            `;
        } else {
            content += `<div class="history-list">`;

            sessions.forEach((session, index) => {
                const date = new Date(session.timestamp).toLocaleString();
                const results = session.results || [];

                content += `
                    <div class="history-item">
                        <div class="history-item-header">
                            <div class="session-info">
                                <h4>评�?#${index + 1}</h4>
                                <p class="session-date">${date}</p>
                            </div>
                            <div class="session-stats">
                                <span class="stat-badge">👥 ${session.users?.length || 0}�?/span>
                                <span class="stat-badge">🎤 ${session.speakers?.length || 0}位演讲�?/span>
                                <span class="stat-badge">👨‍⚖�?${session.judges?.length || 0}位评�?/span>
                            </div>
                        </div>
                        
                        <div class="session-id">
                            <small>会话ID: ${session.sessionId}</small>
                        </div>
                        
                        ${results.length > 0 ? `
                            <div class="results-preview">
                                <h5>🏆 评选结�?/h5>
                                <div class="results-table-container">
                                    <table class="mini-results-table">
                                        <thead>
                                            <tr>
                                                <th>排名</th>
                                                <th>演讲�?/th>
                                                <th>最终得�?/th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${results.slice(0, 3).map((result, idx) => `
                                                <tr>
                                                    <td>${idx + 1}</td>
                                                    <td>${result.speaker.name}</td>
                                                    <td>${result.finalScore}</td>
                                                </tr>
                                            `).join('')}
                                            ${results.length > 3 ? `<tr><td colspan="3">... 还有 ${results.length - 3} 位演讲�?/td></tr>` : ''}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ` : '<p class="no-results">暂无评分结果</p>'}
                        
                        <div class="history-actions">
                            <button class="btn btn-small" onclick="system.viewSessionDetails('${session.sessionId}')">查看详情</button>
                            <button class="btn btn-small" onclick="system.exportSessionData('${session.sessionId}')">导出数据</button>
                        </div>
                    </div>
                `;
            });

            content += `</div>`;
        }

        content += `
            </div>
        `;

        modal.innerHTML = content;
        document.body.appendChild(modal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    viewSessionDetails(sessionId) {
        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        const session = savedSessions.find(s => s.sessionId === sessionId);

        if (!session) {
            alert('会话数据未找�?);
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'session-detail-modal';

        const date = new Date(session.timestamp).toLocaleString();
        const results = session.results || [];

        let content = `
            <div class="session-detail-content">
                <div class="detail-header">
                    <h3>评选详�?/h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                
                <div class="detail-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <label>会话ID:</label>
                            <span>${session.sessionId}</span>
                        </div>
                        <div class="info-item">
                            <label>评选时�?</label>
                            <span>${date}</span>
                        </div>
                        <div class="info-item">
                            <label>评分方法:</label>
                            <span>${session.scoringMethod === 'trimmed' ? '去掉最高最低分平均�? : '加权平均'}</span>
                        </div>
                    </div>
                </div>

                <div class="participants-section">
                    <div class="participants-grid">
                        <div class="participant-group">
                            <h4>👥 所有参与�?(${session.users?.length || 0}�?</h4>
                            <ul class="participant-list">
                                ${(session.users || []).map(user => `
                                    <li class="participant-item ${user.role}">
                                        <span>${user.name}</span>
                                        <span class="role-badge">${this.getRoleText(user.role)}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                </div>

                ${results.length > 0 ? `
                    <div class="detailed-results">
                        <h4>🏆 完整评选结�?/h4>
                        <table class="detailed-results-table">
                            <thead>
                                <tr>
                                    <th>排名</th>
                                    <th>演讲�?/th>
                                    <th>最终得�?/th>
                                    <th>详细评分</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${results.map((result, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${result.speaker.name}</td>
                                        <td class="final-score">${result.finalScore}</td>
                                        <td class="score-details">${result.scores.join(', ')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="no-results">暂无评分结果</p>'}
            </div>
        `;

        modal.innerHTML = content;
        document.body.appendChild(modal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    exportSessionData(sessionId) {
        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        const session = savedSessions.find(s => s.sessionId === sessionId);

        if (!session) {
            alert('会话数据未找�?);
            return;
        }

        const results = session.results || [];
        let csvContent = "排名,演讲�?最终得�?详细分数,评委数量\n";

        results.forEach((result, index) => {
            const detailScores = result.scores.join(';');
            csvContent += `${index + 1},${result.speaker.name},${result.finalScore},"${detailScores}",${result.scores.length}\n`;
        });

        // 添加统计信息
        csvContent += `\n统计信息\n`;
        csvContent += `会话ID,${session.sessionId}\n`;
        csvContent += `评选时�?${new Date(session.timestamp).toLocaleString()}\n`;
        csvContent += `总演讲者数,${session.speakers?.length || 0}\n`;
        csvContent += `总评委数,${session.judges?.length || 0}\n`;
        csvContent += `评分方法,${session.scoringMethod === 'trimmed' ? '去掉最高最低分求平均�? : '加权平均'}\n`;

        // 下载文件
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `历史评选_${session.sessionId}_${new Date(session.timestamp).toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('历史评选数据已导出�?);
    }

    updateSessionDisplay() {
        const sessionSpan = document.getElementById('currentSessionId');
        if (sessionSpan) {
            sessionSpan.textContent = this.sessionId;
        }
    }

    updateSettingsDisplay() {
        // 更新设置输入框的�?
        const maxUsersInput = document.getElementById('maxUsersInput');
        const maxSpeakersInput = document.getElementById('maxSpeakersInput');
        const maxJudgesInput = document.getElementById('maxJudgesInput');

        if (maxUsersInput) maxUsersInput.value = this.settings.maxUsers;
        if (maxSpeakersInput) maxSpeakersInput.value = this.settings.maxSpeakers;
        if (maxJudgesInput) maxJudgesInput.value = this.settings.maxJudges;

        // 更新显示的限制数�?
        const maxUsersDisplay = document.getElementById('maxUsersDisplay');
        const maxSpeakersDisplay = document.getElementById('maxSpeakersDisplay');
        const maxJudgesDisplay = document.getElementById('maxJudgesDisplay');

        if (maxUsersDisplay) maxUsersDisplay.textContent = this.settings.maxUsers;
        if (maxSpeakersDisplay) maxSpeakersDisplay.textContent = this.settings.maxSpeakers;
        if (maxJudgesDisplay) maxJudgesDisplay.textContent = this.settings.maxJudges;
    }

    updateSettingsFromInputs() {
        const maxUsersInput = document.getElementById('maxUsersInput');
        const maxSpeakersInput = document.getElementById('maxSpeakersInput');
        const maxJudgesInput = document.getElementById('maxJudgesInput');
        const mu = parseInt(maxUsersInput?.value, 10);
        const ms = parseInt(maxSpeakersInput?.value, 10);
        const mj = parseInt(maxJudgesInput?.value, 10);
        if ([mu, ms, mj].some(v => Number.isNaN(v) || v <= 0)) {
            alert('请输入有效的数字（大�?�?);
            return;
        }
        if (ms + mj > mu) {
            const ok = confirm(`演讲�?${ms}) + 评委(${mj}) 总数超过总人数限�?${mu})。\n是否仍然保存？`);
            if (!ok) return;
        }
        this.settings.maxUsers = mu;
        this.settings.maxSpeakers = ms;
        this.settings.maxJudges = mj;
        this.saveToLocalStorage();
        this.updateSettingsDisplay();
        this.updateAdminInterface();
        const msg = [];
        if (this.users.length > mu) msg.push(`当前用户 ${this.users.length} > 总人数限�?${mu}`);
        if (this.speakers.length > ms) msg.push(`当前演讲�?${this.speakers.length} > 限制 ${ms}`);
        if (this.judges.length > mj) msg.push(`当前评委 ${this.judges.length} > 限制 ${mj}`);
        if (msg.length) {
            alert('设置已更新，但存在超限项：\n' + msg.join('\n'));
        } else {
            alert('设置已更�?);
        }
    }

    exportAllHistory() {
        // 按班级导出历史记�?
        const sessionsKey = this.currentClassId ? `savedSessions_class_${this.currentClassId}` : 'savedSessions';
        const savedSessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]');

        const classInfo = this.currentClass ? `_${this.currentClass.name}` : '';
        if (!savedSessions.length) {
            alert(`暂无历史记录可导�?{classInfo ? ` (${this.currentClass.name})` : ''}`);
            return;
        }
        try {
            const fileName = `all_sessions${classInfo}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
            const blob = new Blob([JSON.stringify(savedSessions, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert(`所有历史记录已导出�?JSON 文件${classInfo ? ` (${this.currentClass.name})` : ''}`);
        } catch (e) {
            console.error('导出所有历史记录失败：', e);
            alert('导出失败，请重试');
        }
    }

    saveToLocalStorage() {
        const data = {
            sessionId: this.sessionId,
            users: this.users,
            speakers: this.speakers,
            judges: this.judges,
            scores: this.scores,
            scoringMethod: this.scoringMethod,
            scoringStarted: this.scoringStarted,
            settings: this.settings,
            currentUser: this.currentUser
        };

        // 如果有当前班级，按班级存储数�?
        if (this.currentClassId) {
            const classKey = `speechScoringSystem_class_${this.currentClassId}`;
            localStorage.setItem(classKey, JSON.stringify(data));

        } else {
            // 兼容旧版本，保存到默认位�?
            localStorage.setItem('speechScoringSystem', JSON.stringify(data));

        }

        // 使用增量同步到云�?
        this.syncToCloudIncremental();
    }

    // 增量同步到云端（只同步变更的数据�?
    async syncToCloudIncremental() {
        try {
            if (!window.networkStatus.isOnline) {

                return;
            }

            // 同步用户数据 - 包装在对象中
            await this.saveToCloud('users', { list: this.users });

            // 同步评分数据
            await this.saveToCloud('scores', this.scores);

            // 同步设置
            await this.saveToCloud('settings', this.settings);

            // 同步评分状�?
            await this.saveToCloud('scoringStatus', {
                scoringStarted: this.scoringStarted,
                scoringMethod: this.scoringMethod
            });

        } catch (error) {
            console.error('增量同步失败:', error);
        }
    }

    async loadFromLocalStorage() {
        let saved = null;

        // 如果有当前班级，优先加载班级数据
        if (this.currentClassId) {
            const classKey = `speechScoringSystem_class_${this.currentClassId}`;
            saved = localStorage.getItem(classKey);
            if (saved) {

            }
        }

        // 如果没有班级数据，加载默认数据（兼容旧版本）
        if (!saved) {
            saved = localStorage.getItem('speechScoringSystem');
        }

        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.sessionId = data.sessionId || this.sessionId;
                this.users = data.users || [];
                this.speakers = data.speakers || [];
                this.judges = data.judges || [];
                this.scores = data.scores || {};
                this.scoringMethod = data.scoringMethod || 'trimmed';
                this.scoringStarted = data.scoringStarted || false;
                this.settings = data.settings || { maxUsers: 6, maxSpeakers: 2, maxJudges: 4 };
                this.currentUser = data.currentUser || null;

            } catch (error) {
                console.error('加载本地数据失败:', error);
            }
        }

        // 加载班级数据
        this.loadClassesFromLocalStorage();

        // 恢复最后同步时间戳
        this.restoreLastSyncTimestamp();

        // 从云端加载初始数�?
        if (window.networkStatus.isOnline) {
            await this.loadFromCloud();
        }
    }

    // 导出功能

    exportResults() {
        if (!this.scoringStarted) {
            alert('评分尚未开始，无法导出结果');
            return;
        }

        this.showExportFormatModal('admin');
    }

    showExportFormatModal(userType) {
        const modal = document.createElement('div');
        modal.className = 'export-format-modal';

        const exportFunction = userType === 'admin' ? 'exportAdminDataInFormat' : 'exportJudgeDataInFormat';

        modal.innerHTML = `
            <div class="export-format-content">
                <h3>选择导出格式</h3>
                <p>请选择您希望导出的文件格式�?/p>
                <div class="format-options">
                    <button class="format-btn xlsx-btn" onclick="system.${exportFunction}('xlsx')">
                        <div class="format-icon">📊</div>
                        <div class="format-info">
                            <h4>Excel格式</h4>
                            <p>原生Excel文件，支持格式化</p>
                        </div>
                    </button>
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <button class="btn" onclick="this.parentElement.parentElement.parentElement.remove()">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.currentExportModal = modal;

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    exportAdminDataInFormat(format) {
        const results = this.calculateFinalScores();
        const fileName = `演讲评分结果_${this.sessionId}_${new Date().toISOString().split('T')[0]}`;

        // 关闭导出格式选择模态框
        if (this.currentExportModal) {
            document.body.removeChild(this.currentExportModal);
            this.currentExportModal = null;
        }

        if (format === 'xlsx') {
            this.exportAsExcel(results, fileName, 'admin');
        }
    }

    exportJudgeDataInFormat(format) {
        const judgeName = this.currentUser.name;
        const judgeData = [];

        this.speakers.forEach(speaker => {
            const speakerScores = this.scores[speaker.id] || {};
            const myScore = speakerScores[judgeName];

            let scoreValue = '未评�?;
            let scoreTime = '-';

            if (myScore) {
                if (typeof myScore === 'object' && myScore.total !== undefined) {
                    scoreValue = myScore.total.toFixed(2);
                    scoreTime = myScore.timestamp ? new Date(myScore.timestamp).toLocaleString() : '-';
                } else if (typeof myScore === 'number') {
                    scoreValue = myScore.toFixed(2);
                }
            }

            judgeData.push({
                speaker: speaker.name,
                myScore: scoreValue,
                scoreTime: scoreTime
            });
        });

        const fileName = `评委评分记录_${judgeName}_${this.sessionId}_${new Date().toISOString().split('T')[0]}`;

        // 关闭导出格式选择模态框
        if (this.currentExportModal) {
            document.body.removeChild(this.currentExportModal);
            this.currentExportModal = null;
        }

        if (format === 'xlsx') {
            this.exportJudgeAsExcel(judgeData, fileName, judgeName);
        }
    }

    exportAsCSV(results, fileName, userType) {
        let csvContent = "排名,演讲�?最终得�?总分列表,评委数量\n";

        results.forEach((result, index) => {
            const detailScores = result.scores.join(';');
            csvContent += `${index + 1},${result.speaker.name},${result.finalScore},"${detailScores}",${result.scores.length}\n`;
        });

        // 添加详细评分信息（如果有的话�?
        if (results.length > 0 && results[0].detailedScores && results[0].detailedScores.length > 0) {
            csvContent += `\n详细评分信息\n`;
            csvContent += `演讲�?评委,讲稿内容(40�?,语�?10�?,停顿强调(10�?,流利�?15�?,衣着形象(10�?,肢体语言(15�?,总分\n`;

            results.forEach(result => {
                const speakerScores = this.scores[result.speaker.id] || {};
                this.judges.forEach(judge => {
                    const score = speakerScores[judge.name];
                    if (score && typeof score === 'object') {
                        if (score.language_speed !== undefined) {
                            // 新的细分格式
                            csvContent += `${result.speaker.name},${judge.name},${score.content || 0},${score.language_speed || 0},${score.language_pause || 0},${score.language_fluency || 0},${score.appearance || 0},${score.body || 0},${score.total || 0}\n`;
                        } else {
                            // 旧的语言表达格式
                            csvContent += `${result.speaker.name},${judge.name},${score.content || 0},${score.language || 0}(旧格�?,-,-,${score.appearance || 0},${score.body || 0},${score.total || 0}\n`;
                        }
                    }
                });
            });
        }

        // 添加统计信息
        csvContent += `\n统计信息\n`;
        csvContent += `会话ID,${this.sessionId}\n`;
        csvContent += `总演讲者数,${this.speakers.length}\n`;
        csvContent += `总评委数,${this.judges.length}\n`;
        csvContent += `评分方法,${this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均�? : '加权平均'}\n`;
        csvContent += `评分标准,"讲稿内容(40�? + 语�?10�? + 停顿强调(10�? + 流利�?15�? + 衣着形象(10�? + 肢体语言(15�? = 总分(100�?"\n`;
        csvContent += `生成时间,${new Date().toLocaleString()}\n`;

        // 下载文件
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('结果已导出为CSV文件�?);
    }

    exportAsExcel(results, fileName, userType) {
        // 动态加载SheetJS�?
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => {
                this.generateExcelFile(results, fileName, userType);
            };
            script.onerror = () => {
                alert('Excel处理库加载失败，请使用CSV格式或检查网络连�?);
            };
            document.head.appendChild(script);
        } else {
            this.generateExcelFile(results, fileName, userType);
        }
    }

    generateExcelFile(results, fileName, userType) {
        const wb = XLSX.utils.book_new();

        // 创建结果工作�?
        const wsData = [
            ['排名', '演讲�?, '最终得�?, '总分列表', '评委数量']
        ];

        results.forEach((result, index) => {
            wsData.push([
                index + 1,
                result.speaker.name,
                parseFloat(result.finalScore),
                result.scores.join(';'),
                result.scores.length
            ]);
        });

        // 添加空行和统计信�?
        wsData.push([]);
        wsData.push(['统计信息']);
        wsData.push(['会话ID', this.sessionId]);
        wsData.push(['总演讲者数', this.speakers.length]);
        wsData.push(['总评委数', this.judges.length]);
        wsData.push(['评分方法', this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均�? : '加权平均']);
        wsData.push(['评分标准', '讲稿内容(40�? + 语�?10�? + 停顿强调(10�? + 流利�?15�? + 衣着形象(10�? + 肢体语言(15�? = 总分(100�?']);
        wsData.push(['生成时间', new Date().toLocaleString()]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // 设置列宽
        ws['!cols'] = [
            { wch: 8 },  // 排名
            { wch: 15 }, // 演讲�?
            { wch: 12 }, // 最终得�?
            { wch: 20 }, // 总分列表
            { wch: 12 }  // 评委数量
        ];

        XLSX.utils.book_append_sheet(wb, ws, '评分结果');

        // 创建详细评分工作表（如果有详细评分数据）
        if (results.length > 0 && results[0].detailedScores && results[0].detailedScores.length > 0) {
            const detailData = [
                ['演讲�?, '评委', '讲稿内容(40�?', '语�?10�?', '停顿强调(10�?', '流利�?15�?', '衣着形象(10�?', '肢体语言(15�?', '总分']
            ];

            results.forEach(result => {
                const speakerScores = this.scores[result.speaker.id] || {};
                this.judges.forEach(judge => {
                    const score = speakerScores[judge.name];
                    if (score && typeof score === 'object') {
                        if (score.language_speed !== undefined) {
                            // 新的细分格式
                            detailData.push([
                                result.speaker.name,
                                judge.name,
                                score.content || 0,
                                score.language_speed || 0,
                                score.language_pause || 0,
                                score.language_fluency || 0,
                                score.appearance || 0,
                                score.body || 0,
                                score.total || 0
                            ]);
                        } else {
                            // 旧的语言表达格式
                            detailData.push([
                                result.speaker.name,
                                judge.name,
                                score.content || 0,
                                score.language || 0 + '(旧格�?',
                                '-',
                                '-',
                                score.appearance || 0,
                                score.body || 0,
                                score.total || 0
                            ]);
                        }
                    }
                });
            });

            const detailWs = XLSX.utils.aoa_to_sheet(detailData);

            // 设置详细评分工作表的列宽
            detailWs['!cols'] = [
                { wch: 15 }, // 演讲�?
                { wch: 12 }, // 评委
                { wch: 15 }, // 讲稿内容
                { wch: 12 }, // 语�?
                { wch: 12 }, // 停顿强调
                { wch: 12 }, // 流利�?
                { wch: 15 }, // 衣着形象
                { wch: 15 }, // 肢体语言
                { wch: 10 }  // 总分
            ];

            XLSX.utils.book_append_sheet(wb, detailWs, '详细评分');
        }

        // 下载文件
        XLSX.writeFile(wb, `${fileName}.xlsx`);
        alert('结果已导出为Excel文件�?);
    }

    // 评委专用导出功能
    exportJudgeResults() {
        if (!this.scoringStarted) {
            alert('评分尚未开始，无法导出结果');
            return;
        }

        if (!this.currentUser || this.currentUser.type !== 'judge') {
            alert('只有评委可以导出个人评分记录');
            return;
        }

        this.showExportFormatModal('judge');
    }

    exportJudgeAsCSV(judgeData, fileName, judgeName) {
        let csvContent = "演讲�?我的评分,评分时间\n";

        judgeData.forEach(data => {
            csvContent += `${data.speaker},${data.myScore},${data.scoreTime}\n`;
        });

        // 添加统计信息
        csvContent += `\n个人评分统计\n`;
        csvContent += `评委姓名,${judgeName}\n`;
        csvContent += `会话ID,${this.sessionId}\n`;
        csvContent += `总演讲者数,${this.speakers.length}\n`;
        csvContent += `已评分数�?${judgeData.filter(d => d.myScore !== '未评�?).length}\n`;
        csvContent += `导出时间,${new Date().toLocaleString()}\n`;

        // 下载文件
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('个人评分记录已导出为CSV文件�?);
    }

    exportJudgeAsExcel(judgeData, fileName, judgeName) {
        // 动态加载SheetJS�?
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => {
                this.generateJudgeExcelFile(judgeData, fileName, judgeName);
            };
            script.onerror = () => {
                alert('Excel处理库加载失败，请使用CSV格式或检查网络连�?);
            };
            document.head.appendChild(script);
        } else {
            this.generateJudgeExcelFile(judgeData, fileName, judgeName);
        }
    }

    generateJudgeExcelFile(judgeData, fileName, judgeName) {
        const wb = XLSX.utils.book_new();

        // 创建个人评分工作�?
        const wsData = [
            ['演讲�?, '我的评分', '评分时间']
        ];

        judgeData.forEach(data => {
            wsData.push([
                data.speaker,
                data.myScore === '未评�? ? data.myScore : parseFloat(data.myScore),
                data.scoreTime
            ]);
        });

        // 添加空行和统计信�?
        wsData.push([]);
        wsData.push(['个人评分统计']);
        wsData.push(['评委姓名', judgeName]);
        wsData.push(['会话ID', this.sessionId]);
        wsData.push(['总演讲者数', this.speakers.length]);
        wsData.push(['已评分数�?, judgeData.filter(d => d.myScore !== '未评�?).length]);
        wsData.push(['导出时间', new Date().toLocaleString()]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // 设置列宽
        ws['!cols'] = [
            { wch: 15 }, // 演讲�?
            { wch: 12 }, // 我的评分
            { wch: 20 }  // 评分时间
        ];

        XLSX.utils.book_append_sheet(wb, ws, '个人评分记录');

        // 下载文件
        XLSX.writeFile(wb, `${fileName}.xlsx`);
        alert('个人评分记录已导出为Excel文件�?);
    }

    // 清除数据功能
    clearAllData() {
        const classInfo = this.currentClass ? `当前班级 "${this.currentClass.name}" 的` : '';
        if (confirm(`⚠️ 确定要清�?{classInfo}所有数据吗？\n\n这将删除：\n- 所有用户\n- 所有评分记录\n- 历史记录\n- 当前会话\n\n此操作不可恢复！`)) {
            // 清除当前班级的本地存�?
            if (this.currentClassId) {
                const classKey = `speechScoringSystem_class_${this.currentClassId}`;
                localStorage.removeItem(classKey);
                localStorage.removeItem(`savedSessions_class_${this.currentClassId}`);
            } else {
                // 兼容旧版�?
                localStorage.removeItem('speechScoringSystem');
                localStorage.removeItem('savedSessions');
            }

            // 重置当前会话数据
            this.users = [];
            this.speakers = [];
            this.judges = [];
            this.scores = {};
            this.scoringStarted = false;
            this.sessionId = this.generateSessionId();

            // 更新界面
            this.updateAdminInterface();
            this.updateSessionDisplay();
            this.updateSettingsDisplay();

            alert(`�?${classInfo}所有数据已清除！系统已重置。`);
        }
    }

    clearAllUsers() {
        // 检查是否为固定班级
        if (this.currentClass && this.currentClass.isFixed) {
            alert('固定班级（友�?01、友�?02、友�?03）不能清除用户！\n\n如需清除用户，请先切换到其他班级或创建新班级�?);
            return;
        }

        if (confirm('确定要清除所有用户吗？\n\n这将删除所有用户和他们的角色分配，但保留系统设置�?)) {
            this.users = [];
            this.speakers = [];
            this.judges = [];
            this.scores = {};
            this.scoringStarted = false;

            this.saveToLocalStorage();
            this.updateAdminInterface();

            alert('�?所有用户已清除�?);
        }
    }

    createNewSession() {
        if (confirm('确定要开始新会话吗？\n\n当前会话的数据将被保存到历史记录中�?)) {
            // 如果有数据，先保存当前会�?
            if (this.users.length > 0 || this.scoringStarted) {
                this.saveCurrentSession();
            }

            // 创建新会�?
            this.sessionId = this.generateSessionId();
            this.users = [];
            this.speakers = [];
            this.judges = [];
            this.scores = {};
            this.scoringStarted = false;

            this.saveToLocalStorage();
            this.updateAdminInterface();
            this.updateSessionDisplay();

            alert(`�?新会话已创建！\n会话ID: ${this.sessionId}`);
        }
    }

    // 删除单个用户
    removeUser(userId) {
        // 检查是否为固定班级
        if (this.currentClass && this.currentClass.isFixed) {
            alert('固定班级的用户不能删除！');
            return;
        }

        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        if (confirm(`确定要删除用�?"${user.name}" 吗？`)) {
            // 从用户列表中移除
            this.users = this.users.filter(u => u.id !== userId);

            // 更新角色列表
            this.updateRoleLists();

            // 如果用户有评分记录，也要清除
            if (this.scores[userId]) {
                delete this.scores[userId];
            }

            // 清除该用户作为评委的评分记录
            Object.keys(this.scores).forEach(speakerId => {
                if (this.scores[speakerId][user.name]) {
                    delete this.scores[speakerId][user.name];
                }
            });

            this.saveToLocalStorage();
            this.updateAdminInterface();

            alert(`用户 "${user.name}" 已删除`);
        }
    }

    // 显示/隐藏各个界面板块
    showSection(sectionId) {
        const sections = ['loginSection', 'adminLoginSection', 'userLoginSection', 'adminSection', 'judgeSection', 'speakerSection', 'resultsSection', 'historySection'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.display = (id === sectionId) ? 'block' : 'none';
        });
    }

    // 更新头部用户信息与按钮显�?
    updateUserInfo() {
        const userSpan = document.getElementById('currentUser');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        if (this.currentUser) {
            const roleMap = { admin: '管理�?, judge: '评委', speaker: '演讲�? };
            const roleText = roleMap[this.currentUser.type] || '用户';
            if (userSpan) userSpan.textContent = `${this.currentUser.name}�?{roleText}）`;
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
        } else {
            if (userSpan) userSpan.textContent = '未登�?;
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    }

    // 管理员登录（演示版：只要输入不为空即视为成功�?
    adminLogin(username, password) {
        const u = (username || '').trim();
        const p = (password || '').trim();
        if (!u || !p) {
            alert('请输入管理员账号和密�?);
            return;
        }

        // 验证会话设置（管理员可以创建新会话或加入现有会话�?
        if (!this.validateSessionBeforeLogin()) {
            return;
        }

        this.currentUser = { name: u, type: 'admin' };
        this.updateUserInfo();

        // 启动云端订阅
        this.startCloudSubscription();

        this.showSection('adminSection');

        // 确保班级数据已加�?
        if (this.classes.length === 0) {
            this.loadClassesFromLocalStorage();
        }

        // 刷新界面
        try {
            this.updateClassManagementInterface();

        } catch (e) {
            console.error('更新班级管理界面失败:', e);
        }
        try { this.updateAdminInterface(); } catch (e) { console.error('更新管理员界面失�?', e); }
        try { this.updateSessionDisplay(); } catch (e) { console.error('更新会话显示失败:', e); }
        try { this.updateSettingsDisplay(); } catch (e) { console.error('更新设置显示失败:', e); }
    }

    // 普通用户登录（评委/演讲者）
    async userLogin(name, type) {
        const n = (name || '').trim();
        const t = type === 'judge' ? 'judge' : (type === 'speaker' ? 'speaker' : null);
        if (!n || !t) {
            alert('请输入姓名，并确保登录类型正�?);
            return;
        }

        // 验证会话设置（用户只能加入现有会话）
        if (!this.validateUserSessionBeforeLogin()) {
            return;
        }

        // 设置当前用户
        this.currentUser = { name: n, type: t };
        this.updateUserInfo();

        // 如果是评委登录，需要先同步数据再检查状�?
        if (t === 'judge') {
            // 显示加载提示
            const loadingMessage = '正在同步数据，请稍�?..';
            if (t === 'judge') {
                this.showSection('judgeSection');
                const container = document.getElementById('speakersToScore');
                if (container) {
                    container.innerHTML = `<p style="text-align: center; color: #666;">${loadingMessage}</p>`;
                }
            }

            // 尝试从云端同步最新数�?
            try {
                await this.loadFromCloud();

            } catch (error) {
                console.error('评委登录：从云端加载数据失败', error);
            }

            // 等待一小段时间确保数据完全加载
            await new Promise(resolve => setTimeout(resolve, 500));

            // 现在检查是否已完成评分
            const hasCompletedScoring = this.checkJudgeCompletedScoring(n);
            if (hasCompletedScoring) {
                const confirmReLogin = confirm(
                    `检测到您（${n}）已完成所有演讲者的评分。\n\n` +
                    `为防止重复评分，建议您不要重新登录。\n\n` +
                    `如果确实需要重新登录（例如查看评分结果），请点�?确定"。\n` +
                    `否则请点�?取消"。`
                );

                if (!confirmReLogin) {
                    // 用户选择不重新登录，返回登录页面
                    this.currentUser = null;
                    this.updateUserInfo();
                    this.showSection('loginSection');
                    return;
                }

                // 用户确认重新登录，显示警告信�?
                alert('您已重新登录。请注意：您已完成评分，请勿重复提交评分�?);
            }
        }

        // 启动云端订阅
        this.startCloudSubscription();

        if (t === 'judge') {
            this.showSection('judgeSection');
            try { this.updateJudgeInterface(); } catch (_) { }
        } else {
            this.showSection('speakerSection');
            try { this.updateSpeakerInterface(); } catch (_) { }
        }
    }

    // 检查评委是否已完成所有演讲者的评分
    checkJudgeCompletedScoring(judgeName) {
        // 如果没有演讲者，返回false
        if (!this.speakers || this.speakers.length === 0) {
            return false;
        }

        // 检查该评委是否为所有演讲者都评过�?
        for (const speaker of this.speakers) {
            const speakerScores = this.scores[speaker.id] || {};
            const judgeScore = speakerScores[judgeName];

            // 如果该评委没有为这个演讲者评分，或者评分不完整
            if (!judgeScore || judgeScore.total === undefined) {
                return false;
            }
        }

        return true; // 所有演讲者都已评�?
    }

    // 退出登�?
    logout() {
        this.currentUser = null;
        this.updateUserInfo();
        this.showSection('loginSection');
    }

    // 更新会话显示
    updateSessionDisplay() {
        // 更新所有的会话ID显示元素
        const currentSessionIdElements = document.querySelectorAll('#currentSessionId');
        currentSessionIdElements.forEach(element => {
            element.textContent = this.sessionId || '未设�?;
        });

        // 同时更新用户会话显示
        this.updateUserSessionDisplay();
    }

    // 设置会话ID
    setSessionId(sessionId) {
        if (sessionId && sessionId.trim()) {
            this.sessionId = sessionId.trim();
            this.ensureSidInUrl(this.sessionId);
            this.updateSessionDisplay();
            return true;
        }
        return false;
    }

    // 验证会话ID格式
    validateSessionId(sessionId) {
        if (!sessionId || !sessionId.trim()) {
            return { valid: false, message: '会话ID不能为空' };
        }

        const sid = sessionId.trim();
        if (sid.length < 6) {
            return { valid: false, message: '会话ID长度至少�?�? };
        }

        if (!/^[a-zA-Z0-9]+$/.test(sid)) {
            return { valid: false, message: '会话ID只能包含字母和数�? };
        }

        return { valid: true };
    }

    // 处理会话模式切换
    handleSessionModeChange() {
        const createNewRadio = document.getElementById('createNewSession');
        const joinExistingRadio = document.getElementById('joinExistingSession');
        const sessionIdInput = document.getElementById('sessionIdInput');

        if (joinExistingRadio && joinExistingRadio.checked) {
            sessionIdInput.style.display = 'block';
        } else {
            sessionIdInput.style.display = 'none';
        }
    }

    // 在登录前验证会话设置
    validateSessionBeforeLogin() {
        const joinExistingRadio = document.getElementById('joinExistingSession');
        const sessionIdField = document.getElementById('sessionIdField');

        if (joinExistingRadio && joinExistingRadio.checked) {
            const sessionId = sessionIdField.value.trim();
            const validation = this.validateSessionId(sessionId);

            if (!validation.valid) {
                alert(validation.message);
                return false;
            }

            // 设置会话ID
            this.setSessionId(sessionId);
        } else {
            // 创建新会�?
            this.sessionId = this.generateSessionId();
            this.ensureSidInUrl(this.sessionId);
            this.updateSessionDisplay();
        }

        return true;
    }

    // 用户登录前验证会话设置（只支持加入现有会话）
    validateUserSessionBeforeLogin() {
        const sessionIdInput = document.getElementById('userSessionIdInput');

        if (!sessionIdInput) {
            alert('会话输入框未找到');
            return false;
        }

        const sessionId = sessionIdInput.value.trim();
        const validation = this.validateSessionId(sessionId);

        if (!validation.valid) {
            alert(validation.message);
            return false;
        }

        // 设置会话ID
        this.setSessionId(sessionId);
        this.updateUserSessionDisplay();

        return true;
    }

    // 更新用户会话显示
    updateUserSessionDisplay() {
        const userCurrentSessionId = document.getElementById('userCurrentSessionId');
        if (userCurrentSessionId) {
            userCurrentSessionId.textContent = this.sessionId || '未设�?;
        }
    }

    // 云端订阅相关方法
    // 旧的 LiveQuery 订阅方法已移除，现在使用时间戳增量轮�?
    async startCloudSubscription() {






        // 先尝试从云端加载最新数�?

        try {
            const loaded = await this.loadFromCloud();

        } catch (error) {
            console.error('[云端订阅] 从云端加载数据失�?', error);
        }

        // 启动增量轮询

        this.startIncrementalPolling();



    }

    stopCloudSubscription() {
        // 停止增量轮询

        this.stopIncrementalPolling();
    }

    handleCloudDataUpdate(sessionData) {
        try {
            const data = sessionData.get('sessionData');
            if (!data) return;

            // 检查是否是自己的更新（避免循环更新�?
            if (data.lastUpdateBy === this.currentUser?.name) {
                return;
            }

            // 更新本地数据
            this.users = data.users || [];
            this.speakers = data.speakers || [];
            this.judges = data.judges || [];
            this.scores = data.scores || {};
            this.scoringMethod = data.scoringMethod || this.scoringMethod;
            this.scoringStarted = data.scoringStarted || false;
            this.settings = data.settings || this.settings;

            // 更新界面
            this.updateAllInterfaces();


        } catch (error) {
            console.error('处理云端数据更新失败�?, error);
        }
    }

    updateAllInterfaces() {
        try {
            this.updateSessionDisplay();
            this.updateSettingsDisplay();

            if (this.currentUser?.type === 'admin') {
                this.updateAdminInterface();
            } else if (this.currentUser?.type === 'judge') {
                this.updateJudgeInterface();
            } else if (this.currentUser?.type === 'speaker') {
                this.updateSpeakerInterface();
            }
        } catch (error) {
            console.error('更新界面失败�?, error);
        }
    }
}

// 初始化系�?
let system;
document.addEventListener('DOMContentLoaded', () => {
    try {


        // 全局网络提示函数
        window.showGlobalToast = function (message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;

            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 6px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                max-width: 300px;
                word-wrap: break-word;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
            `;

            switch (type) {
                case 'error':
                    toast.style.backgroundColor = '#f56565';
                    break;
                case 'warning':
                    toast.style.backgroundColor = '#ed8936';
                    break;
                case 'success':
                    toast.style.backgroundColor = '#48bb78';
                    break;
                default:
                    toast.style.backgroundColor = '#4299e1';
            }

            document.body.appendChild(toast);

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, 300);
                }
            }, 3000);
        };

        // LeanCloud 初始化检查（已在 initLeanCloud 方法中初始化，这里只做检查）
        if (typeof AV === 'undefined') {
            console.error('LeanCloud SDK 未加载：AV 未定义。请检�?index.html 中的 SDK 引入顺序和网络连通性�?);
            window.showGlobalToast('LeanCloud SDK 未加载，请检查网络连接后刷新页面', 'error');
        } else {

        }

        system = new SpeechScoringSystem();


        // 启动增量轮询（如果网络在线）
        if (window.networkStatus.isOnline) {
            system.startIncrementalPolling();
        }

        // 监听网络状态变化，自动启动/停止轮询
        window.addEventListener('online', () => {

            system.startIncrementalPolling();
        });

        window.addEventListener('offline', () => {

            system.stopIncrementalPolling();
        });

        // 绑定登录入口按钮
        const adminLoginBtn = document.getElementById('adminLoginBtn');
        const judgeLoginBtn = document.getElementById('judgeLoginBtn');
        const speakerLoginBtn = document.getElementById('speakerLoginBtn');
        if (adminLoginBtn) {
            adminLoginBtn.addEventListener('click', () => {
                system.showSection('adminLoginSection');
            });
        }
        if (judgeLoginBtn) {
            judgeLoginBtn.addEventListener('click', () => {
                const titleEl = document.getElementById('userLoginTitle');
                const typeInput = document.getElementById('userTypeInput');
                if (titleEl) titleEl.textContent = '评委登录';
                if (typeInput) typeInput.value = 'judge';
                system.showSection('userLoginSection');
            });
        }
        if (speakerLoginBtn) {
            speakerLoginBtn.addEventListener('click', () => {
                const titleEl = document.getElementById('userLoginTitle');
                const typeInput = document.getElementById('userTypeInput');
                if (titleEl) titleEl.textContent = '演讲者登�?;
                if (typeInput) typeInput.value = 'speaker';
                system.showSection('userLoginSection');
            });
        }

        // 绑定管理员登录提�?返回
        const adminLoginSubmit = document.getElementById('adminLoginSubmit');
        const adminUsername = document.getElementById('adminUsername');
        const adminPassword = document.getElementById('adminPassword');
        const backToLoginBtn = document.getElementById('backToLoginBtn');
        if (adminLoginSubmit) {
            adminLoginSubmit.addEventListener('click', () => {
                system.adminLogin(adminUsername?.value, adminPassword?.value);
            });
        }
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', () => {
                system.showSection('loginSection');
            });
        }

        // 绑定用户登录提交/返回
        const userLoginSubmit = document.getElementById('userLoginSubmit');
        const userNameInput = document.getElementById('userNameInput');
        const userTypeInput = document.getElementById('userTypeInput');
        const backToLoginBtn2 = document.getElementById('backToLoginBtn2');
        if (userLoginSubmit) {
            userLoginSubmit.addEventListener('click', () => {
                system.userLogin(userNameInput?.value, userTypeInput?.value);
            });
        }
        if (backToLoginBtn2) {
            backToLoginBtn2.addEventListener('click', () => {
                system.showSection('loginSection');
            });
        }

        // 头部登录/退出按�?
        const loginBtnHeader = document.getElementById('loginBtn');
        const logoutBtnHeader = document.getElementById('logoutBtn');
        if (loginBtnHeader) {
            loginBtnHeader.addEventListener('click', () => {
                system.showSection('loginSection');
            });
        }
        if (logoutBtnHeader) {
            logoutBtnHeader.addEventListener('click', () => {
                system.logout();
            });
        }

        // 更新用户信息和会话显�?
        system.updateUserInfo();
        system.updateSessionDisplay();

        // 根据用户登录状态显示相应界�?
        if (system.currentUser) {
            // 用户已登录，显示对应界面
            if (system.currentUser.type === 'admin') {
                system.showSection('adminSection');
                system.updateAdminInterface();
            } else if (system.currentUser.type === 'judge') {
                system.showSection('judgeSection');
                system.updateJudgeInterface();
            } else if (system.currentUser.type === 'speaker') {
                system.showSection('speakerSection');
                system.updateSpeakerInterface();
            }
        } else {
            // 用户未登录，显示登录入口
            system.showSection('loginSection');
        }

        console.log('系统初始化完�? 当前会话ID(sid)=', system.sessionId, ', 当前用户=', system.currentUser);

        // 如果用户已登录，启动云端订阅
        if (system.currentUser) {
            system.startCloudSubscription();
        }

        // 绑定会话管理相关事件
        const sessionModeRadios = document.querySelectorAll('input[name="sessionMode"]');
        sessionModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                system.handleSessionModeChange();
            });
        });

        const sessionIdInput = document.getElementById('sessionIdInput');
        if (sessionIdInput) {
            sessionIdInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value && system.validateSessionId(value)) {
                    system.setSessionId(value);
                }
            });
        }

        // 绑定用户会话管理相关事件
        const userSessionIdInput = document.getElementById('userSessionIdInput');
        if (userSessionIdInput) {
            userSessionIdInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value && system.validateSessionId(value).valid) {
                    system.setSessionId(value);
                    system.updateUserSessionDisplay();
                }
            });
        }

        // 绑定加入会话按钮
        const joinBtn = document.getElementById('joinSessionBtn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                const inputSid = prompt('请输入要加入的会话ID (sid):', system.sessionId || '');
                if (!inputSid) return;
                // 更新当前系统�?sessionId 并写入URL
                system.sessionId = inputSid;
                system.ensureSidInUrl(inputSid);
                system.updateSessionDisplay();
                // 重新启动云端订阅（会话ID已变更）
                if (system.currentUser) {
                    system.startCloudSubscription();
                }
                alert('已加入会话：' + inputSid);
            });
        }

        // 管理员界面按钮绑�?
        const startScoringBtn = document.getElementById('startScoringBtn');
        const viewResultsBtn = document.getElementById('viewResultsBtn');
        const viewHistoryBtn = document.getElementById('viewHistoryBtn');
        const saveSessionBtn = document.getElementById('saveSessionBtn');
        const discardSessionBtn = document.getElementById('discardSessionBtn');
        const clearUsersBtn = document.getElementById('clearUsersBtn');
        const newSessionBtn = document.getElementById('newSessionBtn');
        const newSessionBtn2 = document.getElementById('newSessionBtn2');
        const exportResultsBtn = document.getElementById('exportResultsBtn');
        const judgeExportBtn = document.getElementById('judgeExportBtn');
        const judgeBackBtn = document.getElementById('judgeBackBtn');
        const backToAdminFromHistoryBtn = document.getElementById('backToAdminFromHistoryBtn');
        const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
        const exportAllHistoryBtn = document.getElementById('exportAllHistoryBtn');
        const updateSettingsBtn = document.getElementById('updateSettingsBtn');

        if (startScoringBtn) startScoringBtn.addEventListener('click', () => system.startScoring());
        if (viewResultsBtn) viewResultsBtn.addEventListener('click', () => system.showResults());
        if (viewHistoryBtn) viewHistoryBtn.addEventListener('click', () => system.showHistorySection());
        if (saveSessionBtn) saveSessionBtn.addEventListener('click', () => system.saveCurrentSession());
        if (discardSessionBtn) discardSessionBtn.addEventListener('click', () => system.discardCurrentSession());
        if (clearUsersBtn) clearUsersBtn.addEventListener('click', () => system.clearAllUsers());
        if (newSessionBtn) newSessionBtn.addEventListener('click', () => system.createNewSession());
        if (newSessionBtn2) newSessionBtn2.addEventListener('click', () => system.createNewSession());
        if (exportResultsBtn) exportResultsBtn.addEventListener('click', () => system.exportResults());
        if (judgeExportBtn) judgeExportBtn.addEventListener('click', () => system.exportJudgeResults());
        if (judgeBackBtn) judgeBackBtn.addEventListener('click', () => system.backToLogin());
        if (backToAdminFromHistoryBtn) backToAdminFromHistoryBtn.addEventListener('click', () => system.showSection('adminSection'));
        if (refreshHistoryBtn) refreshHistoryBtn.addEventListener('click', () => system.showHistorySection());
        if (exportAllHistoryBtn) exportAllHistoryBtn.addEventListener('click', () => system.exportAllHistory());
        if (updateSettingsBtn) updateSettingsBtn.addEventListener('click', () => system.updateSettingsFromInputs());

        // 班级管理按钮绑定（只保留切换班级功能�?
        const switchClassBtn = document.getElementById('switchClassBtn');
        const currentClassSelect = document.getElementById('currentClassSelect');

        if (switchClassBtn) switchClassBtn.addEventListener('click', async () => {
            const selectedClassId = currentClassSelect ? currentClassSelect.value : '';
            if (!selectedClassId) {
                alert('请先选择一个班�?);
                return;
            }
            await system.switchToClass(selectedClassId);
        });

        // 角色快速分配与返回管理按钮绑定
        const clearRolesBtn = document.getElementById('clearRolesBtn');
        const randomAssignBtn = document.getElementById('randomAssignBtn');
        const backToAdminBtn = document.getElementById('backToAdminBtn');
        if (clearRolesBtn) clearRolesBtn.addEventListener('click', () => {
            system.clearAllRoles();
            // 云端同步功能已移�?
        });
        if (randomAssignBtn) randomAssignBtn.addEventListener('click', () => {
            system.randomAssignRoles();
            // 云端同步功能已移�?
        });
        if (backToAdminBtn) backToAdminBtn.addEventListener('click', () => system.showSection('adminSection'));

        // 添加用户与批量添加事件绑�?
        const addUserInput = document.getElementById('newUserName');
        const addUserBtn = document.getElementById('addUserBtn');
        const batchAddBtn = document.getElementById('batchAddBtn');

        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                const name = (addUserInput && addUserInput.value ? addUserInput.value : '').trim();
                if (!name) {
                    alert('请输入用户姓�?);
                    return;
                }
                try {
                    system.processBatchAdd([name]);
                    system.updateAdminInterface();
                    if (addUserInput) addUserInput.value = '';
                    // 云端同步功能已移�?
                } catch (e) {
                    console.error('添加用户失败�?, e);
                    alert('添加用户失败，请重试');
                }
            });
        }

        if (batchAddBtn) {
            batchAddBtn.addEventListener('click', () => {
                const text = prompt('请输入多个用户姓名，使用逗号、顿号或换行分隔�?);
                if (!text) return;
                const names = text.split(/[\n,，、]/).map(s => s.trim()).filter(Boolean);
                if (names.length === 0) {
                    alert('未解析到有效姓名');
                    return;
                }
                try {
                    system.processBatchAdd(names);
                    system.updateAdminInterface();
                    // 云端同步功能已移�?
                } catch (e) {
                    console.error('批量添加失败�?, e);
                    alert('批量添加失败，请重试');
                }
            });
        }

        // Excel导入事件绑定
        const importExcelBtn = document.getElementById('importExcelBtn');
        const excelFileInput = document.getElementById('excelFileInput');

        if (importExcelBtn && excelFileInput) {
            importExcelBtn.addEventListener('click', () => {
                excelFileInput.click();
            });

            excelFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // 检查文件类�?
                const validTypes = [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
                    'application/vnd.ms-excel' // .xls
                ];

                if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
                    alert('请选择有效的Excel文件�?xlsx�?xls格式�?);
                    excelFileInput.value = '';
                    return;
                }

                try {
                    // 显示加载提示
                    const loadingMsg = '正在读取Excel文件...';
                    const modal = system.showProgressModal(loadingMsg);

                    // 处理Excel文件
                    const names = await system.processExcelFile(file);

                    // 关闭加载提示
                    system.closeProgressModal(modal);

                    if (names.length === 0) {
                        alert('Excel文件中未找到有效的用户名');
                        return;
                    }

                    // 确认导入
                    const confirmMsg = `从Excel文件中解析到 ${names.length} 个用户名：\n${names.slice(0, 10).join(', ')}${names.length > 10 ? '\n...' : ''}\n\n确定要导入这些用户吗？`;
                    if (!confirm(confirmMsg)) {
                        return;
                    }

                    // 批量添加用户
                    system.processBatchAdd(names);
                    system.updateAdminInterface();

                } catch (error) {
                    console.error('Excel导入失败�?, error);
                    alert('Excel导入失败�? + error.message);
                } finally {
                    // 清空文件输入
                    excelFileInput.value = '';
                }
            });
        }

        // 绑定云端同步控制按钮
        const enableSyncCheckbox = document.getElementById('enableSyncCheckbox');
        const syncFrequencyInput = document.getElementById('syncFrequencyInput');
        const updateSyncFrequencyBtn = document.getElementById('updateSyncFrequencyBtn');

        if (enableSyncCheckbox) {
            enableSyncCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    system.startIncrementalPolling();
                    const statusDisplay = document.getElementById('syncStatusDisplay');
                    if (statusDisplay) statusDisplay.textContent = '已启�?;
                } else {
                    system.stopIncrementalPolling();
                    const statusDisplay = document.getElementById('syncStatusDisplay');
                    if (statusDisplay) statusDisplay.textContent = '已禁�?;
                }
            });
        }

        if (updateSyncFrequencyBtn) {
            updateSyncFrequencyBtn.addEventListener('click', () => {
                const frequency = parseInt(syncFrequencyInput.value, 10);
                if (frequency >= 1 && frequency <= 60) {
                    system.pollingFrequency = frequency * 1000;
                    // 重启轮询以应用新频率
                    if (system.isPolling) {
                        system.stopIncrementalPolling();
                        system.startIncrementalPolling();
                    }
                    alert(`同步频率已更新为 ${frequency} 秒`);
                } else {
                    alert('请输�?-60之间的数�?);
                }
            });
        }

        // 定期更新最后同步时间显�?
        setInterval(() => {
            const lastSyncDisplay = document.getElementById('lastSyncTimeDisplay');
            if (lastSyncDisplay && system.lastSyncTimestamp > 0) {
                const lastSyncDate = new Date(system.lastSyncTimestamp);
                lastSyncDisplay.textContent = lastSyncDate.toLocaleString();
            }
        }, 1000);

        // �?HTML 中的 onclick 能访问到系统实例
        window.system = system;
    } catch (error) {
        console.error('系统初始化失�?', error);
        alert('系统初始化失败，请刷新页面重�?);
    }
});
