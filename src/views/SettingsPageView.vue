<template>
    <div id="settings-page">
        <div class="settings-panel">
            <div class="settings-head">
                <h2>设置</h2>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <p class="setting-name">软件主题</p>
                    <p class="setting-desc">选择界面配色，切换后立即生效</p>
                </div>
                <div class="setting-options">
                    <button
                        v-for="option in themeOptions"
                        :key="option.value"
                        class="theme-option"
                        :class="{ active: theme === option.value }"
                        :disabled="saving"
                        @click="changeTheme(option.value)"
                    >
                        <span class="theme-preview" :class="'theme-preview-' + option.value">
                            <i class="preview-bar"></i>
                            <i class="preview-dot"></i>
                            <i class="preview-line"></i>
                            <i class="preview-line short"></i>
                        </span>
                        <span class="theme-option-text">{{ option.label }}</span>
                    </button>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <p class="setting-name">关闭主窗口时</p>
                    <p class="setting-desc">开启后关闭窗口会最小化到系统托盘，托盘菜单可直接新建笔记与便签；关闭则直接退出程序</p>
                </div>
                <div class="setting-options">
                    <el-switch
                        v-model="closeToTray"
                        :loading="traySaving"
                        inline-prompt
                        active-text="托盘"
                        inactive-text="退出"
                        @change="changeCloseToTray"
                    ></el-switch>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <p class="setting-name">数据文件夹</p>
                    <p class="setting-desc">直接打开数据目录，便签为纯文本文件，可自行备份或用外部编辑器修改</p>
                </div>
                <div class="setting-options">
                    <button class="folder-btn" :disabled="opening" @click="openFolder('notes')">打开笔记文件夹</button>
                    <button class="folder-btn" :disabled="opening" @click="openFolder('labels')">打开便签文件夹</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ElMessage, ElSwitch } from 'element-plus'
import { applyTheme, currentTheme, watchTheme } from '../utils/theme.js'

export default {
    components:{ ElSwitch },
    data() {
        return {
            theme: currentTheme(),
            saving: false,
            closeToTray: true,
            traySaving: false,
            opening: false,
            offTheme: null,
            themeOptions: [
                { value: 'light', label: '白天' },
                { value: 'dark', label: '黑夜' }
            ]
        }
    },
    methods: {
        async changeTheme(value) {
            if(this.saving || this.theme === value) return
            const previous = this.theme
            this.theme = value
            applyTheme(value)
            this.saving = true
            try {
                await window.electron.setSetting('theme', value)
            } catch {
                this.theme = previous
                applyTheme(previous)
                ElMessage.error('主题保存失败')
            } finally {
                this.saving = false
            }
        },
        async changeCloseToTray(value) {
            if(this.traySaving) return
            const previous = !value
            this.traySaving = true
            try {
                await window.electron.setSetting('closeToTray', value)
            } catch {
                this.closeToTray = previous
                ElMessage.error('设置保存失败')
            } finally {
                this.traySaving = false
            }
        },
        async openFolder(key) {
            if(this.opening) return
            this.opening = true
            try {
                const error = await window.electron.openDataFolder(key)
                if(error) ElMessage.error('打开失败：' + error)
            } catch {
                ElMessage.error('打开失败')
            } finally {
                this.opening = false
            }
        }
    },
    mounted() {
        this.theme = currentTheme()
        this.offTheme = watchTheme(theme=>{
            this.theme = theme
        })
        window.electron.getSetting('closeToTray')
            .then(value=>{
                this.closeToTray = value !== false
            })
            .catch(()=>{
                this.closeToTray = true
            })
    },
    beforeUnmount() {
        if(this.offTheme) this.offTheme()
    }
}
</script>

<style scoped>
#settings-page{
    width: 100%;
    height: 100%;
    overflow: auto;
    color: var(--text-1);
}
.settings-panel{
    width: min(720px, calc(100% - 32px));
    margin: clamp(24px, 6vh, 60px) auto;
    padding: clamp(20px, 3vw, 32px);
    box-sizing: border-box;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-2);
    background: var(--block-1);
}
.settings-head h2{
    font-size: 21px;
    font-weight: 600;
    letter-spacing: 0.3px;
}
.settings-head p{
    margin-top: 6px;
    font-size: 14px;
    color: var(--text-2);
}
.setting-item{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-top: 28px;
    padding-top: 24px;
    border-top: 1px solid var(--border-1);
}
.setting-name{
    font-size: 16px;
    font-weight: 500;
}
.setting-desc{
    margin-top: 5px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-2);
}
.setting-options{
    display: flex;
    flex-shrink: 0;
    gap: 12px;
}
.folder-btn{
    padding: 9px 16px;
    font-size: 14px;
    color: var(--text-1);
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease), color 0.15s var(--ease);
}
.folder-btn:hover:not(:disabled){
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.folder-btn:disabled{
    cursor: not-allowed;
    opacity: 0.6;
}
:deep(.el-switch.is-checked .el-switch__core){
    background: var(--accent-strong);
    border-color: var(--accent-strong);
}
:deep(.el-switch__core){
    background: var(--block-2);
    border-color: var(--border-2);
}
:deep(.el-switch__label){
    color: var(--text-2);
}
:deep(.el-switch__label.is-active){
    color: var(--on-accent);
}
.theme-option{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 104px;
    padding: 12px 10px;
    font-size: 14px;
    color: var(--text-2);
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease), color 0.15s var(--ease);
}
.theme-option:hover:not(:disabled){
    background: var(--block-2);
    border-color: var(--border-2);
    color: var(--text-1);
}
.theme-option.active{
    color: var(--text-1);
    border-color: var(--accent-strong);
    border-width: 2px;
    padding: 11px 9px;
    background: var(--accent-soft);
}
.theme-option:disabled{
    cursor: not-allowed;
    opacity: 0.7;
}
.theme-preview{
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 8px;
    box-sizing: border-box;
    border-radius: var(--radius-1);
    border: 1px solid var(--border-2);
}
.theme-preview .preview-bar{
    height: 7px;
    border-radius: 3px;
}
.theme-preview .preview-dot{
    width: 9px;
    height: 9px;
    margin: 2px auto;
    border-radius: 50%;
}
.theme-preview .preview-line{
    height: 4px;
    border-radius: 2px;
}
.theme-preview .preview-line.short{
    width: 60%;
}
.theme-preview-dark{
    background: #161618;
    border-color: #2d2e34;
}
.theme-preview-dark .preview-bar{
    background: #e8d531;
}
.theme-preview-dark .preview-dot{
    background: #e8d531;
}
.theme-preview-dark .preview-line{
    background: #3a3b3e;
}
.theme-preview-light{
    background: #f3f4f6;
    border-color: #d3d6dc;
}
.theme-preview-light .preview-bar{
    background: #e8d531;
}
.theme-preview-light .preview-dot{
    background: #b89800;
}
.theme-preview-light .preview-line{
    background: #c9ccd3;
}
@media (max-width: 620px){
    .setting-item{
        flex-direction: column;
        align-items: stretch;
    }
    .theme-option{
        flex: 1;
    }
}
</style>
