<script lang="ts">
    import { onMount } from 'svelte';
    import SettingPanel from '@/libs/components/setting-panel.svelte';
    import { t } from './utils/i18n';
    import { getDefaultSettings } from './defaultSettings';
    import { pushMsg, pushErrMsg, lsNotebooks, getBlockByID } from './api';
    import { confirm } from 'siyuan';
    import ProviderConfigPanel from './components/ProviderConfigPanel.svelte';
    import type { CustomProviderConfig } from './defaultSettings';
    export let plugin;

    // 使用动态默认设置
    let settings = { ...getDefaultSettings() };

    // 笔记本列表
    let notebookOptions: Record<string, string> = {};

    // SOUL 文档验证状态
    let soulDocValidation: { status: 'idle' | 'checking' | 'valid' | 'invalid'; message: string } =
        {
            status: 'idle',
            message: '',
        };

    interface ISettingGroup {
        name: string;
        items: ISettingItem[];
        //  Type："checkbox" | "select" | "textinput" | "textarea" | "number" | "slider" | "button" | "hint" | "custom";
    }

    const builtInProviderNames: Record<string, string> = {
        Achuan: t('platform.builtIn.Achuan'),
        gemini: t('platform.builtIn.gemini'),
        openai: t('platform.builtIn.openai'),
        deepseek: t('platform.builtIn.deepseek'),
        moonshot: t('platform.builtIn.moonshot'),
        volcano: t('platform.builtIn.volcano'),
    };

    // 内置平台的默认 API 地址
    const builtInProviderDefaultUrls: Record<string, string> = {
        Achuan: 'https://gpt.achuan-2.top/',
        gemini: 'https://generativelanguage.googleapis.com',
        deepseek: 'https://api.deepseek.com',
        moonshot: 'https://api.moonshot.cn',
        openai: 'https://api.openai.com',
        volcano: 'https://ark.cn-beijing.volces.com',
    };

    // 内置平台的官网链接
    const builtInProviderWebsites: Record<string, string> = {
        Achuan: 'https://gpt.achuan-2.top/register?aff=ZndO',
        gemini: 'https://aistudio.google.com/apikey',
        deepseek: 'https://platform.deepseek.com/',
        moonshot: 'https://platform.moonshot.cn/',
        openai: 'https://platform.openai.com/',
        volcano: 'https://console.volcengine.com/ark',
    };

    // 当前选中的平台ID
    let selectedProviderId = '';

    // 新增自定义平台相关状态
    let showAddPlatform = false;
    let newPlatformName = '';

    // 拖拽排序相关状态
    let dragOverIndex: number | null = null;
    let dragSourceIndex: number | null = null;
    let dragSourceId: string | null = null;

    // 处理拖拽开始
    function handleDragStart(e: DragEvent, index: number, providerId: string) {
        dragSourceIndex = index;
        dragSourceId = providerId;
        e.dataTransfer?.setData('text/plain', providerId);
        e.dataTransfer!.effectAllowed = 'move';
    }

    // 处理拖拽进入
    function handleDragEnter(index: number) {
        if (index !== dragSourceIndex) {
            dragOverIndex = index;
        }
    }

    // 处理拖拽结束
    function handleDragEnd() {
        dragOverIndex = null;
        dragSourceIndex = null;
        dragSourceId = null;
    }

    // 处理放置
    function handleDrop(e: DragEvent, targetIndex: number) {
        e.preventDefault();
        dragOverIndex = null;

        if (dragSourceIndex === null || dragSourceIndex === targetIndex) {
            return;
        }

        // 重新排序
        const items = [...allProviderOptions];
        const [removed] = items.splice(dragSourceIndex, 1);
        items.splice(targetIndex, 0, removed);

        // 保存新顺序
        const newOrder = items.map(p => p.id);
        settings = {
            ...settings,
            aiProviders: {
                ...settings.aiProviders,
                providerOrder: newOrder,
            },
        };

        saveSettings();
        pushMsg(t('platform.reorderSuccess') || '平台顺序已更新');
    }

    // 处理拖拽悬停（防止默认行为）
    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
    }

    function handleProviderChange() {
        saveSettings();
    }

    // 处理平台重命名
    function handleProviderRename(providerId: string, newName: string) {
        const provider = settings.aiProviders.customProviders.find(p => p.id === providerId);
        if (provider) {
            provider.name = newName;
            // 触发响应式更新
            settings = {
                ...settings,
                aiProviders: {
                    ...settings.aiProviders,
                    customProviders: [...settings.aiProviders.customProviders],
                },
            };
            saveSettings();
            pushMsg(`平台已重命名为: ${newName}`);
        }
    }

    // 生成自定义平台ID
    function generateCustomPlatformId(): string {
        return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 添加自定义平台
    function addCustomPlatform() {
        if (!newPlatformName.trim()) {
            pushErrMsg(t('platform.nameRequired'));
            return;
        }

        const newPlatform: CustomProviderConfig = {
            id: generateCustomPlatformId(),
            name: newPlatformName.trim(),
            apiKey: '',
            customApiUrl: '',
            models: [],
        };

        // 使用响应式更新确保 Svelte 检测到变化
        settings = {
            ...settings,
            aiProviders: {
                ...settings.aiProviders,
                customProviders: [...settings.aiProviders.customProviders, newPlatform],
            },
            // 自动选中新创建的平台（仅设置面板，不影响对话）
            selectedProviderId: newPlatform.id,
        };

        // 更新本地选中状态
        selectedProviderId = newPlatform.id;

        newPlatformName = '';
        showAddPlatform = false;
        saveSettings();
        pushMsg(t('aiSidebar.success.addPromptSuccess') + `: ${newPlatform.name}`);
    }

    // 删除平台（内置平台也可删除）
    function removePlatform(providerId: string) {
        const platformName =
            builtInProviderNames[providerId] ||
            settings.aiProviders?.customProviders?.find(p => p.id === providerId)?.name ||
            t('platform.unknown');

        confirm(
            t('aiSidebar.confirm.deletePlatform.title'),
            t('aiSidebar.confirm.deletePlatform.message', { platformName }),
            async () => {
                // 检查是否需要清空当前选中的模型
                // 只有当删除的平台是当前正在使用的平台时才清空模型选择
                const shouldClearModel = settings.currentProvider === providerId;

                // 如果是内置平台，将其添加到禁用列表
                if (builtInProviderNames[providerId]) {
                    const disabledBuiltIn = settings.aiProviders?.disabledBuiltInProviders || [];
                    if (!disabledBuiltIn.includes(providerId)) {
                        settings = {
                            ...settings,
                            aiProviders: {
                                ...settings.aiProviders,
                                disabledBuiltInProviders: [...disabledBuiltIn, providerId],
                            },
                        };
                    }
                } else {
                    // 如果是自定义平台，从列表中移除
                    // 使用响应式更新确保 Svelte 检测到变化
                    const filteredProviders = settings.aiProviders.customProviders.filter(
                        p => p.id !== providerId
                    );
                    settings = {
                        ...settings,
                        aiProviders: {
                            ...settings.aiProviders,
                            customProviders: filteredProviders,
                        },
                    };
                }

                // 如果删除的是当前选中的平台（在设置面板中），清空面板选择
                if (selectedProviderId === providerId) {
                    selectedProviderId = '';
                    settings.selectedProviderId = '';
                }

                // 只有当删除的平台是当前对话使用的平台时，才清空对话中的平台和模型选择
                if (shouldClearModel) {
                    settings = {
                        ...settings,
                        currentProvider: '',
                        currentModelId: '',
                    };
                }

                saveSettings();
                pushMsg(t('aiSidebar.success.deletePromptSuccess') + `: ${platformName}`);
            }
        );
    }

    // 获取所有平台选项（内置+自定义） - 使用响应式语句
    $: allProviderOptions = (() => {
        // 获取被禁用的内置平台列表
        const disabledBuiltIn = settings.aiProviders?.disabledBuiltInProviders || [];

        const builtIn = Object.keys(builtInProviderNames)
            .filter(id => !disabledBuiltIn.includes(id)) // 过滤掉被禁用的内置平台
            .map(id => ({
                id,
                name: builtInProviderNames[id],
                type: 'built-in' as const,
            }));

        const custom = (settings.aiProviders?.customProviders || []).map(
            (p: CustomProviderConfig) => ({
                id: p.id,
                name: p.name,
                type: 'custom' as const,
            })
        );

        const allProviders = [...builtIn, ...custom];

        // 根据保存的顺序排序
        const savedOrder = settings.aiProviders?.providerOrder || [];
        if (savedOrder.length > 0) {
            // 创建ID到位置的映射
            const orderMap = new Map(savedOrder.map((id, index) => [id, index]));
            // 按顺序排序，未在顺序中的放到最后
            allProviders.sort((a, b) => {
                const orderA = orderMap.get(a.id);
                const orderB = orderMap.get(b.id);
                if (orderA !== undefined && orderB !== undefined) {
                    return orderA - orderB;
                }
                if (orderA !== undefined) return -1;
                if (orderB !== undefined) return 1;
                return 0;
            });
        }

        return allProviders;
    })();

    // 获取当前选中平台的名称 - 使用响应式语句
    $: selectedProviderName = (() => {
        if (!selectedProviderId) return t('platform.select');

        if (builtInProviderNames[selectedProviderId]) {
            return builtInProviderNames[selectedProviderId];
        }

        const customProvider = settings.aiProviders?.customProviders?.find(
            (p: CustomProviderConfig) => p.id === selectedProviderId
        );
        return customProvider?.name || t('platform.unknown');
    })();

    // 保存选中的平台ID（仅在设置面板中选择平台，不影响对话中的当前平台）
    function handleProviderSelect() {
        // 使用响应式更新确保 Svelte 检测到变化
        settings = {
            ...settings,
            selectedProviderId: selectedProviderId,
        };
        saveSettings();
    }

    let groups: ISettingGroup[] = [
        {
            name: t('settings.settingsGroup.systemPrompt'),
            items: [
                {
                    key: 'aiSystemPrompt',
                    value: settings.aiSystemPrompt,
                    type: 'textarea',
                    title: t('settings.ai.systemPrompt.title'),
                    description: t('settings.ai.systemPrompt.description'),
                    direction: 'row',
                    rows: 4,
                    placeholder: t('settings.ai.systemPrompt.placeholder'),
                },
            ],
        },
        {
            name: t('settings.settingsGroup.platformManagement'),
            items: [],
        },
        {
            name: t('settings.settingsGroup.displayAndOperation'),
            items: [
                {
                    key: 'sendMessageShortcut',
                    value: settings.sendMessageShortcut,
                    type: 'select',
                    title: t('settings.sendMessageShortcut.title'),
                    description: t('settings.sendMessageShortcut.description'),
                    options: {
                        'ctrl+enter': t('settings.sendMessageShortcut.options.ctrlEnter'),
                        enter: t('settings.sendMessageShortcut.options.enter'),
                    },
                },
                {
                    key: 'messageFontSize',
                    value: settings.messageFontSize,
                    type: 'number',
                    title: t('settings.messageFontSize.title'),
                    description: t('settings.messageFontSize.description'),
                    number: {
                        min: 5,
                        max: 32,
                        step: 1,
                    },
                },
                {
                    key: 'multiModelViewMode',
                    value: settings.multiModelViewMode,
                    type: 'select',
                    title: t('settings.multiModelViewMode.title'),
                    description: t('settings.multiModelViewMode.description'),
                    options: {
                        tab: t('settings.multiModelViewMode.options.tab'),
                        card: t('settings.multiModelViewMode.options.card'),
                    },
                },
            ],
        },
        {
            name: t('settings.settingsGroup.noteExport'),
            items: [
                {
                    key: 'exportNotebook',
                    value: settings.exportNotebook,
                    type: 'select',
                    title: t('settings.exportNotebook.title'),
                    description: t('settings.exportNotebook.description'),
                    options: notebookOptions,
                },
                {
                    key: 'exportDefaultPath',
                    value: settings.exportDefaultPath,
                    type: 'textinput',
                    title: t('settings.exportDefaultPath.title'),
                    description: t('settings.exportDefaultPath.description'),
                    placeholder: t('settings.exportDefaultPath.placeholder'),
                },
            ],
        },
        {
            name: t('settings.settingsGroup.sessionManagement') || '会话管理',
            items: [
                {
                    key: 'autoRenameSession',
                    value: settings.autoRenameSession,
                    type: 'checkbox',
                    title: t('settings.autoRenameSession.title') || '会话自动重命名',
                    description:
                        t('settings.autoRenameSession.description') ||
                        '在首次发送消息时，自动使用AI生成会话标题',
                },
            ],
        },
        {
            name: t('settings.settingsGroup.translate') || '翻译设置',
            items: [
                {
                    key: 'translateTemperature',
                    value: settings.translateTemperature,
                    type: 'number',
                    title: t('settings.translate.temperature.title') || '翻译 Temperature',
                    description:
                        t('settings.translate.temperature.description') ||
                        '翻译专用的 temperature 参数（0-2），为空则使用模型默认值。值越小，翻译越准确一致；值越大，翻译越灵活多样',
                    number: {
                        min: 0,
                        max: 2,
                        step: 0.1,
                    },
                },
                {
                    key: 'translatePrompt',
                    value: settings.translatePrompt,
                    type: 'textarea',
                    title: t('settings.translate.prompt.title') || '翻译提示词',
                    description:
                        t('settings.translate.prompt.description') ||
                        '翻译时使用的提示词模板，${content} 会被替换为要翻译的内容',
                    direction: 'row',
                    rows: 8,
                    placeholder:
                        t('settings.translate.prompt.placeholder') || '输入翻译提示词模板...',
                },
            ],
        },
        {
            name: t('settings.settingsGroup.tools') || '工具设置',
            items: [
                {
                    key: 'pythonPath',
                    value: settings.pythonPath,
                    type: 'textinput',
                    title: t('settings.pythonPath.title') || 'Python 解释器路径',
                    description:
                        t('settings.pythonPath.description') ||
                        '设置 Python 可执行文件的路径，用于运行 Python 代码工具。留空则使用系统默认的 python 命令',
                    placeholder:
                        t('settings.pythonPath.placeholder') ||
                        '例如：C:\\Python311\\python.exe 或 /usr/bin/python3',
                },
            ],
        },
        {
            name: t('settings.settingsGroup.soul') || 'SOUL 文档',
            items: [
                {
                    key: 'soulDocId',
                    value: settings.soulDocId,
                    type: 'textinput',
                    title: t('settings.soulDocId.title') || 'SOUL 文档 ID',
                    description:
                        t('settings.soulDocId.description') ||
                        '设置 SOUL 数据存储的文档 ID。SOUL 工具只能在此文档内进行增删改查操作。',
                    placeholder:
                        t('settings.soulDocId.placeholder') ||
                        '输入文档块 ID，如 20260312120000-xxxxxxxx',
                },
            ],
        },
        {
            name: t('settings.settingsGroup.webApp') || '网页小程序',
            items: [
                {
                    key: 'openLinksInWebView',
                    value: settings.openLinksInWebView,
                    type: 'checkbox',
                    title: t('settings.openLinksInWebView.title') || '在 WebView 中打开链接',
                    description:
                        t('settings.openLinksInWebView.description') ||
                        '点击思源笔记中的 https 链接时，在内置 WebView 标签页中打开，而不是外部浏览器',
                },
                {
                    key: 'searchEngine',
                    value: settings.searchEngine,
                    type: 'select',
                    title: '搜索引擎',
                    description: '选择地址栏使用的默认搜索引擎',
                    options: {
                        google: 'Google',
                        bing: 'Bing',
                    },
                },
            ],
        },
        {
            name: t('settings.settingsGroup.reset') || 'Reset Settings',
            items: [
                {
                    key: 'reset',
                    value: '',
                    type: 'button',
                    title: t('settings.reset.title') || 'Reset Settings',
                    description:
                        t('settings.reset.description') || 'Reset all settings to default values',
                    button: {
                        label: t('settings.reset.label') || 'Reset',
                        callback: async () => {
                            confirm(
                                t('settings.reset.title') || 'Reset Settings',
                                t('settings.reset.confirmMessage') ||
                                    'Are you sure you want to reset all settings to default values? This action cannot be undone.',
                                async () => {
                                    // 确认回调
                                    settings = { ...getDefaultSettings() };
                                    updateGroupItems();
                                    await saveSettings();
                                    await pushMsg(t('settings.reset.message'));
                                },
                                () => {
                                    // 取消回调（可选）
                                    console.log('Reset cancelled');
                                }
                            );
                        },
                    },
                },
            ],
        },
        {
            name: '❤️用爱发电',
            items: [
                {
                    key: 'donateInfo',
                    value: '',
                    type: 'hint',
                    title: '用爱发电',
                    description: `
                        <p style="margin-top:12px;">如果喜欢我的插件，欢迎给GitHub仓库点star和微信赞赏，这会激励我继续完善此插件和开发新插件。</p>

                        <p style="margin-top:12px;">维护插件费时费力，个人时间和精力有限，开源只是分享，不等于我要浪费我的时间免费帮用户实现ta需要的功能，</p>

                        <p style="margin-top:12px;">我需要的功能我会慢慢改进（打赏可以催更），有些我觉得可以改进、但是现阶段不必要的功能需要打赏才改进（会标注打赏标签和需要打赏金额），而不需要的功能、实现很麻烦的功能会直接关闭issue不考虑实现，我没实现的功能欢迎有大佬来pr</p>

                        <p style="margin-top:12px;">累积赞赏50元的朋友如果想加我微信和进粉丝交流群，可以在赞赏的时候备注微信号，或者发邮件到<a href="mailto:achuan-2@outlook.com">achuan-2@outlook.com</a>来进行好友申请</p>
                        
                        <div style="margin-top:12px;">
                        <img src="plugins/siyuan-plugin-copilot/assets/donate.png" alt="donate" style="max-width:260px; height:auto; border:1px solid var(--b3-border-color);"/>
                        </div>
                        <p style="margin-top:12px;">也欢迎大家使用我的<a href="https://gpt.achuan-2.top/register?aff=ZndO">AI API中转站</a>，提供Openai ChatGPT、Gemini、Claude、Deepseek、Grok等API直连中转服务，只要用户注册我就有收益</p>
                    `,
                },
            ],
        },
    ];

    let focusGroup = groups[0].name;

    interface ChangeEvent {
        group: string;
        key: string;
        value: any;
    }

    const onChanged = ({ detail }: CustomEvent<ChangeEvent>) => {
        console.log(detail.key, detail.value);
        // 使用 in 操作符检查 key 是否存在，而不是检查值是否为 undefined
        // 这样可以正确处理值为 undefined 的设置项（如 translateTemperature）
        if (detail.key in settings) {
            settings[detail.key] = detail.value;
            saveSettings();
        }
    };

    async function saveSettings() {
        await plugin.saveSettings(settings);
    }

    onMount(async () => {
        await runload();
    });

    async function runload() {
        const loadedSettings = await plugin.loadSettings();
        settings = { ...loadedSettings };

        // 确保 aiProviders 存在
        if (!settings.aiProviders) {
            settings.aiProviders = {
                gemini: { apiKey: '', customApiUrl: '', models: [] },
                deepseek: { apiKey: '', customApiUrl: '', models: [] },
                openai: { apiKey: '', customApiUrl: '', models: [] },
                moonshot: { apiKey: '', customApiUrl: '', models: [] },
                volcano: { apiKey: '', customApiUrl: '', models: [] },
                Achuan: { apiKey: '', customApiUrl: '', models: [] },
                customProviders: [],
                disabledBuiltInProviders: [],
                providerOrder: [],
            };
        }

        // 确保每个内置平台都存在（支持旧配置升级）
        // 但被用户删除（禁用）的内置平台除外
        const builtInPlatformIds = [
            'Achuan',
            'gemini',
            'deepseek',
            'openai',
            'moonshot',
            'volcano',
        ];
        const disabledBuiltIn = settings.aiProviders.disabledBuiltInProviders || [];
        for (const platformId of builtInPlatformIds) {
            if (!settings.aiProviders[platformId] && !disabledBuiltIn.includes(platformId)) {
                settings.aiProviders[platformId] = { apiKey: '', customApiUrl: '', models: [] };
            }
        }

        // 确保 customProviders 数组存在
        if (!settings.aiProviders.customProviders) {
            settings.aiProviders.customProviders = [];
        }

        // 确保 disabledBuiltInProviders 数组存在
        if (!settings.aiProviders.disabledBuiltInProviders) {
            settings.aiProviders.disabledBuiltInProviders = [];
        }

        // 确保 providerOrder 数组存在
        if (!settings.aiProviders.providerOrder) {
            settings.aiProviders.providerOrder = [];
        }

        // 恢复选中的平台ID（仅用于设置面板显示）
        // 优先使用 selectedProviderId，如果不存在则使用 currentProvider 作为初始值
        selectedProviderId = settings.selectedProviderId || settings.currentProvider || 'openai';

        // 确保 selectedProviderId 设置被保存
        if (!settings.selectedProviderId) {
            settings.selectedProviderId = selectedProviderId;
        }

        // 加载笔记本列表
        await loadNotebooks();

        // 如果有设置 SOUL 文档 ID，自动验证
        if (settings.soulDocId) {
            await validateSoulDocId();
        }

        updateGroupItems();
    }

    // 加载笔记本列表
    async function loadNotebooks() {
        try {
            const notebooks = await lsNotebooks();
            if (notebooks?.notebooks && notebooks.notebooks.length > 0) {
                // 构建笔记本选项对象 { id: name }，只显示 closed=false 的笔记本
                notebookOptions = {};
                notebookOptions[''] =
                    t('settings.exportNotebook.placeholder') || '-- 请选择笔记本 --';
                notebooks.notebooks
                    .filter(notebook => notebook.closed === false)
                    .forEach(notebook => {
                        notebookOptions[notebook.id] = notebook.name;
                    });
            } else {
                notebookOptions = {
                    '': t('settings.exportNotebook.placeholder') || '-- 请选择笔记本 --',
                };
            }
        } catch (error) {
            console.error('Load notebooks error:', error);
            notebookOptions = {
                '': t('settings.exportNotebook.placeholder') || '-- 请选择笔记本 --',
            };
        }
    }

    /**
     * 验证 SOUL 文档 ID
     */
    async function validateSoulDocId() {
        const docId = settings.soulDocId?.trim();
        if (!docId) {
            soulDocValidation = { status: 'idle', message: '' };
            return;
        }

        soulDocValidation = {
            status: 'checking',
            message: t('settings.soulDocId.validating') || '验证中...',
        };

        try {
            const block = await getBlockByID(docId);
            if (!block) {
                soulDocValidation = {
                    status: 'invalid',
                    message: t('settings.soulDocId.notFound') || '块不存在，请检查 ID 是否正确',
                };
                return;
            }

            if (block.type !== 'd') {
                soulDocValidation = {
                    status: 'invalid',
                    message:
                        t('settings.soulDocId.notDoc') ||
                        `该 ID 不是文档类型，当前类型: ${block.type}`,
                };
                return;
            }

            soulDocValidation = {
                status: 'valid',
                message:
                    t('settings.soulDocId.valid') || `✓ 有效文档: ${block.content || '未命名'}`,
            };
        } catch (error) {
            soulDocValidation = {
                status: 'invalid',
                message: t('settings.soulDocId.error') || '验证失败: ' + (error as Error).message,
            };
        }
    }

    function updateGroupItems() {
        groups = groups.map(group => ({
            ...group,
            items: group.items.map(item => {
                const updatedItem: any = {
                    ...item,
                    value: settings[item.key] ?? item.value,
                };
                // 为笔记本选择器更新 options
                if (item.key === 'exportNotebook') {
                    updatedItem.options = notebookOptions;
                }
                return updatedItem;
            }),
        }));
    }

    $: currentGroup = groups.find(group => group.name === focusGroup);
</script>

<div class="fn__flex-1 fn__flex config__panel">
    <ul class="b3-tab-bar b3-list b3-list--background">
        {#each groups as group}
            <li
                data-name="editor"
                class:b3-list-item--focus={group.name === focusGroup}
                class="b3-list-item"
                on:click={() => {
                    focusGroup = group.name;
                }}
                on:keydown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        focusGroup = group.name;
                    }
                }}
                role="tab"
                tabindex="0"
            >
                <span class="b3-list-item__text">{group.name}</span>
            </li>
        {/each}
    </ul>
    <div class="config__tab-wrap">
        {#if focusGroup === t('settings.settingsGroup.systemPrompt')}
            <SettingPanel
                group={currentGroup?.name || ''}
                settingItems={currentGroup?.items || []}
                display={true}
                on:changed={onChanged}
            />
        {:else if focusGroup === t('settings.settingsGroup.platformManagement')}
            <!-- 新的侧边栏布局：左侧为平台列表/操作，右侧为平台配置主区域 -->
            <div class="platform-management-layout">
                <aside class="platform-sidebar">
                    <div class="unified-platform-manager">
                        <div class="manager-header">
                            <h5>{t('platform.management')}</h5>
                            <button
                                class="b3-button b3-button--outline"
                                on:click={() => (showAddPlatform = !showAddPlatform)}
                            >
                                {showAddPlatform ? t('platform.cancel') : t('platform.add')}
                            </button>
                        </div>

                        {#if showAddPlatform}
                            <div class="add-platform-form">
                                <div>
                                    <div>{t('platform.name')}</div>
                                    <input
                                        class="b3-text-field fn__flex-1"
                                        type="text"
                                        bind:value={newPlatformName}
                                        placeholder={t('platform.namePlaceholder')}
                                        on:keydown={e => e.key === 'Enter' && addCustomPlatform()}
                                    />
                                </div>
                                <button
                                    class="b3-button b3-button--outline"
                                    on:click={addCustomPlatform}
                                    disabled={!newPlatformName.trim()}
                                >
                                    {t('platform.confirmAdd')}
                                </button>
                            </div>
                        {/if}

                        <div class="platform-list">
                            {#each allProviderOptions as platform, index (platform.id)}
                                <div
                                    class="platform-item"
                                    class:platform-item--selected={selectedProviderId ===
                                        platform.id}
                                    class:platform-item--dragging={dragSourceIndex === index}
                                    class:platform-item--drag-over-top={dragOverIndex === index &&
                                        dragSourceIndex !== null &&
                                        dragSourceIndex > index}
                                    class:platform-item--drag-over-bottom={dragOverIndex ===
                                        index &&
                                        dragSourceIndex !== null &&
                                        dragSourceIndex < index}
                                    draggable="true"
                                    on:click={() => {
                                        selectedProviderId = platform.id;
                                        handleProviderSelect();
                                    }}
                                    on:keydown={e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            selectedProviderId = platform.id;
                                            handleProviderSelect();
                                        }
                                    }}
                                    on:dragstart={e => handleDragStart(e, index, platform.id)}
                                    on:dragenter={() => handleDragEnter(index)}
                                    on:dragend={handleDragEnd}
                                    on:dragover={handleDragOver}
                                    on:drop={e => handleDrop(e, index)}
                                    role="button"
                                    tabindex="0"
                                    title={t('platform.dragToReorder') || '拖动以排序'}
                                >
                                    <div class="platform-item__drag-handle">
                                        <svg class="b3-button__icon">
                                            <use xlink:href="#iconDrag"></use>
                                        </svg>
                                    </div>
                                    <div class="platform-item__info">
                                        <span class="platform-item__name">{platform.name}</span>
                                        <span class="platform-item__type">
                                            {platform.type === 'built-in'
                                                ? t('platform.type.builtin')
                                                : t('platform.type.custom')}
                                        </span>
                                    </div>
                                    <button
                                        class="b3-button b3-button--text b3-button--error"
                                        on:click|stopPropagation={() => removePlatform(platform.id)}
                                        title="删除平台"
                                    >
                                        <svg class="b3-button__icon">
                                            <use xlink:href="#iconTrashcan"></use>
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                            {#if allProviderOptions.length === 0}
                                <div class="empty-hint">暂无可用平台</div>
                            {/if}
                        </div>
                    </div>
                </aside>

                <main class="platform-main">
                    {#if selectedProviderId}
                        {#if builtInProviderNames[selectedProviderId]}
                            {#key selectedProviderId}
                                <ProviderConfigPanel
                                    providerId={selectedProviderId}
                                    providerName={selectedProviderName}
                                    defaultApiUrl={builtInProviderDefaultUrls[selectedProviderId]}
                                    websiteUrl={builtInProviderWebsites[selectedProviderId]}
                                    bind:config={settings.aiProviders[selectedProviderId]}
                                    isCustomProvider={false}
                                    on:change={handleProviderChange}
                                />
                            {/key}
                        {:else}
                            {#each settings.aiProviders.customProviders as customProvider}
                                {#if customProvider.id === selectedProviderId}
                                    {#key customProvider.id}
                                        <ProviderConfigPanel
                                            providerId={customProvider.id}
                                            providerName={customProvider.name}
                                            defaultApiUrl=""
                                            websiteUrl=""
                                            bind:config={customProvider}
                                            isCustomProvider={true}
                                            on:change={handleProviderChange}
                                            on:rename={e =>
                                                handleProviderRename(
                                                    customProvider.id,
                                                    e.detail.newName
                                                )}
                                        />
                                    {/key}
                                {/if}
                            {/each}
                        {/if}
                    {:else}
                        <div class="no-selection">
                            {t('platform.selectHint') || '请选择一个平台以查看或编辑其配置'}
                        </div>
                    {/if}
                </main>
            </div>
        {:else if focusGroup === (t('settings.settingsGroup.sessionManagement') || '会话管理')}
            <div class="session-management-panel">
                <SettingPanel
                    group={currentGroup?.name || ''}
                    settingItems={currentGroup?.items || []}
                    display={true}
                    on:changed={onChanged}
                />

                {#if settings.autoRenameSession}
                    <div class="auto-rename-model-selector">
                        <div class="config__item">
                            <div class="config__item-label">
                                <div class="config__item-title">
                                    {t('settings.autoRenameSession.modelTitle') || '重命名模型'}
                                </div>
                                <div class="config__item-description">
                                    {t('settings.autoRenameSession.modelDescription') ||
                                        '选择用于生成会话标题的AI模型'}
                                </div>
                            </div>
                            <div
                                class="config__item-control"
                                style="display: flex; gap: 8px; align-items: center;"
                            >
                                <select
                                    class="b3-select"
                                    bind:value={settings.autoRenameProvider}
                                    on:change={() => {
                                        settings.autoRenameModelId = '';
                                        saveSettings();
                                    }}
                                >
                                    <option value="">
                                        {t('settings.autoRenameSession.selectProvider') ||
                                            '-- 选择平台 --'}
                                    </option>
                                    {#each allProviderOptions as provider}
                                        {#if settings.aiProviders[provider.id]?.models?.length > 0 || (provider.type === 'custom' && settings.aiProviders.customProviders.find(p => p.id === provider.id)?.models?.length > 0)}
                                            <option value={provider.id}>{provider.name}</option>
                                        {/if}
                                    {/each}
                                </select>

                                {#if settings.autoRenameProvider}
                                    <select
                                        class="b3-select"
                                        bind:value={settings.autoRenameModelId}
                                        on:change={saveSettings}
                                    >
                                        <option value="">
                                            {t('settings.autoRenameSession.selectModel') ||
                                                '-- 选择模型 --'}
                                        </option>
                                        {#if builtInProviderNames[settings.autoRenameProvider]}
                                            {#each settings.aiProviders[settings.autoRenameProvider]?.models || [] as model}
                                                <option value={model.id}>
                                                    {model.name || model.id}
                                                </option>
                                            {/each}
                                        {:else}
                                            {#each settings.aiProviders.customProviders.find(p => p.id === settings.autoRenameProvider)?.models || [] as model}
                                                <option value={model.id}>
                                                    {model.name || model.id}
                                                </option>
                                            {/each}
                                        {/if}
                                    </select>
                                {/if}
                            </div>
                        </div>

                        <!-- 自定义提示词 -->
                        <div class="config__item" style="margin-top: 16px;">
                            <div class="config__item-label">
                                <div class="config__item-title">
                                    {t('settings.autoRenameSession.promptTitle') || '自定义提示词'}
                                </div>
                                <div class="config__item-description">
                                    {t('settings.autoRenameSession.promptDescription') ||
                                        '自定义生成会话标题的提示词，使用 {message} 作为用户消息的占位符'}
                                </div>
                            </div>
                            <div class="config__item-control">
                                <textarea
                                    class="b3-text-field"
                                    rows="4"
                                    bind:value={settings.autoRenamePrompt}
                                    on:change={saveSettings}
                                    placeholder={t(
                                        'settings.autoRenameSession.promptPlaceholder'
                                    ) ||
                                        '请根据以下用户消息生成一个简洁的会话标题（不超过20个字，不要使用引号）：\n\n{message}'}
                                ></textarea>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        {:else if focusGroup === (t('settings.settingsGroup.soul') || 'SOUL 文档')}
            <!-- SOUL 文档设置特殊处理 -->
            <div class="soul-settings-panel">
                <div class="config__item">
                    <div class="config__item-label">
                        <div class="config__item-title">
                            {t('settings.soulDocId.title') || 'SOUL 文档 ID'}
                        </div>
                        <div class="config__item-description">
                            {t('settings.soulDocId.description') || '设置 SOUL 数据存储的文档 ID'}
                        </div>
                    </div>
                    <div class="config__item-control">
                        <input
                            class="b3-text-field"
                            type="text"
                            bind:value={settings.soulDocId}
                            on:change={async () => {
                                await saveSettings();
                                await validateSoulDocId();
                            }}
                            placeholder={t('settings.soulDocId.placeholder') ||
                                '输入文档块 ID，如 20260312120000-xxxxxxxx'}
                        />
                        <button
                            class="b3-button b3-button--outline"
                            on:click={validateSoulDocId}
                            disabled={soulDocValidation.status === 'checking'}
                        >
                            {soulDocValidation.status === 'checking'
                                ? t('settings.soulDocId.validating') || '验证中...'
                                : t('settings.soulDocId.validate') || '验证'}
                        </button>
                    </div>
                    {#if soulDocValidation.message}
                        <div
                            class="soul-validation-message"
                            class:soul-validation-valid={soulDocValidation.status === 'valid'}
                            class:soul-validation-invalid={soulDocValidation.status === 'invalid'}
                        >
                            {soulDocValidation.message}
                        </div>
                    {/if}
                </div>
            </div>
        {:else}
            <SettingPanel
                group={currentGroup?.name || ''}
                settingItems={currentGroup?.items || []}
                display={true}
                on:changed={onChanged}
            />
        {/if}
    </div>
</div>

<style lang="scss">
    .config__panel {
        height: 100%;
        display: flex;
        flex-direction: row;
        overflow: hidden;
    }
    .config__panel > .b3-tab-bar {
        width: min(30%, 170px);
    }

    .config__tab-wrap {
        flex: 1;
        height: 100%;
        overflow: hidden;
        padding: 2px;
        display: flex;
        flex-direction: column;
    }

    /* 平台管理：侧边栏布局 */
    .platform-management-layout {
        display: flex;
        gap: 16px;
        flex: 1;
        min-height: 0;
        align-items: stretch;
    }

    .platform-sidebar {
        width: 260px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .platform-main {
        flex: 1;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    .no-selection {
        padding: 24px;
        background: var(--b3-theme-background);
        border: 1px dashed var(--b3-border-color);
        border-radius: 6px;
        color: var(--b3-theme-on-surface-light);
    }

    .unified-platform-manager {
        background: var(--b3-theme-surface);
        border-radius: 6px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
    }

    .manager-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;

        h5 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--b3-theme-on-surface);
        }
    }

    .add-platform-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        background: var(--b3-theme-background);
        border-radius: 4px;
        margin-bottom: 16px;
    }

    .platform-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        overflow-y: auto;
        min-height: 0;
    }

    .platform-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        background: var(--b3-theme-background);
        border-radius: 6px;
        border: 1px solid var(--b3-border-color);
        cursor: pointer;
        transition: all 0.2s;
        position: relative;

        &:hover {
            background: var(--b3-theme-surface);
            border-color: var(--b3-theme-primary);
        }

        &.platform-item--selected {
            background: var(--b3-theme-primary-lightest);
            border-color: var(--b3-theme-primary);
        }

        // 拖拽时的样式
        &.platform-item--dragging {
            opacity: 0.5;
            background: var(--b3-theme-surface);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transform: scale(1.02);
        }

        // 顶部放置指示器
        &.platform-item--drag-over-top::before {
            content: '';
            position: absolute;
            top: -4px;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--b3-theme-primary);
            border-radius: 2px;
            z-index: 1;
        }

        // 底部放置指示器
        &.platform-item--drag-over-bottom::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--b3-theme-primary);
            border-radius: 2px;
            z-index: 1;
        }
    }

    .platform-item__drag-handle {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 8px;
        padding: 2px;
        cursor: grab;
        opacity: 0.4;
        transition: opacity 0.2s;
        flex-shrink: 0;

        &:hover {
            opacity: 0.8;
        }

        &:active {
            cursor: grabbing;
        }

        svg {
            width: 14px;
            height: 14px;
        }
    }

    .platform-item__info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }

    .platform-item__name {
        font-size: 14px;
        font-weight: 500;
        color: var(--b3-theme-on-background);
    }

    .platform-item__type {
        font-size: 11px;
        color: var(--b3-theme-on-surface-light);
        padding: 2px 6px;
        background: var(--b3-theme-surface);
        border-radius: 10px;
        align-self: flex-start;
    }

    .empty-hint {
        padding: 20px;
        text-align: center;
        color: var(--b3-theme-on-surface-light);
        font-size: 13px;
    }

    .session-management-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
        flex: 1;
        overflow-y: auto;
    }

    .soul-settings-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
        flex: 1;
        overflow-y: auto;
        padding: 16px;
    }

    .soul-validation-message {
        margin-top: 8px;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 13px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
    }

    .soul-validation-valid {
        background: var(--b3-card-success-background);
        color: var(--b3-card-success-color);
    }

    .soul-validation-invalid {
        background: var(--b3-card-error-background);
        color: var(--b3-card-error-color);
    }

    .auto-rename-model-selector {
        padding: 16px;
        background: var(--b3-theme-surface);
        border-radius: 6px;
        margin-top: 8px;
    }

    .config__item {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .config__item-label {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .config__item-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--b3-theme-on-background);
    }

    .config__item-description {
        font-size: 12px;
        color: var(--b3-theme-on-surface-light);
        line-height: 1.5;
    }

    .config__item-control {
        display: flex;
        gap: 8px;
        align-items: center;

        .b3-select {
            flex: 1;
            min-width: 0;
        }

        textarea.b3-text-field {
            width: 100%;
            min-height: 80px;
            padding: 8px 12px;
            font-size: 13px;
            line-height: 1.6;
            font-family: var(--b3-font-family);
            resize: vertical;

            &::placeholder {
                color: var(--b3-theme-on-surface-light);
                opacity: 0.6;
            }
        }
    }
</style>
