/**
 * 系统配置
 */

window.SYSTEM_CONFIG = {
    // 禁用 LeanCloud 自检
    disableLeanCloudHealthCheck: true,

    // 禁用实时订阅
    disableRealtimeSubscription: true,

    // 启用轮询
    enablePolling: true,
    pollingInterval: 3000, // 3秒

    // 快速加载固定班级
    fastLoadFixedClasses: true,

    // 静默模式（减少控制台输出）
    silentMode: false,

    // 仅本地模式（不连接云端）
    localOnlyMode: false
};

console.log('系统配置已加载');
