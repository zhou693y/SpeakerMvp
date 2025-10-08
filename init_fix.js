/**
 * 初始化修复 - 静默模式，无自检
 */

(function () {
    // 静默初始化 LeanCloud
    if (window.AV && window.LC_CONFIG) {
        try {
            AV.init({
                appId: window.LC_CONFIG.appId,
                appKey: window.LC_CONFIG.appKey,
                serverURL: window.LC_CONFIG.serverURL
            });
            AV.debug(false);
            console.log('LeanCloud 初始化完成（轮询模式）');
        } catch (e) {
            console.warn('LeanCloud 初始化失败，使用本地模式');
        }
    }

    // 固定班级预检
    if (window.FIXED_CLASS_STUDENTS) {
        console.log('固定班级数据已加载');
    }
})();
