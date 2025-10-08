/**
 * 系统集成脚本
 * 将轮询同步功能集成到主系统中
 */

// 等待系统初始化完成后执行
window.addEventListener('DOMContentLoaded', function () {
    console.log('开始集成云端轮询功能...');

    // 等待 system 对象创建
    const checkSystem = setInterval(function () {
        if (window.system && window.cloudPolling) {
            clearInterval(checkSystem);
            integrateCloudPolling();
        }
    }, 100);
});

function integrateCloudPolling() {
    const system = window.system;
    const cloudPolling = window.cloudPolling;

    // 保存原始方法
    const originalSaveClassesToLocalStorage = system.saveClassesToLocalStorage;
    const originalSwitchToClass = system.switchToClass;
    const originalStartScoring = system.startScoring;
    const originalAssignRole = system.assignRole;
    const originalAddUser = system.addUser;

    // 设置数据更新回调
    cloudPolling.setUpdateCallback(function (cloudData) {
        // 更新系统数据
        system.users = cloudData.users;
        system.speakers = cloudData.speakers;
        system.judges = cloudData.judges;
        system.scores = cloudData.scores;
        system.scoringStarted = cloudData.scoringStarted;
        system.scoringMethod = cloudData.scoringMethod;

        if (cloudData.settings) {
            system.settings = cloudData.settings;
        }

        // 更新界面
        if (system.currentUser) {
            if (system.currentUser.role === 'admin') {
                system.updateAdminInterface();
            } else if (system.currentUser.role === 'judge') {
                system.updateJudgeInterface();
            } else if (system.currentUser.role === 'speaker') {
                system.updateSpeakerInterface();
            }
        }

        // 同步到本地存储
        const data = {
            sessionId: system.sessionId,
            users: system.users,
            speakers: system.speakers,
            judges: system.judges,
            scores: system.scores,
            scoringMethod: system.scoringMethod,
            scoringStarted: system.scoringStarted,
            settings: system.settings
        };

        const key = system.currentClassId ?
            `speechScoringSystem_class_${system.currentClassId}` :
            'speechScoringSystem';
        localStorage.setItem(key, JSON.stringify(data));
    });

    // 增强 saveClassesToLocalStorage 方法
    system.saveClassesToLocalStorage = function () {
        // 调用原始方法
        if (originalSaveClassesToLocalStorage) {
            originalSaveClassesToLocalStorage.call(this);
        } else {
            // 如果原方法不存在，直接保存
            localStorage.setItem('speechScoring_classes', JSON.stringify(this.classes));
            if (this.currentClass) {
                localStorage.setItem('speechScoring_currentClass', JSON.stringify(this.currentClass));
            } else {
                localStorage.removeItem('speechScoring_currentClass');
            }
        }

        // 同步到云端
        cloudPolling.saveClassesToCloud(this.classes, this.currentClass);
    };

    // 增强 switchToClass 方法
    const originalSwitchMethod = system.switchToClass;
    system.switchToClass = async function (classId) {
        // 停止当前轮询
        cloudPolling.stopPolling();

        // 调用原始方法
        await originalSwitchMethod.call(this, classId);

        // 设置新的会话信息并启动轮询
        if (classId && this.sessionId) {
            cloudPolling.setSession(this.sessionId, classId);
            cloudPolling.startPolling();
        }
    };

    // 增强数据保存方法
    system.saveDataToCloud = function () {
        const data = {
            users: this.users,
            speakers: this.speakers,
            judges: this.judges,
            scores: this.scores,
            scoringStarted: this.scoringStarted,
            scoringMethod: this.scoringMethod,
            settings: this.settings
        };

        cloudPolling.saveToCloud(data);
    };

    // 拦截关键操作，自动保存到云端
    const autoSaveOperations = [
        'addUser',
        'removeUser',
        'assignRole',
        'removeRole',
        'startScoring',
        'submitScore',
        'processBatchAdd'
    ];

    autoSaveOperations.forEach(function (methodName) {
        const originalMethod = system[methodName];
        if (originalMethod) {
            system[methodName] = function () {
                const result = originalMethod.apply(this, arguments);

                // 操作完成后自动保存到云端
                setTimeout(() => {
                    this.saveDataToCloud();
                }, 500);

                return result;
            };
        }
    });

    // 监听用户登录，启动轮询
    const originalShowSection = system.showSection;
    if (originalShowSection) {
        system.showSection = function (sectionId) {
            originalShowSection.call(this, sectionId);

            // 如果是管理员、评委或演讲者界面，启动轮询
            if (['adminSection', 'judgeSection', 'speakerSection'].includes(sectionId)) {
                if (this.sessionId && this.currentClassId) {
                    cloudPolling.setSession(this.sessionId, this.currentClassId);
                    cloudPolling.startPolling();
                }
            }
        };
    }

    // 页面卸载时停止轮询
    window.addEventListener('beforeunload', function () {
        cloudPolling.stopPolling();
    });

    console.log('✓ 云端轮询功能集成完成');
    console.log('- 数据将每3秒自动同步');
    console.log('- 所有操作将自动保存到云端');
}
