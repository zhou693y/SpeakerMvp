// 手机端优化辅助脚本
class MobileOptimizer {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.init();
    }

    init() {
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
            this.optimizeDisplay();
        });
        this.optimizeDisplay();
    }

    optimizeDisplay() {
        if (this.isMobile) {
            this.optimizeTables();
            this.optimizeButtons();
        }
    }

    optimizeTables() {
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            if (!table.closest('.table-scroll-container')) {
                this.wrapTableWithScroll(table);
            }
        });
    }

    wrapTableWithScroll(table) {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-scroll-container';

        const hint = document.createElement('div');
        hint.className = 'scroll-hint';
        hint.textContent = '← 左右滑动查看更多内容 →';

        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
        wrapper.appendChild(hint);
    }

    optimizeButtons() {
        const buttonGroups = document.querySelectorAll('.results-controls, .scoring-buttons');
        buttonGroups.forEach(group => {
            if (!group.classList.contains('mobile-optimized')) {
                group.classList.add('mobile-optimized');
            }
        });
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    window.mobileOptimizer = new MobileOptimizer();
});

// 监听动态内容变化
const observer = new MutationObserver(() => {
    setTimeout(() => {
        if (window.mobileOptimizer) {
            window.mobileOptimizer.optimizeDisplay();
        }
    }, 100);
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
