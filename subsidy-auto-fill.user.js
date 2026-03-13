// ==UserScript==
// @name         外网平台补贴信息填充
// @author       LCJ
// @match        https://*.pos-admin.vip.vip.com/*
// @grant        none
// @version      1.0.1
// @description  补贴信息自动填充（修复版）
// ==/UserScript==

(function() {
    'use strict';

    // ====================== 【用户可自定义区域】 ======================
    const DEFAULT_CONFIG = {
        presetItems: [
            { key: "促销或券类型 官方立减XX元/%", type: "促销或券类型", ratio: "0.5", desc: "官方立减XX元/%" },
            { key: "促销或券类型 超级立减XX元/%", type: "促销或券类型", ratio: "0.5", desc: "超级立减XX元/%" },
            { key: "促销或券类型 立减优惠XX元/%", type: "促销或券类型", ratio: "0.5", desc: "立减优惠XX元/%" },
            { key: "百亿补贴/单品补贴 补贴x元", type: "百亿补贴/单品补贴", ratio: "1.0", desc: "补贴x元" }
        ]
    };
    const CUSTOM_DAY_CACHE_KEY = 'promotionFillCustomDay';
    // =================================================================

    let appConfig = { ...DEFAULT_CONFIG };

    // 缓存操作
    function loadConfig() {
        try {
            const saved = localStorage.getItem('promotionFillConfig');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.presetItems)) {
                    appConfig = { ...DEFAULT_CONFIG, ...parsed };
                }
            }
        } catch (e) {
            appConfig = { ...DEFAULT_CONFIG };
        }
    }

    function saveConfig() {
        try {
            localStorage.setItem('promotionFillConfig', JSON.stringify(appConfig));
        } catch (e) {}
    }

    function getSavedCustomDay() {
        try {
            const saved = localStorage.getItem(CUSTOM_DAY_CACHE_KEY);
            const num = parseInt(saved);
            return !isNaN(num) && num >= 1 ? num : '';
        } catch (e) {
            return '';
        }
    }

    function saveCustomDay(days) {
        try {
            const num = parseInt(days);
            if (!isNaN(num) && num >= 1) {
                localStorage.setItem(CUSTOM_DAY_CACHE_KEY, num.toString());
            }
        } catch (e) {}
    }

    // 等待元素
    function waitForSelector(selector, timeout = 8000, interval = 100) {
        return new Promise((resolve, reject) => {
            let elapsed = 0;
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    resolve(el);
                }
                elapsed += interval;
                if (elapsed >= timeout) {
                    clearInterval(timer);
                    reject(new Error(`元素【${selector}】超时未找到`));
                }
            }, interval);
        });
    }

    // 日期补零
    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    // 获取当前日期
    function getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = padZero(now.getMonth() + 1);
        const day = padZero(now.getDate());
        return `${year}-${month}-${day}`;
    }

    // 获取N天后日期
    function getDateAfterDays(days) {
        const now = new Date();
        now.setDate(now.getDate() + days);
        const year = now.getFullYear();
        const month = padZero(now.getMonth() + 1);
        const day = padZero(now.getDate());
        return `${year}-${month}-${day}`;
    }

    // ====================== 核心修复：日期填充（你给的定位） ======================
    async function fillDate(startDate, endDate) {
        try {
            const startDateInput = await waitForSelector('input.el-range-input:nth-child(2)');
            const endDateInput = await waitForSelector('input.el-range-input:nth-child(4)');

            function trigger(el, val) {
                el.focus();
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.blur();
            }

            trigger(startDateInput, startDate);
            trigger(endDateInput, endDate);

        } catch (e) {
            console.error('日期填充失败', e);
        }
    }

    // 创建功能栏
    function createFunctionBar() {
        const barContainer = document.createElement('div');
        barContainer.id = 'promotion-fill-bar';
        barContainer.style.cssText = `
            display: flex;align-items: center;gap: 10px;margin-bottom: 10px;padding: 10px;
            background: #f8f9fa;border-radius: 6px;border: 1px solid #e9ecef;
            width: 100%;box-sizing: border-box;flex-wrap: wrap;
            position: relative;z-index: 999;
        `;

        const leftFuncWrapper = document.createElement('div');
        leftFuncWrapper.style.cssText = `
            display: flex;align-items: center;gap: 10px;flex: 1;min-width: 280px;
        `;

        const selectWrapper = document.createElement('div');
        selectWrapper.style.cssText = `position: relative;max-width: 260px;width: 100%;`;

        const searchInput = document.createElement('input');
        searchInput.placeholder = '输入关键词搜索';
        searchInput.style.cssText = `
            width: 100%;padding: 8px 12px;border: 1px solid #e9ecef;
            border-radius: 4px;outline: none;font-size: 14px;box-sizing: border-box;
        `;

        const dropdownPanel = document.createElement('div');
        dropdownPanel.style.cssText = `
            position: absolute;top: calc(100% + 5px);left: 0;right: 0;max-height: 200px;overflow-y: auto;
            background: #fff;border: 1px solid #e9ecef;border-radius: 4px;box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 9999;display: none;width: 100%;box-sizing: border-box;
        `;

        const clearBtn = document.createElement('button');
        clearBtn.textContent = '清空';
        clearBtn.style.cssText = `
            padding: 8px 12px;border: 1px solid #e5e6eb;border-radius: 6px;
            background: #f5f5f5;cursor: pointer;font-size: 14px;
        `;

        const settingBtn = document.createElement('button');
        settingBtn.textContent = '设置';
        settingBtn.style.cssText = `
            padding: 8px 12px;border: none;border-radius: 6px;
            background: #52c41a;color: #fff;cursor: pointer;font-size: 14px;
        `;

        // 日期按钮区域
        const dateBtnWrapper = document.createElement('div');
        dateBtnWrapper.style.cssText = `
            display: flex;align-items: center;gap: 8px;margin-left: auto;flex-wrap: wrap;
        `;

        const btnStyle = `
            padding: 8px 16px;border: none;border-radius: 6px;
            background: #4096ff;color: #fff;cursor: pointer;font-size: 14px;
        `;

        function createDateBtn(text, days) {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = btnStyle;
            btn.addEventListener('click', () => {
                const today = getCurrentDate();
                const end = getDateAfterDays(days);
                fillDate(today, end);
            });
            return btn;
        }

        dateBtnWrapper.appendChild(createDateBtn('1天', 1));
        dateBtnWrapper.appendChild(createDateBtn('3天', 3));
        dateBtnWrapper.appendChild(createDateBtn('7天', 7));
        dateBtnWrapper.appendChild(createDateBtn('15天', 15));

        const customDayInput = document.createElement('input');
        customDayInput.style.cssText = `
            width: 60px;padding: 8px 12px;border: 1px solid #e9ecef;
            border-radius: 6px;outline: none;font-size: 14px;text-align: center;
        `;
        customDayInput.placeholder = '天数';
        customDayInput.type = 'number';
        customDayInput.min = 1;
        const savedDay = getSavedCustomDay();
        if (savedDay) customDayInput.value = savedDay;

        const customDayBtn = document.createElement('button');
        customDayBtn.textContent = '天';
        customDayBtn.style.cssText = btnStyle;
        customDayBtn.addEventListener('click', () => {
            const days = parseInt(customDayInput.value.trim());
            if (isNaN(days) || days < 1) return;
            const today = getCurrentDate();
            const end = getDateAfterDays(days);
            fillDate(today, end);
            saveCustomDay(days);
        });

        dateBtnWrapper.appendChild(customDayInput);
        dateBtnWrapper.appendChild(customDayBtn);

        selectWrapper.appendChild(searchInput);
        selectWrapper.appendChild(dropdownPanel);
        leftFuncWrapper.appendChild(selectWrapper);
        leftFuncWrapper.appendChild(clearBtn);
        leftFuncWrapper.appendChild(settingBtn);
        barContainer.appendChild(leftFuncWrapper);
        barContainer.appendChild(dateBtnWrapper);

        // 渲染下拉
        function renderDropdown(filterText = '') {
            dropdownPanel.innerHTML = '';
            const filterVal = filterText.toLowerCase().trim();
            const filtered = appConfig.presetItems.filter(item =>
                item.key.toLowerCase().includes(filterVal)
            );

            filtered.forEach(item => {
                const option = document.createElement('div');
                option.style.padding = '10px 15px';
                option.style.cursor = 'pointer';
                option.textContent = item.key;
                option.addEventListener('click', async () => {
                    searchInput.value = item.key;
                    dropdownPanel.style.display = 'none';
                    await fillTargetElement(item);
                });
                dropdownPanel.appendChild(option);
            });
        }

        // ====================== 核心修复：比例 & 描述触发input事件 ======================
        async function fillTargetElement(item) {
            try {
                const targetItemSelector = item.type === '促销或券类型'
                    ? '.el-select-dropdown__item:nth-child(1)'
                    : '.el-select-dropdown__item:nth-child(2)';

                const targetItem = await waitForSelector(targetItemSelector);
                targetItem.click();

                // 比例输入框（修复input事件）
                const ratioInput = await waitForSelector('.el-input-number .el-input__inner');
                ratioInput.focus();
                ratioInput.value = item.ratio;
                ratioInput.dispatchEvent(new Event('input', { bubbles: true }));
                ratioInput.dispatchEvent(new Event('change', { bubbles: true }));
                ratioInput.blur();

                // 描述输入框（修复input事件）
                const descInput = await waitForSelector('.el-input__inner');
                descInput.focus();
                descInput.value = item.desc;
                descInput.dispatchEvent(new Event('input', { bubbles: true }));
                descInput.dispatchEvent(new Event('change', { bubbles: true }));
                descInput.blur();

            } catch (e) {
                console.error('填充失败', e);
            }
        }

        searchInput.addEventListener('focus', () => {
            renderDropdown(searchInput.value);
            dropdownPanel.style.display = 'block';
        });
        searchInput.addEventListener('input', () => {
            renderDropdown(searchInput.value);
            dropdownPanel.style.display = 'block';
        });
        document.addEventListener('click', (e) => {
            if (!selectWrapper.contains(e.target)) {
                dropdownPanel.style.display = 'none';
            }
        });
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            renderDropdown('');
        });
        settingBtn.addEventListener('click', () => {});

        return barContainer;
    }

    // 初始化
    function initObserver() {
        loadConfig();
        const check = setInterval(() => {
            const target = document.querySelector('div.promotion-item-row');
            if (target && !document.getElementById('promotion-fill-bar')) {
                const bar = createFunctionBar();
                target.insertBefore(bar, target.firstChild);
                clearInterval(check);
            }
        }, 300);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initObserver();
    } else {
        document.addEventListener('DOMContentLoaded', initObserver);
    }
})();
