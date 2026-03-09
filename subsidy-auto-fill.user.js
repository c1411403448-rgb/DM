// ==UserScript==
// @name         外网平台补贴信息填充
// @author       LCJ
// @match        https://*.pos-admin.vip.vip.com/*
// @grant        none
// @version      1.0
// @description  看着能不能跑。
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
    // 自定义天数缓存key
    const CUSTOM_DAY_CACHE_KEY = 'promotionFillCustomDay';
    // =================================================================

    let appConfig = { ...DEFAULT_CONFIG };

    // 1. 缓存操作
    function loadConfig() {
        const saved = localStorage.getItem('promotionFillConfig');
        if (saved) {
            try {
                appConfig = JSON.parse(saved);
            } catch (e) {
                console.warn('加载缓存失败，使用默认配置', e);
                appConfig = { ...DEFAULT_CONFIG };
            }
        }
    }
    function saveConfig() {
        localStorage.setItem('promotionFillConfig', JSON.stringify(appConfig));
    }

    // 自定义天数缓存操作
    function getSavedCustomDay() {
        const saved = localStorage.getItem(CUSTOM_DAY_CACHE_KEY);
        return saved && !isNaN(parseInt(saved)) ? parseInt(saved) : '';
    }
    function saveCustomDay(days) {
        if (!isNaN(days) && days >= 1) {
            localStorage.setItem(CUSTOM_DAY_CACHE_KEY, days.toString());
        }
    }

    // 2. 工具函数：等待元素出现
    function waitForSelector(selector, timeout = 8000) {
        return new Promise((resolve, reject) => {
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    resolve(el);
                }
            }, 100);
            setTimeout(() => {
                clearInterval(timer);
                reject(new Error(`元素【${selector}】超时未找到`));
            }, timeout);
        });
    }

    function getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        return `${year}-${month}-${day}`;
    }


    function getDateAfterDays(days) {
        const now = new Date();
        // 直接基于本地时间增加天数，无时区转换
        now.setDate(now.getDate() + days);
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        return `${year}-${month}-${day}`;
    }


    async function fillDate(startDate, endDate) {
        try {
            // 获取开始日期输入框
            const startDateInput = await waitForSelector('input.el-range-input:nth-child(2)');
            // 获取结束日期输入框
            const endDateInput = await waitForSelector('input.el-range-input:nth-child(4)');

            // 填充开始日期并触发input事件
            startDateInput.value = startDate;
            startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
            // 额外触发change事件（防止部分框架只监听change）
            startDateInput.dispatchEvent(new Event('change', { bubbles: true }));

            // 填充结束日期并触发input事件
            endDateInput.value = endDate;
            endDateInput.dispatchEvent(new Event('input', { bubbles: true }));
            endDateInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            alert(`日期填充失败：${e.message}`);
        }
    }

    // 3. 创建核心功能区
    function createFunctionBar() {
        // 功能区容器
        const barContainer = document.createElement('div');
        barContainer.id = 'promotion-fill-bar';
        barContainer.style.cssText = `
            display: flex;align-items: center;gap: 10px;margin-bottom: 10px;padding: 10px;
            background: #f8f9fa;border-radius: 6px;border: 1px solid #e9ecef;
            width: 100%;box-sizing: border-box;flex-wrap: wrap;
        `;

        // 左侧话术功能区容器
        const leftFuncWrapper = document.createElement('div');
        leftFuncWrapper.style.cssText = `
            display: flex;align-items: center;gap: 10px;flex: 1;
        `;

        // 3.1 下拉话术选择框
        const selectWrapper = document.createElement('div');
        selectWrapper.style.cssText = `
            position: relative;max-width: 260px;
        `;

        // 搜索输入框
        const searchInput = document.createElement('input');
        searchInput.placeholder = '输入关键词搜索';
        searchInput.style.cssText = `
            width: 100%;padding: 8px 12px;border: 1px solid #e9ecef;
            border-radius: 4px;outline: none;font-size: 14px;box-sizing: border-box;
        `;

        // 下拉选项面板
        const dropdownPanel = document.createElement('div');
        dropdownPanel.style.cssText = `
            position: absolute;top: calc(100% + 5px);left: 0;right: 0;max-height: 200px;overflow-y: auto;
            background: #fff;border: 1px solid #e9ecef;border-radius: 4px;box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 9999;display: none;width: 100%;box-sizing: border-box;
        `;

        // 3.2 清空按钮
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '清空';
        clearBtn.style.cssText = `
            padding: 8px 12px;border: 1px solid #e5e6eb;border-radius: 6px;
            background: #f5f5f5;cursor: pointer;font-size: 14px;transition: background-color 0.2s;
        `;
        clearBtn.addEventListener('mouseover', () => clearBtn.style.background = '#e8e8e8');
        clearBtn.addEventListener('mouseout', () => clearBtn.style.background = '#f5f5f5');

        // 3.3 设置按钮
        const settingBtn = document.createElement('button');
        settingBtn.textContent = '设置';
        settingBtn.style.cssText = `
            padding: 8px 12px;border: none;border-radius: 6px;
            background: #52c41a;color: #fff;cursor: pointer;font-size: 14px;transition: opacity 0.2s;
        `;
        settingBtn.addEventListener('mouseover', () => settingBtn.style.opacity = '1');
        settingBtn.addEventListener('mouseout', () => settingBtn.style.opacity = '0.95');

        // --------------------------
        // 日期快捷按钮区域
        // --------------------------
        const dateBtnWrapper = document.createElement('div');
        dateBtnWrapper.style.cssText = `
            display: flex;align-items: center;gap: 8px;margin-left: auto;
        `;

        // 通用按钮样式（蓝色系，hover效果）
        const btnStyle = `
            padding: 8px 16px;border: none;border-radius: 6px;
            background: #4096ff;color: #fff;cursor: pointer;font-size: 14px;
            transition: background-color 0.2s;
        `;
        const btnHoverStyle = '#3385ff'; // hover时稍深的蓝色

        // 1天按钮
        const day1Btn = document.createElement('button');
        day1Btn.textContent = '1天';
        day1Btn.style.cssText = btnStyle;
        day1Btn.addEventListener('mouseover', () => day1Btn.style.background = btnHoverStyle);
        day1Btn.addEventListener('mouseout', () => day1Btn.style.background = '#4096ff');
        day1Btn.addEventListener('click', () => {
            const today = getCurrentDate();
            const endDate = getDateAfterDays(1);
            fillDate(today, endDate);
        });

        // 3天按钮
        const day3Btn = document.createElement('button');
        day3Btn.textContent = '3天';
        day3Btn.style.cssText = btnStyle;
        day3Btn.addEventListener('mouseover', () => day3Btn.style.background = btnHoverStyle);
        day3Btn.addEventListener('mouseout', () => day3Btn.style.background = '#4096ff');
        day3Btn.addEventListener('click', () => {
            const today = getCurrentDate();
            const endDate = getDateAfterDays(3);
            fillDate(today, endDate);
        });

        // 7天按钮
        const day7Btn = document.createElement('button');
        day7Btn.textContent = '7天';
        day7Btn.style.cssText = btnStyle;
        day7Btn.addEventListener('mouseover', () => day7Btn.style.background = btnHoverStyle);
        day7Btn.addEventListener('mouseout', () => day7Btn.style.background = '#4096ff');
        day7Btn.addEventListener('click', () => {
            const today = getCurrentDate();
            const endDate = getDateAfterDays(7);
            fillDate(today, endDate);
        });

        // 15天按钮
        const day15Btn = document.createElement('button');
        day15Btn.textContent = '15天';
        day15Btn.style.cssText = btnStyle;
        day15Btn.addEventListener('mouseover', () => day15Btn.style.background = btnHoverStyle);
        day15Btn.addEventListener('mouseout', () => day15Btn.style.background = '#4096ff');
        day15Btn.addEventListener('click', () => {
            const today = getCurrentDate();
            const endDate = getDateAfterDays(15);
            fillDate(today, endDate);
        });

        // 自定义天数输入框
        const customDayInput = document.createElement('input');
        customDayInput.style.cssText = `
            width: 60px;padding: 8px 12px;border: 1px solid #e9ecef;
            border-radius: 6px;outline: none;font-size: 14px;box-sizing: border-box;
            text-align: center;
            /* 关键：隐藏数字输入框的上下调整按钮 */
            -moz-appearance: textfield;
        `;
        // 兼容webkit内核浏览器
        const inputStyle = document.createElement('style');
        inputStyle.textContent = `
            input::-webkit-outer-spin-button,
            input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
        `;
        document.head.appendChild(inputStyle);

        customDayInput.placeholder = '天数';
        customDayInput.type = 'number';
        customDayInput.min = 1;
        const savedDay = getSavedCustomDay();
        if (savedDay) {
            customDayInput.value = savedDay;
        }

        // 回车触发填充
        customDayInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const days = parseInt(customDayInput.value.trim());
                if (isNaN(days) || days < 1) {
                    alert('请输入有效的天数（≥1）');
                    customDayInput.focus();
                    return;
                }
                const today = getCurrentDate();
                const endDate = getDateAfterDays(days);
                fillDate(today, endDate);
                saveCustomDay(days);
            }
        });

        // 自定义天按钮
        const customDayBtn = document.createElement('button');
        customDayBtn.textContent = '天';
        customDayBtn.style.cssText = btnStyle;
        customDayBtn.addEventListener('mouseover', () => customDayBtn.style.background = btnHoverStyle);
        customDayBtn.addEventListener('mouseout', () => customDayBtn.style.background = '#4096ff');
        customDayBtn.addEventListener('click', () => {
            const days = parseInt(customDayInput.value.trim());
            if (isNaN(days) || days < 1) {
                alert('请输入有效的天数（≥1）');
                customDayInput.focus();
                return;
            }
            const today = getCurrentDate();
            const endDate = getDateAfterDays(days);
            fillDate(today, endDate);
            saveCustomDay(days);
        });

        // 组装日期按钮区域
        dateBtnWrapper.appendChild(day1Btn);
        dateBtnWrapper.appendChild(day3Btn);
        dateBtnWrapper.appendChild(day7Btn);
        dateBtnWrapper.appendChild(day15Btn);
        dateBtnWrapper.appendChild(customDayInput);
        dateBtnWrapper.appendChild(customDayBtn);

        // 组装左侧话术功能区
        selectWrapper.appendChild(searchInput);
        selectWrapper.appendChild(dropdownPanel);
        leftFuncWrapper.appendChild(selectWrapper);
        leftFuncWrapper.appendChild(clearBtn);
        leftFuncWrapper.appendChild(settingBtn);

        // 组装总功能区
        barContainer.appendChild(leftFuncWrapper);
        barContainer.appendChild(dateBtnWrapper);

        // --------------------------
        // 基础交互逻辑（话术选择）
        // --------------------------
        // 渲染下拉选项（搜索筛选）
        function renderDropdown(filterText = '') {
            dropdownPanel.innerHTML = '';
            const filterVal = filterText.toLowerCase().trim();
            const filtered = appConfig.presetItems.filter(item =>
                item.key.toLowerCase().includes(filterVal)
            );

            if (filtered.length === 0) {
                const emptyItem = document.createElement('div');
                emptyItem.style.cssText = 'padding: 10px 15px;color: #999;font-size: 14px;';
                emptyItem.textContent = '无匹配话术';
                dropdownPanel.appendChild(emptyItem);
                return;
            }

            filtered.forEach(item => {
                const option = document.createElement('div');
                option.style.cssText = `
                    padding: 10px 15px;cursor: pointer;font-size: 14px;transition: background-color 0.2s;
                `;
                option.textContent = item.key;
                option.addEventListener('mouseover', () => option.style.background = '#f5f7fa');
                option.addEventListener('mouseout', () => option.style.background = 'transparent');
                option.addEventListener('click', async () => {
                    try {
                        searchInput.value = item.key; // 选择后显示话术
                        dropdownPanel.style.display = 'none';
                        await fillTargetElement(item);
                    } catch (e) {
                        alert(`填充失败：${e.message}`);
                    }
                });
                dropdownPanel.appendChild(option);
            });
        }

        // 填充目标元素
        async function fillTargetElement(item) {
            const targetItemSelector = item.type === '促销或券类型'
                ? '.gd-select-popper .el-select-dropdown__item:nth-child(1)'
                : '.gd-select-popper .el-select-dropdown__item:nth-child(2)';
            const targetItem = await waitForSelector(targetItemSelector);
            targetItem.click();

            const ratioInput = await waitForSelector('.el-input-number .el-input__inner');
            ratioInput.value = item.ratio;
            ratioInput.dispatchEvent(new Event('input', { bubbles: true }));

            const descInput = await waitForSelector('.el-form-item__content > .el-input > .el-input__inner');
            descInput.value = item.desc;
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // 搜索框聚焦/输入展开下拉
        searchInput.addEventListener('focus', () => {
            renderDropdown(searchInput.value);
            dropdownPanel.style.display = 'block';
        });
        searchInput.addEventListener('input', () => {
            renderDropdown(searchInput.value);
            dropdownPanel.style.display = 'block';
        });

        // 点击其他区域关闭下拉
        document.addEventListener('click', (e) => {
            if (!selectWrapper.contains(e.target)) {
                dropdownPanel.style.display = 'none';
            }
        });

        // 清空按钮逻辑
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            renderDropdown('');
        });

        // 设置按钮逻辑
        settingBtn.addEventListener('click', () => createFullSettingPanel());

        return barContainer;
    }

    // 4. 设置面板
    function createFullSettingPanel() {
        const mask = document.createElement('div');
        mask.id = 'setting-mask';
        mask.style.cssText = `
            position: fixed;top:0;left:0;width:100vw;height:100vh;background: rgba(0,0,0,0.5);
            z-index: 10000;display: flex;align-items: center;justify-content: center;
        `;

        const panel = document.createElement('div');
        panel.id = 'setting-panel';
        panel.style.cssText = `
            background: #fff;padding: 25px;border-radius: 8px;width: 90%;max-width: 800px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        // 标题
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 18px;font-weight: 600;margin-bottom: 20px;padding-bottom: 10px;
            border-bottom: 1px solid #eee;color: #333;
        `;
        title.textContent = '填充项设置';

        // 表格
        const table = document.createElement('table');
        table.style.cssText = 'width: 100%;border-collapse: collapse;margin-bottom: 20px;';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['选项', '比例设置', '优惠描述设置'].forEach(text => {
            const th = document.createElement('th');
            th.style.cssText = `
                padding: 12px 10px;text-align: left;border-bottom: 1px solid #f0f0f0;
                font-weight: 600;color: #333;background-color: #f8f9fa;
            `;
            th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const inputRefs = [];
        appConfig.presetItems.forEach((item, index) => {
            const row = document.createElement('tr');
            row.style.cssText = 'border-bottom: 1px solid #f0f0f0;';

            // 选项列
            const td1 = document.createElement('td');
            td1.style.cssText = 'padding: 12px 10px;color: #666;';
            td1.textContent = item.key;
            row.appendChild(td1);

            // 比例列
            const td2 = document.createElement('td');
            td2.style.cssText = 'padding: 12px 10px;';
            const ratioInput = document.createElement('input');
            ratioInput.style.cssText = `
                width: 100%;padding: 8px 10px;border: 1px solid #e5e6eb;
                border-radius: 6px;font-size: 14px;
            `;
            ratioInput.value = item.ratio;
            ratioInput.dataset.index = index;
            ratioInput.dataset.type = 'ratio';
            inputRefs.push(ratioInput);
            td2.appendChild(ratioInput);
            row.appendChild(td2);

            // 描述列
            const td3 = document.createElement('td');
            td3.style.cssText = 'padding: 12px 10px;';
            const descInput = document.createElement('textarea');
            descInput.style.cssText = `
                width: 100%;padding: 8px 10px;border: 1px solid #e9ecef;
                border-radius: 6px;font-size: 14px;min-height: 40px;resize: vertical;
            `;
            descInput.value = item.desc;
            descInput.dataset.index = index;
            descInput.dataset.type = 'desc';
            inputRefs.push(descInput);
            td3.appendChild(descInput);
            row.appendChild(td3);

            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        // 按钮区域
        const btnWrap = document.createElement('div');
        btnWrap.style.cssText = `
            display: flex;justify-content: flex-end;gap: 10px;margin-top: 25px;
            padding-top: 15px;border-top: 1px solid #eee;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 8px 16px;border: none;border-radius: 6px;
            background: #f5f5f5;color: #666;cursor: pointer;font-size: 14px;
        `;

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 8px 16px;border: none;border-radius: 6px;
            background: #4096ff;color: #fff;cursor: pointer;font-size: 14px;
        `;

        btnWrap.appendChild(cancelBtn);
        btnWrap.appendChild(saveBtn);

        // 组装面板
        panel.appendChild(title);
        panel.appendChild(table);
        panel.appendChild(btnWrap);
        mask.appendChild(panel);
        document.body.appendChild(mask);

        // 关闭面板逻辑
        function closePanel() {
            document.body.removeChild(mask);
        }
        cancelBtn.addEventListener('click', closePanel);
        mask.addEventListener('click', (e) => e.target === mask && closePanel());
        document.addEventListener('keydown', (e) => e.key === 'Escape' && closePanel());

        saveBtn.addEventListener('click', () => {
            let isValid = true;
            inputRefs.forEach(input => {
                const index = parseInt(input.dataset.index);
                const type = input.dataset.type;
                const value = input.value.trim();

                if (type === 'ratio') {
                    const numValue = Number(value);
                    if (isNaN(numValue) || numValue < 0.5 || numValue > 1.0) {
                        isValid = false;
                        alert(`第${index+1}项比例错误！请输入0.5-1.0之间的数字`);
                        input.focus();
                        return;
                    }
                    appConfig.presetItems[index][type] = numValue.toString();
                }

                if (type === 'desc' && !value) {
                    isValid = false;
                    alert(`第${index+1}项优惠描述不能为空！`);
                    input.focus();
                    return;
                }
                if (type === 'desc' && isValid) {
                    appConfig.presetItems[index][type] = value;
                }
            });

            if (isValid) {
                saveConfig();
                closePanel();
            }
        });
    }

    function initObserver() {
        loadConfig();

        const checkInterval = setInterval(() => {
            const targetContainer = document.querySelector('div.promotion-item-row');
            if (targetContainer && !document.getElementById('promotion-fill-bar')) {
                const functionBar = createFunctionBar();
                targetContainer.insertBefore(functionBar, targetContainer.firstChild);
            }
        }, 300);

        window.addEventListener('beforeunload', () => clearInterval(checkInterval));
    }

    // 启动脚本
    initObserver();
})();