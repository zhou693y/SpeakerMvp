// Firebase配置
const firebaseConfig = {
    apiKey: "AIzaSyD076Dqnrvh5dHZb9pqbJ4Dq5DqNlkaZdo",
    authDomain: "speakermvp.firebaseapp.com",
    projectId: "speakermvp",
    storageBucket: "speakermvp.firebasestorage.app",
    messagingSenderId: "716009171047",
    appId: "1:716009171047:web:7cfdcfb0c3d09969030cc2"
};

// Firebase初始化
let db = null;
let firebaseInitialized = false;

// 动态加载Firebase SDK
function initializeFirebase() {
    return new Promise((resolve, reject) => {
        if (firebaseInitialized) {
            resolve();
            return;
        }

        // 加载Firebase SDK
        const script1 = document.createElement('script');
        script1.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
        script1.onload = () => {
            const script2 = document.createElement('script');
            script2.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js';
            script2.onload = () => {
                try {
                    // 初始化Firebase
                    firebase.initializeApp(firebaseConfig);
                    db = firebase.firestore();
                    firebaseInitialized = true;
                    console.log('Firebase初始化成功');
                    resolve();
                } catch (error) {
                    console.error('Firebase初始化失败:', error);
                    reject(error);
                }
            };
            script2.onerror = reject;
            document.head.appendChild(script2);
        };
        script1.onerror = reject;
        document.head.appendChild(script1);
    });
}

class SpeechScoringSystem {
    constructor() {
        this.users = [];
        this.speakers = [];
        this.judges = [];
        this.scores = {};
        this.currentUser = null;
        this.scoringMethod = 'trimmed';
        this.scoringStarted = false;
        this.sessionId = this.generateSessionId();

        // 系统设置
        this.settings = {
            maxUsers: 6,
            maxSpeakers: 2,
            maxJudges: 4
        };

        // 管理员账号配置
        this.adminCredentials = {
            username: '友好102',
            password: '69141024'
        };

        this.init();
        this.initFirebase();
    }

    async initFirebase() {
        try {
            await initializeFirebase();
            this.updateFirebaseStatus('connected');
        } catch (error) {
            console.error('Firebase连接失败:', error);
            this.updateFirebaseStatus('error');
        }
    }

    updateFirebaseStatus(status) {
        let statusElement = document.getElementById('firebaseStatus');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'firebaseStatus';
            statusElement.className = 'db-status';
            document.body.appendChild(statusElement);
        }

        switch (status) {
            case 'connected':
                statusElement.textContent = '🟢 Firebase已连接';
                statusElement.className = 'db-status connected';
                break;
            case 'connecting':
                statusElement.textContent = '🟡 连接中...';
                statusElement.className = 'db-status connecting';
                break;
            case 'error':
                statusElement.textContent = '🔴 Firebase连接失败';
                statusElement.className = 'db-status error';
                break;
        }
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateFirebaseDocId() {
        // 生成类似 QiwFqYTX150MLBqJ7q 的文档ID
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 15; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateSessionDocId() {
        // 生成类似 session2025925 的会话文档ID
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const timestamp = Date.now().toString().slice(-4); // 取时间戳后4位
        return `session${year}${month}${day}_${timestamp}`;
    }

    init() {
        console.log('开始初始化系统...');
        this.initializeEventListeners();
        this.loadFromLocalStorage();
        this.updateSessionDisplay();
        this.updateSettingsDisplay();
        this.checkSharedResults();
        console.log('系统初始化完成');
    }

    checkSharedResults() {
        const urlParams = new URLSearchParams(window.location.search);
        const resultsParam = urlParams.get('results');

        if (resultsParam) {
            try {
                const shareData = JSON.parse(atob(resultsParam));
                this.displaySharedResults(shareData);
            } catch (error) {
                console.error('分享链接解析失败:', error);
                alert('分享链接格式错误');
            }
        }
    }

    displaySharedResults(shareData) {
        const modal = document.createElement('div');
        modal.className = 'shared-results-modal';

        const date = new Date(shareData.timestamp).toLocaleString();

        let content = `
            <div class="shared-results-content">
                <div class="shared-header">
                    <h3>🏆 分享的评选结果</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                
                <div class="shared-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <label>会话ID:</label>
                            <span>${shareData.sessionId}</span>
                        </div>
                        <div class="info-item">
                            <label>评选时间:</label>
                            <span>${date}</span>
                        </div>
                        <div class="info-item">
                            <label>评分方法:</label>
                            <span>${shareData.method === 'trimmed' ? '去掉最高最低分求平均值' : '加权平均'}</span>
                        </div>
                        <div class="info-item">
                            <label>参与情况:</label>
                            <span>${shareData.totalSpeakers}位演讲者，${shareData.totalJudges}位评委</span>
                        </div>
                    </div>
                </div>

                <div class="shared-results">
                    <h4>评选结果排名</h4>
                    <table class="shared-results-table">
                        <thead>
                            <tr>
                                <th>排名</th>
                                <th>演讲者</th>
                                <th>最终得分</th>
                                <th>评委评分</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${shareData.results.map((result, index) => `
                                <tr class="rank-${index + 1}">
                                    <td class="rank-cell">
                                        ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                    </td>
                                    <td class="speaker-name">${result.speaker.name}</td>
                                    <td class="final-score">${result.finalScore}</td>
                                    <td class="score-details">${result.scores.join(', ')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="shared-actions">
                    <button class="btn btn-primary" onclick="system.downloadSharedResults('${shareData.sessionId}')">下载结果</button>
                    <button class="btn" onclick="this.parentElement.parentElement.parentElement.remove()">关闭</button>
                </div>
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

        // 清除URL参数
        const url = new URL(window.location);
        url.searchParams.delete('results');
        window.history.replaceState({}, document.title, url);
    }

    downloadSharedResults(sessionId) {
        const urlParams = new URLSearchParams(window.location.search);
        const resultsParam = urlParams.get('results');

        if (!resultsParam) return;

        try {
            const shareData = JSON.parse(atob(resultsParam));

            let csvContent = "排名,演讲者,最终得分,详细分数,评委数量\n";

            shareData.results.forEach((result, index) => {
                const detailScores = result.scores.join(';');
                csvContent += `${index + 1},${result.speaker.name},${result.finalScore},"${detailScores}",${result.scores.length}\n`;
            });

            // 添加统计信息
            csvContent += `\n统计信息\n`;
            csvContent += `会话ID,${shareData.sessionId}\n`;
            csvContent += `评选时间,${new Date(shareData.timestamp).toLocaleString()}\n`;
            csvContent += `总演讲者数,${shareData.totalSpeakers}\n`;
            csvContent += `总评委数,${shareData.totalJudges}\n`;
            csvContent += `评分方法,${shareData.method === 'trimmed' ? '去掉最高最低分求平均值' : '加权平均'}\n`;

            // 下载文件
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `分享评选结果_${sessionId}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert('分享的评选结果已下载！');
        } catch (error) {
            alert('下载失败：' + error.message);
        }
    }

    // 分享辅助方法
    copyShareUrl(button) {
        const urlInput = button.parentElement.querySelector('.share-url');
        urlInput.select();
        urlInput.setSelectionRange(0, 99999); // 移动端兼容

        try {
            document.execCommand('copy');
            button.textContent = '✅ 已复制';
            button.style.background = '#48bb78';

            setTimeout(() => {
                button.textContent = '📋 复制';
                button.style.background = '';
            }, 2000);
        } catch (err) {
            // 现代浏览器使用Clipboard API
            if (navigator.clipboard) {
                navigator.clipboard.writeText(urlInput.value).then(() => {
                    button.textContent = '✅ 已复制';
                    button.style.background = '#48bb78';

                    setTimeout(() => {
                        button.textContent = '📋 复制';
                        button.style.background = '';
                    }, 2000);
                }).catch(() => {
                    alert('复制失败，请手动复制链接');
                });
            } else {
                alert('复制失败，请手动复制链接');
            }
        }
    }

    shareViaEmail(url) {
        const subject = encodeURIComponent('演讲评分结果分享');
        const body = encodeURIComponent(`您好！\n\n我想与您分享一个演讲评分的结果。请点击以下链接查看：\n\n${decodeURIComponent(url)}\n\n此链接包含完整的评选结果和排名信息。\n\n谢谢！`);
        const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
        window.open(mailtoUrl);
    }

    shareViaQR(url) {
        // 使用在线二维码生成服务
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

        const modal = document.createElement('div');
        modal.className = 'qr-modal';
        modal.innerHTML = `
            <div class="qr-content">
                <div class="qr-header">
                    <h3>📱 二维码分享</h3>
                    <button class="close-btn" onclick="document.body.removeChild(this.parentElement.parentElement.parentElement)">×</button>
                </div>
                <div class="qr-body">
                    <p>扫描二维码查看评选结果：</p>
                    <div class="qr-container">
                        <img src="${qrUrl}" alt="二维码" style="max-width: 200px; border: 1px solid #ddd; padding: 10px; border-radius: 8px;">
                    </div>
                    <p><small>使用微信、支付宝等扫码工具扫描</small></p>
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

    shareViaWeChat(url) {
        // 创建微信分享提示
        const modal = document.createElement('div');
        modal.className = 'wechat-share-modal';
        modal.innerHTML = `
            <div class="wechat-share-content">
                <div class="wechat-header">
                    <h3>💬 微信分享</h3>
                    <button class="close-btn" onclick="document.body.removeChild(this.parentElement.parentElement.parentElement)">×</button>
                </div>
                <div class="wechat-body">
                    <div class="wechat-steps">
                        <h4>分享步骤：</h4>
                        <ol>
                            <li>复制下方链接</li>
                            <li>打开微信</li>
                            <li>发送给好友或群聊</li>
                        </ol>
                    </div>
                    <div class="wechat-url">
                        <input type="text" class="wechat-url-input" value="${decodeURIComponent(url)}" readonly>
                        <button class="copy-btn" onclick="system.copyWeChatUrl(this)">复制链接</button>
                    </div>
                    <p><small>💡 提示：也可以使用上方的二维码分享功能</small></p>
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

    copyWeChatUrl(button) {
        const urlInput = button.parentElement.querySelector('.wechat-url-input');
        urlInput.select();

        try {
            document.execCommand('copy');
            button.textContent = '✅ 已复制';
            button.style.background = '#48bb78';

            setTimeout(() => {
                button.textContent = '复制链接';
                button.style.background = '';
            }, 2000);
        } catch (err) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(urlInput.value).then(() => {
                    button.textContent = '✅ 已复制';
                    button.style.background = '#48bb78';

                    setTimeout(() => {
                        button.textContent = '复制链接';
                        button.style.background = '';
                    }, 2000);
                });
            }
        }
    }

    // 实时同步单个评分到Firebase
    async syncScoreToFirebase(speakerId, score) {
        if (!firebaseInitialized || !db) return;

        try {
            const sessionDocId = this.generateSessionDocId();
            const currentTime = firebase.firestore.Timestamp.now();

            // 找到对应的演讲者和评委
            const speaker = this.speakers.find(s => s.id == speakerId);
            const judge = this.judges.find(j => j.name === this.currentUser.name);

            if (!speaker || !judge) return;

            const sessionRef = db.collection('sessions').doc(sessionDocId);
            const speakerRef = sessionRef.collection('speakers').doc(`speaker_${speakerId}`);

            // 保存评分记录到ratings子集合
            const ratingDocId = `rating_${judge.id}_${speakerId}`;
            await speakerRef.collection('ratings').doc(ratingDocId).set({
                judgeId: `judge_${judge.id}`,
                judgeName: judge.name,
                score: parseFloat(score),
                createdAt: currentTime,
                speakerId: speakerId,
                speakerName: speaker.name
            });

            // 重新计算并更新演讲者的最终得分
            const speakerScores = this.scores[speakerId] || {};
            const scores = Object.values(speakerScores);
            let finalScore = 0;

            if (this.scoringMethod === 'trimmed' && scores.length > 2) {
                const sortedScores = [...scores].sort((a, b) => a - b);
                const trimmedScores = sortedScores.slice(1, -1);
                finalScore = trimmedScores.reduce((sum, s) => sum + s, 0) / trimmedScores.length;
            } else {
                finalScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            }

            // 更新演讲者的最终得分
            await speakerRef.update({
                finalScore: parseFloat(finalScore.toFixed(2)),
                updatedAt: currentTime
            });

            console.log(`评分已实时同步到Firebase: ${judge.name} -> ${speaker.name}: ${score}分`);
        } catch (error) {
            console.error('评分同步失败:', error);
        }
    }

    initializeEventListeners() {
        console.log('开始初始化事件监听器...');

        // 登录选择
        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            console.log('管理员登录按钮被点击');
            this.showSection('adminLoginSection');
        });

        document.getElementById('judgeLoginBtn').addEventListener('click', () => {
            console.log('评委登录按钮被点击');
            document.getElementById('userLoginTitle').textContent = '评委登录';
            document.getElementById('userTypeInput').value = 'judge';
            this.showSection('userLoginSection');
        });

        document.getElementById('speakerLoginBtn').addEventListener('click', () => {
            console.log('演讲者登录按钮被点击');
            document.getElementById('userLoginTitle').textContent = '演讲者登录';
            document.getElementById('userTypeInput').value = 'speaker';
            this.showSection('userLoginSection');
        });

        // 返回按钮
        document.getElementById('backToLoginBtn').addEventListener('click', () => {
            this.showSection('loginSection');
        });

        document.getElementById('backToLoginBtn2').addEventListener('click', () => {
            this.showSection('loginSection');
        });

        // 登录提交
        document.getElementById('adminLoginSubmit').addEventListener('click', () => {
            this.handleAdminLogin();
        });

        document.getElementById('userLoginSubmit').addEventListener('click', () => {
            this.handleUserLogin();
        });

        // 退出登录
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // 管理员功能
        this.setupAdminEventListeners();

        console.log('事件监听器初始化完成');
    }

    setupAdminEventListeners() {
        // 添加用户
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                this.addUser();
            });
        }

        // 系统设置
        const updateSettingsBtn = document.getElementById('updateSettingsBtn');
        if (updateSettingsBtn) {
            updateSettingsBtn.addEventListener('click', () => {
                this.updateSettings();
            });
        }

        // 批量添加
        const batchAddBtn = document.getElementById('batchAddBtn');
        if (batchAddBtn) {
            batchAddBtn.addEventListener('click', () => {
                this.showBatchAddModal();
            });
        }

        // 快速分配
        const autoAssignBtn = document.getElementById('autoAssignBtn');
        if (autoAssignBtn) {
            autoAssignBtn.addEventListener('click', () => {
                this.autoAssignRoles();
            });
        }

        const clearRolesBtn = document.getElementById('clearRolesBtn');
        if (clearRolesBtn) {
            clearRolesBtn.addEventListener('click', () => {
                this.clearAllRoles();
            });
        }

        const randomAssignBtn = document.getElementById('randomAssignBtn');
        if (randomAssignBtn) {
            randomAssignBtn.addEventListener('click', () => {
                this.randomAssignRoles();
            });
        }

        // 评分控制
        const startScoringBtn = document.getElementById('startScoringBtn');
        if (startScoringBtn) {
            startScoringBtn.addEventListener('click', () => {
                this.startScoring();
            });
        }

        const viewResultsBtn = document.getElementById('viewResultsBtn');
        if (viewResultsBtn) {
            viewResultsBtn.addEventListener('click', () => {
                if (this.scoringStarted) {
                    this.showResults();
                } else {
                    alert('评分尚未开始');
                }
            });
        }

        // 历史记录
        const viewHistoryBtn = document.getElementById('viewHistoryBtn');
        if (viewHistoryBtn) {
            viewHistoryBtn.addEventListener('click', () => {
                this.showHistorySection();
            });
        }

        // 评选管理
        const saveSessionBtn = document.getElementById('saveSessionBtn');
        if (saveSessionBtn) {
            saveSessionBtn.addEventListener('click', () => {
                this.saveCurrentSession();
            });
        }

        const discardSessionBtn = document.getElementById('discardSessionBtn');
        if (discardSessionBtn) {
            discardSessionBtn.addEventListener('click', () => {
                this.discardCurrentSession();
            });
        }

        // 返回按钮
        const backToAdminBtn = document.getElementById('backToAdminBtn');
        if (backToAdminBtn) {
            backToAdminBtn.addEventListener('click', () => {
                this.showSection('adminSection');
            });
        }

        // 评分方法选择
        document.querySelectorAll('input[name="scoringMethod"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.scoringMethod = e.target.value;
                this.saveToLocalStorage();
                console.log('评分方法已更改为:', this.scoringMethod);
            });
        });

        // 分享和导出功能
        const shareResultsBtn = document.getElementById('shareResultsBtn');
        if (shareResultsBtn) {
            shareResultsBtn.addEventListener('click', () => {
                this.shareResults();
            });
        }

        const exportResultsBtn = document.getElementById('exportResultsBtn');
        if (exportResultsBtn) {
            exportResultsBtn.addEventListener('click', () => {
                this.exportResults();
            });
        }

        // 清除数据功能
        const clearAllDataBtn = document.getElementById('clearAllDataBtn');
        if (clearAllDataBtn) {
            clearAllDataBtn.addEventListener('click', () => {
                this.clearAllData();
            });
        }

        const clearUsersBtn = document.getElementById('clearUsersBtn');
        if (clearUsersBtn) {
            clearUsersBtn.addEventListener('click', () => {
                this.clearAllUsers();
            });
        }

        const newSessionBtn = document.getElementById('newSessionBtn');
        if (newSessionBtn) {
            newSessionBtn.addEventListener('click', () => {
                this.createNewSession();
            });
        }

        // 评委导出功能
        const judgeExportBtn = document.getElementById('judgeExportBtn');
        if (judgeExportBtn) {
            judgeExportBtn.addEventListener('click', () => {
                this.exportJudgeResults();
            });
        }
    }

    handleAdminLogin() {
        const username = document.getElementById('adminUsername').value.trim();
        const password = document.getElementById('adminPassword').value.trim();

        console.log('尝试管理员登录:', username);

        if (username === this.adminCredentials.username && password === this.adminCredentials.password) {
            this.currentUser = { name: username, type: 'admin' };
            this.updateUserInfo();
            this.showSection('adminSection');
            this.updateAdminInterface();
            this.saveToLocalStorage();
            console.log('管理员登录成功');
        } else {
            alert('管理员账号或密码错误');
        }
    }

    handleUserLogin() {
        const username = document.getElementById('userNameInput').value.trim();
        const userType = document.getElementById('userTypeInput').value;

        console.log('尝试用户登录:', username, userType);

        if (!username) {
            alert('请输入您的姓名');
            return;
        }

        // 验证用户是否存在且角色匹配
        const user = this.users.find(u => u.name === username);
        if (!user) {
            alert('用户不存在，请联系管理员添加');
            return;
        }

        if (userType === 'judge' && user.role !== 'judge') {
            alert('您不是评委，无法以评委身份登录');
            return;
        }

        if (userType === 'speaker' && user.role !== 'speaker') {
            alert('您不是演讲者，无法以演讲者身份登录');
            return;
        }

        this.currentUser = { name: username, type: userType };
        this.updateUserInfo();

        switch (userType) {
            case 'judge':
                this.showSection('judgeSection');
                this.updateJudgeInterface();
                break;
            case 'speaker':
                this.showSection('speakerSection');
                this.updateSpeakerInterface();
                break;
        }

        this.saveToLocalStorage();
        console.log('用户登录成功');
    }

    handleLogout() {
        this.currentUser = null;
        this.updateUserInfo();
        this.showSection('loginSection');
        // 清空登录表单
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
        document.getElementById('userNameInput').value = '';
    }

    updateUserInfo() {
        const userSpan = document.getElementById('currentUser');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (this.currentUser) {
            userSpan.textContent = `${this.currentUser.name} (${this.getUserTypeText(this.currentUser.type)})`;
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
        } else {
            userSpan.textContent = '未登录';
            loginBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'none';
        }
    }

    getUserTypeText(type) {
        const types = {
            'admin': '管理员',
            'judge': '评委',
            'speaker': '演讲者'
        };
        return types[type] || type;
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById(sectionId).style.display = 'block';
    }

    // 管理员功能实现
    async addUser() {
        const nameInput = document.getElementById('newUserName');
        const name = nameInput.value.trim();

        if (!name) {
            alert('请输入用户姓名');
            return;
        }

        if (this.users.length >= this.settings.maxUsers) {
            alert(`用户数量已达上限（${this.settings.maxUsers}人）`);
            return;
        }

        if (this.users.find(user => user.name === name)) {
            alert('用户已存在');
            return;
        }

        const user = {
            id: Date.now(),
            name: name,
            role: 'participant'
        };

        this.users.push(user);
        nameInput.value = '';

        this.saveToLocalStorage();
        this.updateAdminInterface();

        // 实时同步用户数据到Firebase
        this.syncCurrentSessionToFirebase();
    }

    // 实时同步当前会话到Firebase
    async syncCurrentSessionToFirebase() {
        if (!firebaseInitialized || !db) return;

        try {
            const sessionDocId = this.generateSessionDocId();
            const currentTime = firebase.firestore.Timestamp.now();

            // 更新主会话文档
            const sessionData = {
                name: `${new Date().toLocaleDateString()}演讲比赛`,
                createdAt: currentTime,
                updatedAt: currentTime,
                sessionId: this.sessionId,
                scoringMethod: this.scoringMethod,
                totalSpeakers: this.speakers.length,
                totalJudges: this.judges.length,
                status: this.scoringStarted ? 'scoring' : 'preparing'
            };

            const sessionRef = db.collection('sessions').doc(sessionDocId);
            await sessionRef.set(sessionData, { merge: true });

            // 同步judges
            for (const judge of this.judges) {
                const judgeDocId = `judge_${judge.id}`;
                await sessionRef.collection('judges').doc(judgeDocId).set({
                    name: judge.name,
                    role: judge.role,
                    createdAt: currentTime,
                    judgeId: judge.id
                }, { merge: true });
            }

            // 同步speakers（不包含评分数据，因为还在准备阶段）
            for (const speaker of this.speakers) {
                const speakerDocId = `speaker_${speaker.id}`;
                await sessionRef.collection('speakers').doc(speakerDocId).set({
                    name: speaker.name,
                    role: speaker.role,
                    createdAt: currentTime,
                    speakerId: speaker.id,
                    finalScore: 0 // 初始分数为0
                }, { merge: true });
            }

            console.log(`当前会话已实时同步到Firebase: sessions/${sessionDocId}`);
        } catch (error) {
            console.error('实时同步失败:', error);
        }
    }

    updateSettings() {
        const maxUsers = parseInt(document.getElementById('maxUsersInput').value);
        const maxSpeakers = parseInt(document.getElementById('maxSpeakersInput').value);
        const maxJudges = parseInt(document.getElementById('maxJudgesInput').value);

        if (maxUsers < 3 || maxSpeakers < 1 || maxJudges < 1) {
            alert('设置值不能太小！');
            return;
        }

        if (maxSpeakers + maxJudges > maxUsers) {
            alert('演讲者和评委总数不能超过总人数！');
            return;
        }

        this.settings.maxUsers = maxUsers;
        this.settings.maxSpeakers = maxSpeakers;
        this.settings.maxJudges = maxJudges;

        this.updateSettingsDisplay();
        this.saveToLocalStorage();
        alert('设置已更新！');
    }

    showBatchAddModal() {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'batch-modal';
        modal.innerHTML = `
            <div class="batch-content">
                <h3>批量添加用户</h3>
                <div style="margin-bottom: 15px;">
                    <label>方式1：手动输入（支持中英文逗号分隔）</label>
                    <textarea class="batch-textarea" id="batchTextarea" placeholder="请输入用户姓名，用逗号分隔：&#10;例如：张三,李四,王五&#10;或：张三，李四，王五"></textarea>
                </div>
                <div style="margin-bottom: 15px;">
                    <label>方式2：Excel文件导入</label>
                    <input type="file" id="excelFile" accept=".xlsx,.xls,.csv" style="margin-top: 5px;">
                    <p style="font-size: 12px; color: #666; margin-top: 5px;">支持Excel(.xlsx/.xls)和CSV文件，读取第一列作为用户姓名</p>
                </div>
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="system.processBatchAddFromModal()">添加用户</button>
                    <button class="btn" onclick="system.closeBatchModal()">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.currentModal = modal;

        // 点击背景关闭模态框
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeBatchModal();
            }
        });
    }

    closeBatchModal() {
        if (this.currentModal) {
            document.body.removeChild(this.currentModal);
            this.currentModal = null;
        }
    }

    processBatchAddFromModal() {
        const textarea = document.getElementById('batchTextarea');
        const fileInput = document.getElementById('excelFile');

        if (fileInput.files.length > 0) {
            // 处理文件导入
            this.processFileImport(fileInput.files[0]);
        } else if (textarea.value.trim()) {
            // 处理文本输入，支持中英文逗号
            const text = textarea.value.trim();
            const nameList = text.split(/[,，]/).map(name => name.trim()).filter(name => name);
            this.processBatchAdd(nameList);
            this.closeBatchModal();
        } else {
            alert('请输入用户姓名或选择文件');
        }
    }

    processFileImport(file) {
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.csv')) {
            this.processCSVFile(file);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            this.processExcelFile(file);
        } else {
            alert('支持的文件格式：CSV (.csv)、Excel (.xlsx, .xls)');
        }
    }

    processCSVFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const lines = data.split('\n');
                const names = lines.map(line => line.split(',')[0].trim()).filter(name => name && name !== '姓名' && name !== 'name');

                this.processBatchAdd(names);
                this.closeBatchModal();
            } catch (error) {
                alert('CSV文件读取失败，请检查文件格式');
            }
        };
        reader.readAsText(file);
    }

    processExcelFile(file) {
        // 动态加载SheetJS库来处理Excel文件
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => {
                this.readExcelFile(file);
            };
            script.onerror = () => {
                alert('Excel处理库加载失败，请检查网络连接或使用CSV格式');
            };
            document.head.appendChild(script);
        } else {
            this.readExcelFile(file);
        }
    }

    readExcelFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // 读取第一个工作表
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // 转换为JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // 提取第一列的数据作为姓名
                const names = jsonData
                    .map(row => row[0])
                    .filter(name => name && typeof name === 'string' && name.trim() !== '' && name !== '姓名' && name !== 'name')
                    .map(name => String(name).trim());

                if (names.length === 0) {
                    alert('Excel文件中没有找到有效的姓名数据，请确保第一列包含用户姓名');
                    return;
                }

                this.processBatchAdd(names);
                this.closeBatchModal();
            } catch (error) {
                alert('Excel文件读取失败：' + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    processBatchAdd(names) {
        let addedCount = 0;
        let duplicateCount = 0;

        for (const name of names) {
            if (this.users.find(user => user.name === name)) {
                duplicateCount++;
                continue;
            }

            if (this.users.length >= this.settings.maxUsers) {
                alert(`添加后将超过用户上限（${this.settings.maxUsers}人）`);
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

        alert(`成功添加 ${addedCount} 个用户${duplicateCount > 0 ? `，跳过 ${duplicateCount} 个重复用户` : ''}`);
    }

    assignRole(userId, role) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        // 检查数量限制
        if (role === 'speaker') {
            const speakerCount = this.users.filter(u => u.role === 'speaker').length;
            if (speakerCount >= this.settings.maxSpeakers) {
                alert(`演讲者数量已达上限（${this.settings.maxSpeakers}人）`);
                return;
            }
        } else if (role === 'judge') {
            const judgeCount = this.users.filter(u => u.role === 'judge').length;
            if (judgeCount >= this.settings.maxJudges) {
                alert(`评委数量已达上限（${this.settings.maxJudges}人）`);
                return;
            }
        }

        user.role = role;
        this.updateRoleLists();
        this.saveToLocalStorage();
        this.updateAdminInterface();
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
        this.speakers = this.users.filter(u => u.role === 'speaker');
        this.judges = this.users.filter(u => u.role === 'judge');
    }

    autoAssignRoles() {
        const availableUsers = this.users.filter(u => u.role === 'participant');

        if (availableUsers.length < this.settings.maxSpeakers + this.settings.maxJudges) {
            alert('可用用户数量不足以完成自动分配');
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

        alert('自动分配完成！');
    }

    randomAssignRoles() {
        const availableUsers = this.users.filter(u => u.role === 'participant');

        if (availableUsers.length < this.settings.maxSpeakers + this.settings.maxJudges) {
            alert('可用用户数量不足以完成随机分配');
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

        alert('随机分配完成！');
    }

    clearAllRoles() {
        if (confirm('确定要清空所有用户的角色分配吗？')) {
            this.users.forEach(user => {
                user.role = 'participant';
            });

            this.updateRoleLists();
            this.saveToLocalStorage();
            this.updateAdminInterface();

            alert('所有角色已清空！');
        }
    }

    updateAdminInterface() {
        console.log('更新管理员界面');

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

        // 更新可选用户列表
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
                        <button class="btn assign-btn" onclick="system.assignRole(${user.id}, 'speaker')">设为演讲者</button>
                        <button class="btn assign-btn" onclick="system.assignRole(${user.id}, 'judge')">设为评委</button>
                    </div>
                `;
                availableUsersList.appendChild(li);
            });
        }

        // 更新已指派演讲者列表
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

        // 更新已指派评委列表
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
    }

    getRoleText(role) {
        const roles = {
            'participant': '普通用户',
            'speaker': '演讲者',
            'judge': '评委'
        };
        return roles[role] || role;
    }

    // 评分系统
    startScoring() {
        if (this.speakers.length === 0) {
            alert('请先指派演讲者');
            return;
        }

        if (this.judges.length === 0) {
            alert('请先指派评委');
            return;
        }

        this.scoringStarted = true;
        this.initializeScores();
        this.saveToLocalStorage();

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
        console.log('更新评委界面');
        const container = document.getElementById('speakersToScore');

        if (!container) return;

        if (!this.scoringStarted) {
            container.innerHTML = '<p>评分尚未开始，请等待管理员开启评分。</p>';
            return;
        }

        // 检查当前用户是否是评委
        const isJudge = this.judges.find(judge => judge.name === this.currentUser.name);
        if (!isJudge) {
            container.innerHTML = '<p>您不是评委，无法进行评分。</p>';
            return;
        }

        container.innerHTML = '';

        // 添加一键提交按钮和返回按钮
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'submit-all-section';
        controlsDiv.innerHTML = `
            <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4>批量操作</h4>
                <button class="btn btn-primary" onclick="system.submitAllScores()">
                    一键提交所有评分
                </button>
                <button class="btn" onclick="system.backToLogin()">
                    返回登录
                </button>
            </div>
        `;
        container.appendChild(controlsDiv);

        this.speakers.forEach(speaker => {
            const card = document.createElement('div');
            card.className = 'speaker-card';

            const speakerScores = this.scores[speaker.id] || {};
            const currentScore = speakerScores[this.currentUser.name] || '';
            const hasScored = speakerScores[this.currentUser.name] !== undefined;

            card.innerHTML = `
                <h3>${speaker.name}</h3>
                <div class="score-input">
                    <label>评分 (0-100):</label>
                    <input type="number" 
                           min="0" 
                           max="100" 
                           value="${currentScore}"
                           id="score-${speaker.id}"
                           class="judge-score-input"
                           ${hasScored ? 'readonly' : ''}>
                    <button class="btn btn-primary" 
                            onclick="system.submitScore(${speaker.id})"
                            ${hasScored ? 'disabled' : ''}>
                        ${hasScored ? '已评分' : '提交评分'}
                    </button>
                </div>
                ${hasScored ? `<p style="color: green;">您已为此演讲者评分: ${currentScore}分</p>` : ''}
            `;
            container.appendChild(card);
        });

        this.checkAllScoresComplete();
    }

    submitScore(speakerId, score) {
        if (!score) {
            const input = document.getElementById(`score-${speakerId}`);
            score = parseFloat(input.value);
        }

        if (isNaN(score) || score < 0 || score > 100) {
            alert('请输入0-100之间的有效分数');
            return;
        }

        // 确保scores对象存在
        if (!this.scores[speakerId]) {
            this.scores[speakerId] = {};
        }

        this.scores[speakerId][this.currentUser.name] = score;
        this.saveToLocalStorage();
        this.updateJudgeInterface();

        // 实时同步评分到Firebase
        this.syncScoreToFirebase(speakerId, score);

        alert('评分提交成功！');
    }

    submitAllScores() {
        const scoreInputs = document.querySelectorAll('.judge-score-input');
        let allValid = true;
        let submittedCount = 0;
        let errorMessages = [];

        for (const input of scoreInputs) {
            if (input.readOnly) continue; // 跳过已评分的

            const speakerId = input.id.replace('score-', '');
            const score = parseFloat(input.value);

            if (isNaN(score) || score < 0 || score > 100) {
                allValid = false;
                const speakerName = this.speakers.find(s => s.id == speakerId)?.name || '未知';
                errorMessages.push(`${speakerName}: 请输入0-100之间的有效分数`);
                continue;
            }

            // 确保scores对象存在
            if (!this.scores[speakerId]) {
                this.scores[speakerId] = {};
            }

            this.scores[speakerId][this.currentUser.name] = score;
            submittedCount++;
        }

        if (!allValid) {
            alert('以下评分有误，请检查：\n' + errorMessages.join('\n'));
            return;
        }

        if (submittedCount === 0) {
            alert('没有新的评分需要提交');
            return;
        }

        this.saveToLocalStorage();
        this.updateJudgeInterface();

        alert(`成功提交 ${submittedCount} 个评分！`);
    }

    backToLogin() {
        this.currentUser = null;
        this.updateUserInfo();
        this.showSection('loginSection');
    }

    updateSpeakerInterface() {
        console.log('更新演讲者界面');
        const container = document.getElementById('speakerInfo');

        if (!container) return;

        if (!this.scoringStarted) {
            container.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <button class="btn" onclick="system.backToLogin()">返回登录</button>
                </div>
                <p>评分尚未开始，请等待管理员开启评分。</p>
            `;
            return;
        }

        const speaker = this.speakers.find(s => s.name === this.currentUser.name);
        if (!speaker) {
            container.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <button class="btn" onclick="system.backToLogin()">返回登录</button>
                </div>
                <p>您不在演讲者名单中。</p>
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
            <h3>演讲者信息</h3>
            <p><strong>姓名:</strong> ${speaker.name}</p>
            <p><strong>评分进度:</strong> ${scoreCount}/${totalJudges} 位评委已评分</p>
        `;

        if (scoreCount > 0 && scoreCount < totalJudges) {
            html += `
                <p style="color: #666;">已收到 ${scoreCount} 位评委的评分，等待其他评委完成评分...</p>
            `;
        }

        if (scoreCount === totalJudges) {
            const scores = Object.values(speakerScores);
            let finalScore = 0;

            if (this.scoringMethod === 'trimmed' && scores.length > 2) {
                const sortedScores = [...scores].sort((a, b) => a - b);
                const trimmedScores = sortedScores.slice(1, -1);
                finalScore = trimmedScores.reduce((sum, score) => sum + score, 0) / trimmedScores.length;
            } else {
                finalScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            }

            html += `
                <div style="background: #e6fffa; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <h4>最终得分: ${finalScore.toFixed(2)}分</h4>
                    <p>评分方法: ${this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均值' : '加权平均'}</p>
                </div>
            `;
        }

        container.innerHTML = html;
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
            const speakerScores = Object.values(this.scores[speaker.id] || {});
            let finalScore = 0;

            if (this.scoringMethod === 'trimmed' && speakerScores.length > 2) {
                // 去掉最高分和最低分求平均值
                const sortedScores = [...speakerScores].sort((a, b) => a - b);
                const trimmedScores = sortedScores.slice(1, -1);
                finalScore = trimmedScores.reduce((sum, score) => sum + score, 0) / trimmedScores.length;
            } else {
                // 直接求平均值（加权平均，这里权重相等）
                finalScore = speakerScores.reduce((sum, score) => sum + score, 0) / speakerScores.length;
            }

            results.push({
                speaker: speaker,
                scores: speakerScores,
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

        // 根据用户角色显示不同的结果
        if (this.currentUser && this.currentUser.type === 'admin') {
            this.displayAdminResults(results, container);
        } else {
            this.displayPublicResults(results, container);
        }
    }

    displayAdminResults(results, container) {
        let html = `
            <h3>管理员视图 - 详细评分结果 (${this.scoringMethod === 'trimmed' ? '去掉最高最低分平均值' : '加权平均'})</h3>
            <p><strong>会话ID:</strong> ${this.sessionId}</p>
        `;

        results.forEach((result, index) => {
            html += `
                <div style="margin-bottom: 30px; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
                    <h4>${index + 1}. ${result.speaker.name} - 最终得分: ${result.finalScore}分</h4>
                    <table class="results-table">
                        <thead>
                            <tr>
                                <th>评委姓名</th>
                                <th>评分</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            // 显示每个评委的详细评分
            const speakerScores = this.scores[result.speaker.id] || {};
            this.judges.forEach(judge => {
                const score = speakerScores[judge.name];
                html += `
                    <tr>
                        <td>${judge.name}</td>
                        <td>${score !== undefined ? score + '分' : '未评分'}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                    <p><strong>所有分数:</strong> ${result.scores.join(', ')}</p>
                </div>
            `;
        });

        html += `
            <div style="margin-top: 20px; background: #f7fafc; padding: 15px; border-radius: 8px;">
                <p><strong>评分统计:</strong></p>
                <p>总演讲者数: ${this.speakers.length}</p>
                <p>总评委数: ${this.judges.length}</p>
                <p>评分方法: ${this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均值' : '加权平均'}</p>
                <p>生成时间: ${new Date().toLocaleString()}</p>
            </div>
        `;

        container.innerHTML = html;
    }

    displayPublicResults(results, container) {
        let html = `
            <h3>评分结果 (${this.scoringMethod === 'trimmed' ? '去掉最高最低分平均值' : '加权平均'})</h3>
            <table class="results-table">
                <thead>
                    <tr>
                        <th>排名</th>
                        <th>演讲者</th>
                        <th>最终得分</th>
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
                <p>评分方法: ${this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均值' : '加权平均'}</p>
                <p>生成时间: ${new Date().toLocaleString()}</p>
            </div>
        `;

        container.innerHTML = html;
    }
    // 会话管理和其他功能
    async saveCurrentSession() {
        if (!this.scoringStarted) {
            alert('评分尚未开始，无需保存');
            return;
        }

        // 显示保存进度
        const progressModal = this.showProgressModal('正在保存评选数据...');

        try {
            const results = this.calculateFinalScores();
            const sessionData = {
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                results: results,
                users: this.users,
                speakers: this.speakers,
                judges: this.judges,
                scores: this.scores,
                settings: this.settings,
                scoringMethod: this.scoringMethod
            };

            // 保存到本地存储的历史记录
            const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
            savedSessions.push(sessionData);
            localStorage.setItem('savedSessions', JSON.stringify(savedSessions));

            // 同步到Firebase - 按照新的数据库设计图结构
            if (firebaseInitialized && db) {
                try {
                    // 生成会话文档ID
                    const sessionDocId = this.generateSessionDocId();
                    const currentTime = firebase.firestore.Timestamp.now();

                    // 创建主会话文档
                    const sessionData = {
                        name: `${new Date().toLocaleDateString()}演讲比赛`,
                        createdAt: currentTime,
                        updatedAt: currentTime,
                        sessionId: this.sessionId,
                        scoringMethod: this.scoringMethod,
                        totalSpeakers: this.speakers.length,
                        totalJudges: this.judges.length,
                        status: 'completed'
                    };

                    // 保存主会话文档
                    const sessionRef = db.collection('sessions').doc(sessionDocId);
                    await sessionRef.set(sessionData);

                    // 保存judges子集合
                    for (const judge of this.judges) {
                        const judgeDocId = `judge_${judge.id}`;
                        await sessionRef.collection('judges').doc(judgeDocId).set({
                            name: judge.name,
                            role: judge.role,
                            createdAt: currentTime,
                            judgeId: judge.id
                        });
                    }

                    // 保存speakers子集合和评分数据
                    for (const speaker of this.speakers) {
                        const speakerDocId = `speaker_${speaker.id}`;

                        // 计算该演讲者的最终得分
                        const speakerResult = results.find(r => r.speaker.id === speaker.id);
                        const finalScore = speakerResult ? parseFloat(speakerResult.finalScore) : 0;

                        // 保存演讲者基本信息
                        const speakerRef = sessionRef.collection('speakers').doc(speakerDocId);
                        await speakerRef.set({
                            name: speaker.name,
                            role: speaker.role,
                            finalScore: finalScore,
                            createdAt: currentTime,
                            speakerId: speaker.id
                        });

                        // 保存该演讲者的评分记录（ratings子集合）
                        const speakerScores = this.scores[speaker.id] || {};
                        for (const [judgeName, score] of Object.entries(speakerScores)) {
                            // 找到评委ID
                            const judge = this.judges.find(j => j.name === judgeName);
                            if (judge) {
                                const ratingDocId = `rating_${judge.id}_${speaker.id}`;
                                await speakerRef.collection('ratings').doc(ratingDocId).set({
                                    judgeId: `judge_${judge.id}`,
                                    judgeName: judgeName,
                                    score: parseFloat(score),
                                    createdAt: currentTime,
                                    speakerId: speaker.id,
                                    speakerName: speaker.name
                                });
                            }
                        }
                    }

                    console.log(`数据已同步到Firebase: sessions/${sessionDocId}`);
                } catch (firebaseError) {
                    console.error('Firebase同步失败:', firebaseError);
                    // Firebase失败不影响本地保存
                }
            }

            // 关闭进度模态框
            this.closeProgressModal(progressModal);

            // 显示成功消息
            this.showSuccessModal(`评选已保存成功！\n\n会话ID: ${this.sessionId}\n时间: ${new Date().toLocaleString()}\n\n是否要开始新的评选活动？`, () => {
                this.createNewSession();
            });

        } catch (error) {
            this.closeProgressModal(progressModal);
            alert('保存失败：' + error.message);
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
                <div class="success-icon">✅</div>
                <p style="white-space: pre-line;">${message}</p>
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.remove(); (${onConfirm.toString()})()">是的，开始新评选</button>
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
        if (confirm('确定不保留此次评选吗？所有数据将被清空且无法恢复！')) {
            // 重置所有数据
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

            alert('当前评选已清空，可以开始新的评选活动');
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
            // 从本地存储加载
            let savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');

            // 尝试从Firebase同步 - 适应新的数据库结构
            if (firebaseInitialized && db) {
                try {
                    const snapshot = await db.collection('sessions').orderBy('createdAt', 'desc').get();
                    const firebaseSessions = [];

                    for (const doc of snapshot.docs) {
                        const docData = doc.data();

                        // 获取participants数据
                        const participantsSnapshot = await db.collection('test').doc(doc.id).collection('participants').get();
                        let speakers = [];
                        let judges = [];

                        for (const participantDoc of participantsSnapshot.docs) {
                            if (participantDoc.id === 'speakers') {
                                const speakersSnapshot = await participantDoc.ref.collection('list').get();
                                speakers = speakersSnapshot.docs.map(speakerDoc => ({
                                    ...speakerDoc.data(),
                                    docId: speakerDoc.id
                                }));
                            } else if (participantDoc.id === 'judges') {
                                const judgesSnapshot = await participantDoc.ref.collection('list').get();
                                judges = judgesSnapshot.docs.map(judgeDoc => ({
                                    ...judgeDoc.data(),
                                    docId: judgeDoc.id
                                }));
                            }
                        }

                        // 获取results数据
                        const resultsSnapshot = await db.collection('test').doc(doc.id).collection('results').orderBy('rank').get();
                        const results = resultsSnapshot.docs.map(resultDoc => resultDoc.data());

                        // 转换为本地格式
                        const sessionData = {
                            sessionId: docData.sessionId,
                            timestamp: docData.timestamp,
                            scoringMethod: docData.scoringMethod,
                            speakers: speakers,
                            judges: judges,
                            results: results.map(result => ({
                                speaker: { name: result.speakerName, id: result.speakerId },
                                finalScore: result.finalScore,
                                scores: result.scores,
                                method: result.method
                            })),
                            users: [...speakers, ...judges],
                            settings: {
                                maxUsers: speakers.length + judges.length,
                                maxSpeakers: speakers.length,
                                maxJudges: judges.length
                            }
                        };

                        firebaseSessions.push(sessionData);
                    }

                    // 合并本地和云端数据（去重）
                    const allSessions = [...savedSessions];
                    firebaseSessions.forEach(fbSession => {
                        if (!allSessions.find(s => s.sessionId === fbSession.sessionId)) {
                            allSessions.push(fbSession);
                        }
                    });

                    // 按时间排序
                    savedSessions = allSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                    // 更新本地存储
                    localStorage.setItem('savedSessions', JSON.stringify(savedSessions));
                } catch (firebaseError) {
                    console.error('Firebase历史记录加载失败:', firebaseError);
                }
            }

            this.closeProgressModal(progressModal);

            if (savedSessions.length === 0) {
                this.showHistoryModal('暂无历史记录', []);
                return;
            }

            this.showHistoryModal('历史评选记录', savedSessions);
        } catch (error) {
            this.closeProgressModal(progressModal);
            alert('加载历史记录失败：' + error.message);
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
                    <p>还没有历史评选记录</p>
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
                                <h4>评选 #${index + 1}</h4>
                                <p class="session-date">${date}</p>
                            </div>
                            <div class="session-stats">
                                <span class="stat-badge">👥 ${session.users?.length || 0}人</span>
                                <span class="stat-badge">🎤 ${session.speakers?.length || 0}位演讲者</span>
                                <span class="stat-badge">👨‍⚖️ ${session.judges?.length || 0}位评委</span>
                            </div>
                        </div>
                        
                        <div class="session-id">
                            <small>会话ID: ${session.sessionId}</small>
                        </div>
                        
                        ${results.length > 0 ? `
                            <div class="results-preview">
                                <h5>🏆 评选结果</h5>
                                <div class="results-table-container">
                                    <table class="mini-results-table">
                                        <thead>
                                            <tr>
                                                <th>排名</th>
                                                <th>演讲者</th>
                                                <th>最终得分</th>
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
                                            ${results.length > 3 ? `<tr><td colspan="3">... 还有 ${results.length - 3} 位演讲者</td></tr>` : ''}
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
            alert('会话数据未找到');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'session-detail-modal';

        const date = new Date(session.timestamp).toLocaleString();
        const results = session.results || [];

        let content = `
            <div class="session-detail-content">
                <div class="detail-header">
                    <h3>评选详情</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                
                <div class="detail-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <label>会话ID:</label>
                            <span>${session.sessionId}</span>
                        </div>
                        <div class="info-item">
                            <label>评选时间:</label>
                            <span>${date}</span>
                        </div>
                        <div class="info-item">
                            <label>评分方法:</label>
                            <span>${session.scoringMethod === 'trimmed' ? '去掉最高最低分求平均值' : '加权平均'}</span>
                        </div>
                    </div>
                </div>

                <div class="participants-section">
                    <div class="participants-grid">
                        <div class="participant-group">
                            <h4>👥 所有参与者 (${session.users?.length || 0}人)</h4>
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
                        <h4>🏆 完整评选结果</h4>
                        <table class="detailed-results-table">
                            <thead>
                                <tr>
                                    <th>排名</th>
                                    <th>演讲者</th>
                                    <th>最终得分</th>
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
            alert('会话数据未找到');
            return;
        }

        const results = session.results || [];
        let csvContent = "排名,演讲者,最终得分,详细分数,评委数量\n";

        results.forEach((result, index) => {
            const detailScores = result.scores.join(';');
            csvContent += `${index + 1},${result.speaker.name},${result.finalScore},"${detailScores}",${result.scores.length}\n`;
        });

        // 添加统计信息
        csvContent += `\n统计信息\n`;
        csvContent += `会话ID,${session.sessionId}\n`;
        csvContent += `评选时间,${new Date(session.timestamp).toLocaleString()}\n`;
        csvContent += `总演讲者数,${session.speakers?.length || 0}\n`;
        csvContent += `总评委数,${session.judges?.length || 0}\n`;
        csvContent += `评分方法,${session.scoringMethod === 'trimmed' ? '去掉最高最低分求平均值' : '加权平均'}\n`;

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

        alert('历史评选数据已导出！');
    }

    updateSessionDisplay() {
        const sessionSpan = document.getElementById('currentSessionId');
        if (sessionSpan) {
            sessionSpan.textContent = this.sessionId;
        }
    }

    updateSettingsDisplay() {
        // 更新设置输入框的值
        const maxUsersInput = document.getElementById('maxUsersInput');
        const maxSpeakersInput = document.getElementById('maxSpeakersInput');
        const maxJudgesInput = document.getElementById('maxJudgesInput');

        if (maxUsersInput) maxUsersInput.value = this.settings.maxUsers;
        if (maxSpeakersInput) maxSpeakersInput.value = this.settings.maxSpeakers;
        if (maxJudgesInput) maxJudgesInput.value = this.settings.maxJudges;

        // 更新显示的限制数字
        const maxUsersDisplay = document.getElementById('maxUsersDisplay');
        const maxSpeakersDisplay = document.getElementById('maxSpeakersDisplay');
        const maxJudgesDisplay = document.getElementById('maxJudgesDisplay');

        if (maxUsersDisplay) maxUsersDisplay.textContent = this.settings.maxUsers;
        if (maxSpeakersDisplay) maxSpeakersDisplay.textContent = this.settings.maxSpeakers;
        if (maxJudgesDisplay) maxJudgesDisplay.textContent = this.settings.maxJudges;
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
            settings: this.settings
        };
        localStorage.setItem('speechScoringSystem', JSON.stringify(data));
        console.log('数据已保存到本地存储');
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('speechScoringSystem');
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
                console.log('从本地存储加载数据成功');
            } catch (error) {
                console.error('加载本地数据失败:', error);
            }
        }
    }

    // 分享和导出功能
    shareResults() {
        if (!this.scoringStarted) {
            alert('评分尚未开始，无法分享结果');
            return;
        }

        const results = this.calculateFinalScores();
        const shareData = {
            results: results,
            timestamp: new Date().toISOString(),
            method: this.scoringMethod,
            totalSpeakers: this.speakers.length,
            totalJudges: this.judges.length,
            sessionId: this.sessionId
        };

        // 创建分享链接
        const shareUrl = this.createShareUrl(shareData);

        // 显示分享模态框
        this.showShareModal(shareUrl);
    }

    createShareUrl(data) {
        const encodedData = btoa(JSON.stringify(data));
        return `${window.location.origin}${window.location.pathname}?results=${encodedData}`;
    }

    showShareModal(url) {
        const modal = document.createElement('div');
        modal.className = 'share-modal';
        modal.innerHTML = `
            <div class="share-content">
                <div class="share-header">
                    <h3>🔗 分享评分结果</h3>
                    <button class="close-btn" onclick="document.body.removeChild(this.parentElement.parentElement.parentElement)">×</button>
                </div>
                
                <div class="share-body">
                    <p>复制以下链接分享给其他人查看评选结果：</p>
                    <div class="url-container">
                        <input type="text" class="share-url" value="${url}" readonly>
                        <button class="copy-btn" onclick="system.copyShareUrl(this)">📋 复制</button>
                    </div>
                    
                    <div class="share-options">
                        <h4>分享方式</h4>
                        <div class="share-methods">
                            <button class="share-method-btn" onclick="system.shareViaEmail('${encodeURIComponent(url)}')">
                                📧 邮件分享
                            </button>
                            <button class="share-method-btn" onclick="system.shareViaQR('${url}')">
                                📱 二维码分享
                            </button>
                            <button class="share-method-btn" onclick="system.shareViaWeChat('${encodeURIComponent(url)}')">
                                💬 微信分享
                            </button>
                        </div>
                    </div>
                    
                    <div class="share-info">
                        <p><small>💡 提示：接收者打开链接即可查看完整的评选结果和排名</small></p>
                    </div>
                </div>
            </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 点击背景关闭模态框
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

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
        modal.innerHTML = `
            <div class="export-format-content">
                <h3>选择导出格式</h3>
                <p>请选择您希望导出的文件格式：</p>
                <div class="format-options">
                    <button class="format-btn csv-btn" onclick="system.exportData('csv', '${userType}')">
                        <div class="format-icon">📄</div>
                        <div class="format-info">
                            <h4>CSV格式</h4>
                            <p>兼容Excel、Numbers等表格软件</p>
                        </div>
                    </button>
                    <button class="format-btn xlsx-btn" onclick="system.exportData('xlsx', '${userType}')">
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

    exportData(format, userType) {
        // 关闭格式选择模态框
        if (this.currentExportModal) {
            document.body.removeChild(this.currentExportModal);
            this.currentExportModal = null;
        }

        if (userType === 'judge') {
            this.exportJudgeDataInFormat(format);
        } else {
            this.exportAdminDataInFormat(format);
        }
    }

    exportAdminDataInFormat(format) {
        const results = this.calculateFinalScores();
        const fileName = `演讲评分结果_${this.sessionId}_${new Date().toISOString().split('T')[0]}`;

        if (format === 'csv') {
            this.exportAsCSV(results, fileName, 'admin');
        } else if (format === 'xlsx') {
            this.exportAsExcel(results, fileName, 'admin');
        }
    }

    exportAsCSV(results, fileName, userType) {
        let csvContent = "排名,演讲者,最终得分,详细分数,评委数量\n";

        results.forEach((result, index) => {
            const detailScores = result.scores.join(';');
            csvContent += `${index + 1},${result.speaker.name},${result.finalScore},"${detailScores}",${result.scores.length}\n`;
        });

        // 添加统计信息
        csvContent += `\n统计信息\n`;
        csvContent += `会话ID,${this.sessionId}\n`;
        csvContent += `总演讲者数,${this.speakers.length}\n`;
        csvContent += `总评委数,${this.judges.length}\n`;
        csvContent += `评分方法,${this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均值' : '加权平均'}\n`;
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

        alert('结果已导出为CSV文件！');
    }

    exportAsExcel(results, fileName, userType) {
        // 动态加载SheetJS库
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => {
                this.generateExcelFile(results, fileName, userType);
            };
            script.onerror = () => {
                alert('Excel处理库加载失败，请使用CSV格式或检查网络连接');
            };
            document.head.appendChild(script);
        } else {
            this.generateExcelFile(results, fileName, userType);
        }
    }

    generateExcelFile(results, fileName, userType) {
        const wb = XLSX.utils.book_new();

        // 创建结果工作表
        const wsData = [
            ['排名', '演讲者', '最终得分', '详细分数', '评委数量']
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

        // 添加空行和统计信息
        wsData.push([]);
        wsData.push(['统计信息']);
        wsData.push(['会话ID', this.sessionId]);
        wsData.push(['总演讲者数', this.speakers.length]);
        wsData.push(['总评委数', this.judges.length]);
        wsData.push(['评分方法', this.scoringMethod === 'trimmed' ? '去掉最高最低分求平均值' : '加权平均']);
        wsData.push(['生成时间', new Date().toLocaleString()]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // 设置列宽
        ws['!cols'] = [
            { wch: 8 },  // 排名
            { wch: 15 }, // 演讲者
            { wch: 12 }, // 最终得分
            { wch: 20 }, // 详细分数
            { wch: 12 }  // 评委数量
        ];

        XLSX.utils.book_append_sheet(wb, ws, '评分结果');

        // 下载文件
        XLSX.writeFile(wb, `${fileName}.xlsx`);
        alert('结果已导出为Excel文件！');
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

    exportJudgeDataInFormat(format) {
        const judgeName = this.currentUser.name;
        const fileName = `评委${judgeName}_评分记录_${this.sessionId}_${new Date().toISOString().split('T')[0]}`;

        // 准备评委个人数据
        const judgeData = [];
        this.speakers.forEach(speaker => {
            const speakerScores = this.scores[speaker.id] || {};
            const myScore = speakerScores[judgeName];

            judgeData.push({
                speaker: speaker.name,
                myScore: myScore !== undefined ? myScore : '未评分',
                scoreTime: myScore !== undefined ? new Date().toLocaleString() : ''
            });
        });

        if (format === 'csv') {
            this.exportJudgeAsCSV(judgeData, fileName, judgeName);
        } else if (format === 'xlsx') {
            this.exportJudgeAsExcel(judgeData, fileName, judgeName);
        }
    }

    exportJudgeAsCSV(judgeData, fileName, judgeName) {
        let csvContent = "演讲者,我的评分,评分时间\n";

        judgeData.forEach(data => {
            csvContent += `${data.speaker},${data.myScore},${data.scoreTime}\n`;
        });

        // 添加统计信息
        csvContent += `\n个人评分统计\n`;
        csvContent += `评委姓名,${judgeName}\n`;
        csvContent += `会话ID,${this.sessionId}\n`;
        csvContent += `总演讲者数,${this.speakers.length}\n`;
        csvContent += `已评分数量,${judgeData.filter(d => d.myScore !== '未评分').length}\n`;
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

        alert('个人评分记录已导出为CSV文件！');
    }

    exportJudgeAsExcel(judgeData, fileName, judgeName) {
        // 动态加载SheetJS库
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => {
                this.generateJudgeExcelFile(judgeData, fileName, judgeName);
            };
            script.onerror = () => {
                alert('Excel处理库加载失败，请使用CSV格式或检查网络连接');
            };
            document.head.appendChild(script);
        } else {
            this.generateJudgeExcelFile(judgeData, fileName, judgeName);
        }
    }

    generateJudgeExcelFile(judgeData, fileName, judgeName) {
        const wb = XLSX.utils.book_new();

        // 创建个人评分工作表
        const wsData = [
            ['演讲者', '我的评分', '评分时间']
        ];

        judgeData.forEach(data => {
            wsData.push([
                data.speaker,
                data.myScore === '未评分' ? data.myScore : parseFloat(data.myScore),
                data.scoreTime
            ]);
        });

        // 添加空行和统计信息
        wsData.push([]);
        wsData.push(['个人评分统计']);
        wsData.push(['评委姓名', judgeName]);
        wsData.push(['会话ID', this.sessionId]);
        wsData.push(['总演讲者数', this.speakers.length]);
        wsData.push(['已评分数量', judgeData.filter(d => d.myScore !== '未评分').length]);
        wsData.push(['导出时间', new Date().toLocaleString()]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // 设置列宽
        ws['!cols'] = [
            { wch: 15 }, // 演讲者
            { wch: 12 }, // 我的评分
            { wch: 20 }  // 评分时间
        ];

        XLSX.utils.book_append_sheet(wb, ws, '个人评分记录');

        // 下载文件
        XLSX.writeFile(wb, `${fileName}.xlsx`);
        alert('个人评分记录已导出为Excel文件！');
    }

    // 清除数据功能
    clearAllData() {
        if (confirm('⚠️ 确定要清除所有数据吗？\n\n这将删除：\n- 所有用户\n- 所有评分记录\n- 历史记录\n- 当前会话\n\n此操作不可恢复！')) {
            // 清除本地存储
            localStorage.removeItem('speechScoringSystem');
            localStorage.removeItem('savedSessions');

            // 重置所有数据
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

            alert('✅ 所有数据已清除！系统已重置。');
        }
    }

    clearAllUsers() {
        if (confirm('确定要清除所有用户吗？\n\n这将删除所有用户和他们的角色分配，但保留系统设置。')) {
            this.users = [];
            this.speakers = [];
            this.judges = [];
            this.scores = {};
            this.scoringStarted = false;

            this.saveToLocalStorage();
            this.updateAdminInterface();

            alert('✅ 所有用户已清除！');
        }
    }

    createNewSession() {
        if (confirm('确定要开始新会话吗？\n\n当前会话的数据将被保存到历史记录中。')) {
            // 如果有数据，先保存当前会话
            if (this.users.length > 0 || this.scoringStarted) {
                this.saveCurrentSession();
            }

            // 创建新会话
            this.sessionId = this.generateSessionId();
            this.users = [];
            this.speakers = [];
            this.judges = [];
            this.scores = {};
            this.scoringStarted = false;

            this.saveToLocalStorage();
            this.updateAdminInterface();
            this.updateSessionDisplay();

            alert(`✅ 新会话已创建！\n会话ID: ${this.sessionId}`);
        }
    }

    // 删除单个用户
    removeUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        if (confirm(`确定要删除用户 "${user.name}" 吗？`)) {
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
}

// 初始化系统
let system;
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('开始初始化演讲评分系统...');
        system = new SpeechScoringSystem();
        console.log('系统初始化完成');
    } catch (error) {
        console.error('系统初始化失败:', error);
        alert('系统初始化失败，请刷新页面重试');
    }
});

// 全局函数，供HTML调用
window.system = system;