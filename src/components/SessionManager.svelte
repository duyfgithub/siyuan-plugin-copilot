<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import { pushMsg } from '../api';
    import { i18n } from '../utils/i18n';

    export let sessions: ChatSession[] = [];
    export let currentSessionId: string = '';
    export let isOpen = false;

    const dispatch = createEventDispatcher();

    // 下拉菜单位置
    let dropdownTop = 0;
    let dropdownLeft = 0;
    let buttonElement: HTMLButtonElement;
    let dropdownElement: HTMLDivElement;

    interface ChatSession {
        id: string;
        title: string;
        messages?: any[];
        messageCount?: number;
        createdAt: number;
        updatedAt: number;
        pinned?: boolean; // 是否钉住
    }

    // 右键菜单状态
    let contextMenuVisible = false;
    let contextMenuX = 0;
    let contextMenuY = 0;
    let contextMenuSession: ChatSession | null = null;

    // 批量删除相关状态
    let isMultiSelectMode = false; // 是否处于多选模式
    let selectedSessionIds: Set<string> = new Set(); // 选中的会话ID集合

    // 重命名相关状态
    let isRenameDialogOpen = false; // 重命名对话框是否打开
    let renameSessionTitle = ''; // 重命名输入框的值
    let renameSession: ChatSession | null = null; // 要重命名的会话

    function formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return (
                i18n('aiSidebar.session.today') +
                ' ' +
                date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            );
        } else if (days === 1) {
            return (
                i18n('aiSidebar.session.yesterday') +
                ' ' +
                date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            );
        } else if (days < 7) {
            return `${days}${i18n('aiSidebar.session.daysAgo')}`;
        } else {
            return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        }
    }

    function loadSession(sessionId: string) {
        // 多选模式下不加载会话，只切换选中状态
        if (isMultiSelectMode) {
            toggleSessionSelection(sessionId);
            return;
        }

        dispatch('load', { sessionId });
        isOpen = false;
    }

    function deleteSession(sessionId: string, event: Event) {
        event.stopPropagation();
        dispatch('delete', { sessionId });
    }

    function newSession() {
        dispatch('new');
        isOpen = false;
    }

    // 切换多选模式
    function toggleMultiSelectMode() {
        isMultiSelectMode = !isMultiSelectMode;
        if (!isMultiSelectMode) {
            // 退出多选模式时清空选中项
            selectedSessionIds.clear();
            selectedSessionIds = selectedSessionIds;
        }
    }

    // 切换会话选中状态
    function toggleSessionSelection(sessionId: string) {
        if (selectedSessionIds.has(sessionId)) {
            selectedSessionIds.delete(sessionId);
        } else {
            selectedSessionIds.add(sessionId);
        }
        selectedSessionIds = selectedSessionIds; // 触发响应式更新
    }

    // 全选/取消全选
    function toggleSelectAll() {
        if (selectedSessionIds.size === sortedSessions.length) {
            // 当前全选，则取消全选
            selectedSessionIds.clear();
        } else {
            // 未全选，则全选
            selectedSessionIds = new Set(sortedSessions.map(s => s.id));
        }
        selectedSessionIds = selectedSessionIds; // 触发响应式更新
    }

    // 批量删除选中的会话
    function batchDeleteSessions() {
        if (selectedSessionIds.size === 0) {
            pushMsg('请先选择要删除的会话');
            return;
        }

        dispatch('batchDelete', { sessionIds: Array.from(selectedSessionIds) });

        // 删除后退出多选模式
        isMultiSelectMode = false;
        selectedSessionIds.clear();
        selectedSessionIds = selectedSessionIds;
    }

    // 是否全选
    $: isAllSelected =
        sortedSessions.length > 0 && selectedSessionIds.size === sortedSessions.length;

    function closeOnOutsideClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.session-manager')) {
            isOpen = false;
        }
    }

    // 计算下拉菜单位置
    async function updateDropdownPosition() {
        if (!buttonElement || !isOpen) return;

        await tick();

        const rect = buttonElement.getBoundingClientRect();
        const dropdownWidth = dropdownElement?.offsetWidth || 320;
        const dropdownHeight = dropdownElement?.offsetHeight || 400;

        // 计算垂直位置
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
            // 显示在按钮下方
            dropdownTop = rect.bottom + 4;
        } else {
            // 显示在按钮上方
            dropdownTop = rect.top - dropdownHeight - 4;
        }

        // 计算水平位置（右对齐）
        dropdownLeft = rect.right - dropdownWidth;

        // 确保下拉菜单不会超出视口左边界
        if (dropdownLeft < 8) {
            dropdownLeft = 8;
        }

        // 确保下拉菜单不会超出视口右边界
        if (dropdownLeft + dropdownWidth > window.innerWidth - 8) {
            dropdownLeft = window.innerWidth - dropdownWidth - 8;
        }
    }

    $: if (isOpen) {
        // 打开时触发刷新事件，重新加载最新的会话列表
        dispatch('refresh');
        updateDropdownPosition();
        setTimeout(() => {
            document.addEventListener('click', closeOnOutsideClick);
        }, 0);
    } else {
        document.removeEventListener('click', closeOnOutsideClick);
    }

    // 按钉住状态和更新时间排序（钉住的在前，然后按时间降序）
    $: sortedSessions = [...sessions].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt - a.updatedAt;
    });

    // 显示右键菜单
    function showContextMenu(event: MouseEvent, session: ChatSession) {
        event.preventDefault();
        event.stopPropagation();

        contextMenuSession = session;
        contextMenuX = event.clientX;
        contextMenuY = event.clientY;
        contextMenuVisible = true;
    }

    // 关闭右键菜单
    function closeContextMenu() {
        contextMenuVisible = false;
        contextMenuSession = null;
    }

    // 全局点击事件处理（关闭右键菜单）
    function handleGlobalClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.session-context-menu')) {
            closeContextMenu();
        }
    }

    // 钉住/取消钉住会话
    function togglePinSession() {
        if (!contextMenuSession) return;

        const session = sessions.find(s => s.id === contextMenuSession.id);
        if (session) {
            session.pinned = !session.pinned;
            sessions = [...sessions];
            dispatch('update', { sessions });
            pushMsg(
                session.pinned
                    ? i18n('aiSidebar.session.pinned')
                    : i18n('aiSidebar.session.unpinned')
            );
        }
        // 不关闭右键菜单，让用户可以继续操作
    }

    // 导出会话到笔记
    function exportSessionToNote() {
        if (!contextMenuSession) return;

        dispatch('saveToNote', { sessionId: contextMenuSession.id });
        closeContextMenu();
    }

    // 导出会话到文件
    function exportSessionToFile() {
        if (!contextMenuSession) return;

        const session = contextMenuSession;
        const markdown = generateSessionMarkdown(session);

        // 创建下载链接
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        pushMsg(i18n('aiSidebar.session.exportSuccess'));
        closeContextMenu();
    }

    // 生成会话的Markdown内容
    function generateSessionMarkdown(session: ChatSession): string {
        const header = `# ${session.title}\n\n`;
        const date = `> 创建时间：${new Date(session.createdAt).toLocaleString('zh-CN')}\n`;
        const updateDate = `> 更新时间：${new Date(session.updatedAt).toLocaleString('zh-CN')}\n\n`;

        const messages = (session.messages || [])
            .filter(msg => msg.role !== 'system')
            .map(msg => {
                const role = msg.role === 'user' ? '👤 **用户**' : '🤖 **助手**';
                let content = '';

                if (typeof msg.content === 'string') {
                    content = msg.content;
                } else if (Array.isArray(msg.content)) {
                    content = msg.content
                        .filter(part => part.type === 'text')
                        .map(part => part.text)
                        .join('\n');
                }

                return `${role}\n\n${content}\n`;
            })
            .join('\n---\n\n');

        return header + date + updateDate + messages;
    }

    // 监听全局点击事件
    $: if (contextMenuVisible) {
        setTimeout(() => {
            document.addEventListener('click', handleGlobalClick);
        }, 0);
    } else {
        document.removeEventListener('click', handleGlobalClick);
    }

    // 打开重命名对话框
    function openRenameDialog() {
        if (!contextMenuSession) return;

        renameSession = contextMenuSession;
        renameSessionTitle = contextMenuSession.title;
        isRenameDialogOpen = true;
        closeContextMenu();
    }

    // 确认重命名
    function confirmRename() {
        if (!renameSession || !renameSessionTitle.trim()) {
            pushMsg('会话标题不能为空');
            return;
        }

        const session = sessions.find(s => s.id === renameSession.id);
        if (session) {
            session.title = renameSessionTitle.trim();
            sessions = [...sessions];
            dispatch('update', { sessions });
            pushMsg(i18n('aiSidebar.session.renameSuccess') || '重命名成功');
        }

        isRenameDialogOpen = false;
        renameSession = null;
        renameSessionTitle = '';
    }

    // 取消重命名
    function cancelRename() {
        isRenameDialogOpen = false;
        renameSession = null;
        renameSessionTitle = '';
    }
</script>

<div class="session-manager">
    <button
        bind:this={buttonElement}
        class="session-manager__button b3-button b3-button--text"
        on:click|stopPropagation={() => (isOpen = !isOpen)}
        title={i18n('aiSidebar.session.title')}
    >
        <svg class="b3-button__icon"><use xlink:href="#iconHistory"></use></svg>
    </button>

    {#if isOpen}
        <div
            bind:this={dropdownElement}
            class="session-manager__dropdown"
            style="top: {dropdownTop}px; left: {dropdownLeft}px;"
        >
            <div class="session-manager__header">
                <h4>{i18n('aiSidebar.session.history')}</h4>
                <div class="session-manager__header-actions">
                    {#if isMultiSelectMode}
                        <!-- 多选模式下的操作按钮 -->
                        <button
                            class="b3-button b3-button--text"
                            on:click={toggleSelectAll}
                            title={isAllSelected ? '取消全选' : '全选'}
                        >
                            <svg class="b3-button__icon">
                                <use
                                    xlink:href={isAllSelected ? '#iconCloseRound' : '#iconSelect'}
                                ></use>
                            </svg>
                        </button>
                        <button
                            class="b3-button b3-button--error"
                            on:click={batchDeleteSessions}
                            disabled={selectedSessionIds.size === 0}
                            title="删除选中 ({selectedSessionIds.size})"
                        >
                            <svg class="b3-button__icon">
                                <use xlink:href="#iconTrashcan"></use>
                            </svg>
                            <span>删除 ({selectedSessionIds.size})</span>
                        </button>
                        <button
                            class="b3-button b3-button--text"
                            on:click={toggleMultiSelectMode}
                            title="退出多选"
                        >
                            <svg class="b3-button__icon">
                                <use xlink:href="#iconClose"></use>
                            </svg>
                        </button>
                    {:else}
                        <!-- 普通模式下的操作按钮 -->
                        <button
                            class="b3-button b3-button--text"
                            on:click|stopPropagation={toggleMultiSelectMode}
                            title="多选删除"
                        >
                            <svg class="b3-button__icon">
                                <use xlink:href="#iconList"></use>
                            </svg>
                        </button>
                        <button class="b3-button b3-button--primary" on:click={newSession}>
                            <svg class="b3-button__icon"><use xlink:href="#iconAdd"></use></svg>
                            {i18n('aiSidebar.session.new')}
                        </button>
                    {/if}
                </div>
            </div>

            <div class="session-manager__list">
                {#if sortedSessions.length === 0}
                    <div class="session-manager__empty">{i18n('aiSidebar.session.empty')}</div>
                {:else}
                    {#each sortedSessions as session}
                        <div
                            class="session-item"
                            class:session-item--active={session.id === currentSessionId}
                            class:session-item--pinned={session.pinned}
                            class:session-item--selected={selectedSessionIds.has(session.id)}
                            role="button"
                            tabindex="0"
                            on:click={() => loadSession(session.id)}
                            on:contextmenu={e => showContextMenu(e, session)}
                            on:keydown={() => {}}
                        >
                            {#if isMultiSelectMode}
                                <!-- 多选模式下显示复选框 -->
                                <div class="session-item__checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedSessionIds.has(session.id)}
                                        on:change={() => toggleSessionSelection(session.id)}
                                        on:click|stopPropagation
                                    />
                                </div>
                            {/if}
                            <div class="session-item__content">
                                <div class="session-item__title">
                                    {#if session.pinned}
                                        <svg class="session-item__pin-icon">
                                            <use xlink:href="#iconPin"></use>
                                        </svg>
                                    {/if}
                                    {session.title}
                                </div>
                                <div class="session-item__info">
                                    <span class="session-item__date">
                                        {formatDate(session.updatedAt)}
                                    </span>
                                    <span class="session-item__count">
                                        {session.messageCount ||
                                            (session.messages
                                                ? session.messages.filter(m => m.role !== 'system')
                                                      .length
                                                : 0)}
                                        {i18n('aiSidebar.messages.messageCount')}
                                    </span>
                                </div>
                            </div>
                            {#if !isMultiSelectMode}
                                <!-- 普通模式下显示删除按钮 -->
                                <button
                                    class="b3-button b3-button--text session-item__delete"
                                    on:click={e => deleteSession(session.id, e)}
                                    title={i18n('aiSidebar.session.delete')}
                                >
                                    <svg class="b3-button__icon">
                                        <use xlink:href="#iconTrashcan"></use>
                                    </svg>
                                </button>
                            {/if}
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}

    <!-- 右键菜单 -->
    {#if contextMenuVisible && contextMenuSession}
        <div class="session-context-menu" style="left: {contextMenuX}px; top: {contextMenuY}px;">
            <div
                class="session-context-menu__item"
                role="button"
                tabindex="0"
                on:click={togglePinSession}
                on:keydown={e => e.key === 'Enter' && togglePinSession()}
            >
                <svg class="b3-menu__icon">
                    <use xlink:href={contextMenuSession.pinned ? '#iconUnpin' : '#iconPin'}></use>
                </svg>
                <span>
                    {contextMenuSession.pinned
                        ? i18n('aiSidebar.session.unpin')
                        : i18n('aiSidebar.session.pin')}
                </span>
            </div>
            <div
                class="session-context-menu__item"
                role="button"
                tabindex="0"
                on:click={openRenameDialog}
                on:keydown={e => e.key === 'Enter' && openRenameDialog()}
            >
                <svg class="b3-menu__icon">
                    <use xlink:href="#iconEdit"></use>
                </svg>
                <span>{i18n('aiSidebar.session.rename') || '重命名'}</span>
            </div>
            <div
                class="session-context-menu__item"
                role="button"
                tabindex="0"
                on:click={exportSessionToNote}
                on:keydown={e => e.key === 'Enter' && exportSessionToNote()}
            >
                <svg class="b3-menu__icon">
                    <use xlink:href="#iconDownload"></use>
                </svg>
                <span>{i18n('aiSidebar.actions.saveToNote') || '保存为笔记'}</span>
            </div>
            <div
                class="session-context-menu__item"
                role="button"
                tabindex="0"
                on:click={exportSessionToFile}
                on:keydown={e => e.key === 'Enter' && exportSessionToFile()}
            >
                <svg class="b3-menu__icon">
                    <use xlink:href="#iconDownload"></use>
                </svg>
                <span>{i18n('aiSidebar.session.export')}</span>
            </div>
        </div>
    {/if}

    <!-- 重命名对话框 -->
    {#if isRenameDialogOpen && renameSession}
        <div class="session-rename-dialog-overlay" on:click={cancelRename}>
            <div class="session-rename-dialog" on:click|stopPropagation>
                <div class="session-rename-dialog__header">
                    <h3>{i18n('aiSidebar.session.rename') || '重命名会话'}</h3>
                    <button
                        class="b3-button b3-button--text"
                        on:click={cancelRename}
                        title={i18n('common.cancel') || '取消'}
                    >
                        <svg class="b3-button__icon"><use xlink:href="#iconClose"></use></svg>
                    </button>
                </div>
                <div class="session-rename-dialog__body">
                    <input
                        type="text"
                        class="b3-text-field"
                        bind:value={renameSessionTitle}
                        placeholder={i18n('aiSidebar.session.titlePlaceholder') || '请输入会话标题'}
                        on:keydown={e => e.key === 'Enter' && confirmRename()}
                        autofocus
                    />
                </div>
                <div class="session-rename-dialog__footer">
                    <button class="b3-button b3-button--text" on:click={cancelRename}>
                        {i18n('common.cancel') || '取消'}
                    </button>
                    <button class="b3-button b3-button--primary" on:click={confirmRename}>
                        {i18n('common.confirm') || '确定'}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style lang="scss">
    .session-manager {
        position: relative;
    }

    .session-manager__button {
        min-width: 32px;
    }

    .session-manager__dropdown {
        position: fixed;
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-border-color);
        border-radius: 8px;
        box-shadow: var(--b3-dialog-shadow);
        width: 320px;
        max-height: 60vh;
        display: flex;
        flex-direction: column;
        z-index: 10;
    }

    .session-manager__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--b3-border-color);

        h4 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--b3-theme-on-background);
        }

        .session-manager__header-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        button {
            font-size: 12px;
            padding: 4px 12px;

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        }
    }

    .session-manager__list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
    }

    .session-manager__empty {
        padding: 40px 20px;
        text-align: center;
        color: var(--b3-theme-on-surface-light);
        font-size: 13px;
    }

    .session-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        margin-bottom: 4px;
        border-radius: 6px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.2s;

        &:hover {
            background: var(--b3-theme-surface);
            border-color: var(--b3-border-color);

            .session-item__delete {
                opacity: 1;
            }
        }
    }

    .session-item--active {
        background: var(--b3-theme-primary-lightest);
        border-color: var(--b3-theme-primary);

        .session-item__title {
            color: var(--b3-theme-primary);
            font-weight: 600;
        }
    }

    .session-item--selected {
        background: var(--b3-theme-primary-lightest);
        border-color: var(--b3-theme-primary);
    }

    .session-item__checkbox {
        display: flex;
        align-items: center;
        margin: 0;
        cursor: pointer;

        input[type='checkbox'] {
            width: 16px;
            height: 16px;
            cursor: pointer;
            margin: 0;
        }
    }

    .session-item__content {
        flex: 1;
        min-width: 0;
    }

    .session-item__title {
        font-size: 13px;
        color: var(--b3-theme-on-background);
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .session-item__info {
        display: flex;
        gap: 12px;
        font-size: 11px;
        color: var(--b3-theme-on-surface-light);
    }

    .session-item__delete {
        opacity: 0;
        transition: opacity 0.2s;
        flex-shrink: 0;

        &:hover {
            color: var(--b3-theme-error);
        }
    }

    .session-item--active .session-item__delete {
        opacity: 1;
    }

    .session-item--pinned {
        border-left: 2px solid var(--b3-theme-primary);
    }

    .session-item__pin-icon {
        width: 12px;
        height: 12px;
        margin-right: 4px;
        color: var(--b3-theme-primary);
        vertical-align: text-top;
    }

    .session-context-menu {
        position: fixed;
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        box-shadow: var(--b3-dialog-shadow);
        z-index: 10000;
        min-width: 150px;
        padding: 4px 0;
    }

    .session-context-menu__item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        font-size: 13px;
        color: var(--b3-theme-on-background);
        cursor: pointer;
        transition: background 0.2s;

        &:hover {
            background: var(--b3-theme-surface);
        }

        svg {
            width: 14px;
            height: 14px;
            color: var(--b3-theme-on-surface);
        }

        span {
            flex: 1;
        }
    }

    .session-rename-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    }

    .session-rename-dialog {
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-border-color);
        border-radius: 8px;
        box-shadow: var(--b3-dialog-shadow);
        width: 90%;
        max-width: 400px;
        display: flex;
        flex-direction: column;
    }

    .session-rename-dialog__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--b3-border-color);

        h3 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: var(--b3-theme-on-background);
        }

        button {
            padding: 4px;
        }
    }

    .session-rename-dialog__body {
        padding: 20px 16px;

        .b3-text-field {
            width: 100%;
            padding: 8px 12px;
            font-size: 14px;
            border: 1px solid var(--b3-border-color);
            border-radius: 4px;
            background: var(--b3-theme-surface);
            color: var(--b3-theme-on-background);
            transition: border-color 0.2s;

            &:focus {
                outline: none;
                border-color: var(--b3-theme-primary);
            }

            &::placeholder {
                color: var(--b3-theme-on-surface-light);
            }
        }
    }

    .session-rename-dialog__footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid var(--b3-border-color);

        button {
            padding: 6px 16px;
            font-size: 13px;
        }
    }
</style>
