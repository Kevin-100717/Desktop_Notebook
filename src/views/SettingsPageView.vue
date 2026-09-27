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
                    <p class="setting-name">全局快捷键</p>
                    <p class="setting-desc">窗口隐藏到托盘时也能用。点击右侧按键框后直接按下组合键，Esc 取消；需包含 Ctrl / Alt / Shift / Win 之一</p>
                </div>
                <div class="setting-options shortcut-options">
                    <div class="shortcut-row" v-for="row in shortcutRows" :key="row.key">
                        <span class="shortcut-label">{{ row.label }}</span>
                        <button
                            class="shortcut-key"
                            :class="{ capturing: capturing === row.key }"
                            :disabled="shortcutSaving"
                            @click="startCapture(row.key)"
                        >
                            {{ capturing === row.key ? '请按键…' : displayAccelerator(row.key) }}
                        </button>
                    </div>
                    <button class="folder-btn" :disabled="shortcutSaving" @click="resetShortcuts">恢复默认</button>
                </div>
            </div>
            <div class="setting-item setting-item-block">
                <div class="setting-info">
                    <p class="setting-name">标签管理</p>
                    <p class="setting-desc">重命名会同步所有笔记；若新名称已存在会自动合并两个标签。删除标签不会删除笔记内容</p>
                </div>
                <div class="setting-options tag-manager">
                    <p v-if="tags.length === 0" class="tag-empty">还没有任何标签，先在笔记里添加一个</p>
                    <div class="tag-row" v-for="tag in sortedTags" :key="tag">
                        <span class="tag-name" :class="{ pinned: isPinned(tag) }">{{ tag }}</span>
                        <span class="tag-swatches">
                            <button
                                v-for="color in colorPool"
                                :key="color"
                                class="swatch"
                                :class="{ active: colorOf(tag) === color }"
                                :style="{ background: color }"
                                :title="color"
                                @click="setTagColor(tag,color)"
                            ></button>
                        </span>
                        <span class="tag-ops">
                            <button class="folder-btn" @click="togglePin(tag)">
                                {{ isPinned(tag) ? "取消置顶" : "置顶" }}
                            </button>
                            <button class="folder-btn" @click="startRenameTag(tag)">重命名</button>
                            <button class="folder-btn tag-btn-danger" @click="confirmRemoveTag(tag)">删除</button>
                        </span>
                    </div>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <p class="setting-name">数据备份</p>
                    <p class="setting-desc">把配置、笔记和便签整体复制到一个带时间戳的文件夹，方便随时回滚</p>
                </div>
                <div class="setting-options setting-options-wrap">
                    <button class="folder-btn" :disabled="backingUp" @click="backupData">
                        {{ backingUp ? '备份中…' : '备份全部数据' }}
                    </button>
                    <button class="folder-btn" :disabled="backingUp" @click="importNotes('files')">导入笔记文件</button>
                    <button class="folder-btn" :disabled="backingUp" @click="importNotes('folder')">导入文件夹</button>
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
        <el-dialog
            v-model="tagDialogVisible"
            title="重命名标签"
            width="min(420px, 90vw)"
            @closed="resetTagDialog"
        >
            <span>把「{{ tagDialogFrom }}」改成新的名称</span>
            <br><br>
            <el-input
                v-model="tagDialogValue"
                placeholder="请输入新的标签名"
                :maxlength="24"
                @input="tagDialogError = ''"
                @keyup.enter="submitRenameTag"
            ></el-input>
            <p v-if="tagDialogError" class="dialog-error">{{ tagDialogError }}</p>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="tagDialogVisible = false">取消</el-button>
                    <el-button type="primary" :loading="tagSaving" @click="submitRenameTag">保存</el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import { ElButton, ElDialog, ElInput, ElMessage, ElMessageBox, ElSwitch } from 'element-plus'
import { applyTheme, currentTheme, watchTheme } from '../utils/theme.js'

const COLOR_POOL = ['#e5484d','#f76808','#ffb224','#46a758','#12a594','#0090ff','#8e4ec6','#e93d82']

const DEFAULT_SHORTCUTS = {
    newNote: 'CommandOrControl+Shift+N',
    newSticky: 'CommandOrControl+Shift+S'
}
const DISPLAY_NAMES = {
    CommandOrControl:'Ctrl',
    CmdOrCtrl:'Ctrl',
    Command:'Cmd',
    Ctrl:'Ctrl',
    Control:'Ctrl',
    Alt:'Alt',
    Option:'Alt',
    AltGr:'AltGr',
    Shift:'Shift',
    Super:'Win',
    Meta:'Win'
}
const NAMED_KEYS = {
    Space:'Space',
    Enter:'Return',
    NumpadEnter:'Return',
    Escape:'Escape',
    Backspace:'Backspace',
    Delete:'Delete',
    Tab:'Tab',
    Insert:'Insert',
    Home:'Home',
    End:'End',
    PageUp:'PageUp',
    PageDown:'PageDown',
    ArrowUp:'Up',
    ArrowDown:'Down',
    ArrowLeft:'Left',
    ArrowRight:'Right'
}
const toDisplay = accelerator => String(accelerator || '')
    .split('+')
    .map(part=>{
        const named = DISPLAY_NAMES[part]
        if(named) return named
        if(/^f\d{1,2}$/i.test(part)) return part.toUpperCase()
        if(part.length === 1) return part.toUpperCase()
        return part
    })
    .join(' + ')
const toAccelerator = event => {
    const code = event.code || ''
    let key = null
    if(/^Key[A-Z]$/.test(code)) key = code.slice(3)
    else if(/^Digit[0-9]$/.test(code)) key = code.slice(5)
    else if(/^Numpad[0-9]$/.test(code)) key = code.slice(6)
    else if(/^F\d{1,2}$/.test(code)) key = code
    else if(NAMED_KEYS[code]) key = NAMED_KEYS[code]
    if(!key) return null
    const parts = []
    if(event.ctrlKey) parts.push('CommandOrControl')
    if(event.altKey) parts.push('Alt')
    if(event.shiftKey) parts.push('Shift')
    if(event.metaKey) parts.push('Super')
    if(parts.length === 0) return null
    return parts.concat(key).join('+')
}
const errorText = error => {
    const message = String((error && error.message) || error || '')
    const index = message.lastIndexOf('Error: ')
    return index >= 0 ? message.slice(index + 7) : message
}

export default {
    components:{ ElSwitch, ElDialog, ElInput, ElButton },
    data() {
        return {
            theme: currentTheme(),
            saving: false,
            closeToTray: true,
            traySaving: false,
            opening: false,
            offTheme: null,
            shortcuts: Object.assign({}, DEFAULT_SHORTCUTS),
            shortcutSaving: false,
            capturing: null,
            shortcutRows: [
                { key: 'newNote', label: '新建笔记' },
                { key: 'newSticky', label: '新建便签' }
            ],
            themeOptions: [
                { value: 'light', label: '白天' },
                { value: 'dark', label: '黑夜' }
            ],
            colorPool: COLOR_POOL,
            tags: [],
            tagColors: {},
            pinnedTags: [],
            tagSaving: false,
            backingUp: false,
            tagDialogVisible: false,
            tagDialogFrom: '',
            tagDialogValue: '',
            tagDialogError: ''
        }
    },
    computed: {
        sortedTags() {
            const pinned = new Set(this.pinnedTags.map(item=>String(item).toLowerCase()))
            return [...this.tags].sort((a,b)=>{
                const pa = pinned.has(a.toLowerCase()) ? 0 : 1
                const pb = pinned.has(b.toLowerCase()) ? 0 : 1
                if(pa !== pb) return pa - pb
                return a.localeCompare(b)
            })
        }
    },
    methods: {
        displayAccelerator(key) {
            return toDisplay(this.shortcuts[key])
        },
        startCapture(key) {
            if(this.shortcutSaving) return
            this.capturing = key
        },
        onCaptureKeydown(event) {
            const target = this.capturing
            if(!target) return
            event.preventDefault()
            event.stopPropagation()
            if(event.code === 'Escape'){
                this.capturing = null
                return
            }
            const accelerator = toAccelerator(event)
            if(!accelerator) return
            this.capturing = null
            if(accelerator === this.shortcuts[target]) return
            this.applyShortcuts(Object.assign({}, this.shortcuts, { [target]: accelerator }))
        },
        async applyShortcuts(next) {
            const previous = Object.assign({}, this.shortcuts)
            this.shortcuts = next
            this.shortcutSaving = true
            try {
                await window.electron.setSetting('shortcuts', next)
                ElMessage.success('快捷键已保存，立即生效')
            } catch (error) {
                this.shortcuts = previous
                ElMessage.error(errorText(error) || '快捷键保存失败')
            } finally {
                this.shortcutSaving = false
            }
        },
        async resetShortcuts() {
            if(this.shortcutSaving) return
            await this.applyShortcuts(Object.assign({}, DEFAULT_SHORTCUTS))
        },
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
        },
        colorOf(tag) {
            const colors = this.tagColors || {}
            if(colors[tag]) return colors[tag]
            const key = String(tag || '').toLowerCase()
            const found = Object.keys(colors).find(item=>item.toLowerCase() === key)
            return found ? colors[found] : ''
        },
        isPinned(tag) {
            const key = String(tag || '').toLowerCase()
            return this.pinnedTags.some(item=>String(item).toLowerCase() === key)
        },
        async loadTags() {
            try {
                const list = await window.electron.getTags()
                this.tags = Array.isArray(list)
                    ? list.filter(item=>typeof item === "string" && item.trim().length > 0)
                    : []
            } catch {
                this.tags = []
            }
            try {
                const colors = await window.electron.getSetting('tagColors')
                this.tagColors = colors && typeof colors === "object" && !Array.isArray(colors) ? colors : {}
            } catch {
                this.tagColors = {}
            }
            try {
                const pinned = await window.electron.getSetting('pinnedTags')
                this.pinnedTags = Array.isArray(pinned) ? pinned : []
            } catch {
                this.pinnedTags = []
            }
        },
        async saveTagColors(next) {
            const previous = this.tagColors
            this.tagColors = next
            try {
                await window.electron.setSetting('tagColors', next)
            } catch {
                this.tagColors = previous
                ElMessage.error('标签颜色保存失败')
            }
        },
        async setTagColor(tag, color) {
            if(this.tagSaving) return
            this.tagSaving = true
            try {
                const next = Object.assign({}, this.tagColors)
                if(this.colorOf(tag) === color){
                    Object.keys(next).forEach(key=>{
                        if(key.toLowerCase() === tag.toLowerCase()) delete next[key]
                    })
                }else{
                    next[tag] = color
                }
                await this.saveTagColors(next)
            } finally {
                this.tagSaving = false
            }
        },
        async togglePin(tag) {
            if(this.tagSaving) return
            const previous = [...this.pinnedTags]
            const next = this.isPinned(tag)
                ? this.pinnedTags.filter(item=>String(item).toLowerCase() !== tag.toLowerCase())
                : [...this.pinnedTags, tag]
            this.pinnedTags = next
            this.tagSaving = true
            try {
                await window.electron.setSetting('pinnedTags', next)
            } catch {
                this.pinnedTags = previous
                ElMessage.error('置顶保存失败')
            } finally {
                this.tagSaving = false
            }
        },
        startRenameTag(tag) {
            this.tagDialogFrom = tag
            this.tagDialogValue = tag
            this.tagDialogError = ''
            this.tagDialogVisible = true
        },
        resetTagDialog() {
            this.tagDialogFrom = ''
            this.tagDialogValue = ''
            this.tagDialogError = ''
        },
        async submitRenameTag() {
            if(this.tagSaving || !this.tagDialogFrom) return
            const from = this.tagDialogFrom
            const to = typeof this.tagDialogValue === "string" ? this.tagDialogValue.trim() : ""
            if(!to){
                this.tagDialogError = '标签名不能为空'
                return
            }
            if(to === from) return
            this.tagSaving = true
            try {
                await window.electron.renameTag(from, to)
                this.tagDialogVisible = false
                this.resetTagDialog()
                await this.migrateTagMeta(from, to)
                await this.loadTags()
                ElMessage.success('标签已重命名')
            } catch (error) {
                this.tagDialogError = errorText(error) || '重命名失败，请重试'
            } finally {
                this.tagSaving = false
            }
        },
        async migrateTagMeta(from, to) {
            const colors = Object.assign({}, this.tagColors)
            const pinned = [...this.pinnedTags]
            let changed = false
            const key = String(from).toLowerCase()
            Object.keys(colors).forEach(name=>{
                if(name.toLowerCase() !== key) return
                const color = colors[name]
                delete colors[name]
                if(color && !colors[to]) colors[to] = color
                changed = true
            })
            const nextPinned = []
            pinned.forEach(item=>{
                if(String(item).toLowerCase() === key){
                    changed = true
                    if(!nextPinned.some(one=>one.toLowerCase() === to.toLowerCase())) nextPinned.push(to)
                    return
                }
                nextPinned.push(item)
            })
            if(!changed) return
            try {
                await window.electron.setSetting('tagColors', colors)
                this.tagColors = colors
            }catch{}
            try {
                await window.electron.setSetting('pinnedTags', nextPinned)
                this.pinnedTags = nextPinned
            }catch{}
        },
        async confirmRemoveTag(tag) {
            if(this.tagSaving) return
            try {
                await ElMessageBox.confirm(
                    `确定删除标签「${tag}」吗？所有笔记会保留，只是移除这个标签。`,
                    '删除标签',
                    {
                        type: 'warning',
                        confirmButtonText: '删除',
                        cancelButtonText: '取消',
                        confirmButtonClass: 'el-button--danger'
                    }
                )
            } catch {
                return
            }
            this.tagSaving = true
            try {
                await window.electron.removeTag(tag)
                const colors = Object.assign({}, this.tagColors)
                Object.keys(colors).forEach(name=>{
                    if(name.toLowerCase() === tag.toLowerCase()) delete colors[name]
                })
                await this.saveTagColors(colors)
                this.pinnedTags = this.pinnedTags.filter(item=>String(item).toLowerCase() !== tag.toLowerCase())
                try {
                    await window.electron.setSetting('pinnedTags', this.pinnedTags)
                }catch{}
                await this.loadTags()
                ElMessage.success('标签已删除')
            } catch (error) {
                ElMessage.error(errorText(error) || '标签删除失败')
            } finally {
                this.tagSaving = false
            }
        },
        async importNotes(mode) {
            if(this.backingUp) return
            this.backingUp = true
            try {
                const result = await window.electron.importNotes(mode)
                if(result && result.canceled) return
                const created = result && Array.isArray(result.created) ? result.created.length : 0
                const failed = result && Array.isArray(result.failed) ? result.failed.length : 0
                if(created > 0) ElMessage.success('成功导入 ' + created + ' 篇笔记')
                if(failed > 0) ElMessage.warning(failed + ' 个文件无法导入')
                if(created === 0 && failed === 0) ElMessage.info('没有可导入的内容')
                if(created > 0) await this.loadTags()
            } catch (error) {
                ElMessage.error(errorText(error) || '导入失败')
            } finally {
                this.backingUp = false
            }
        },
        async backupData() {
            if(this.backingUp) return
            this.backingUp = true
            try {
                const result = await window.electron.backupData()
                if(result && result.canceled) return
                const items = result && Array.isArray(result.items) ? result.items : []
                ElMessage.success('已备份 ' + items.length + ' 项到 ' + result.dir)
            } catch (error) {
                ElMessage.error(errorText(error) || '备份失败')
            } finally {
                this.backingUp = false
            }
        }
    },
    mounted() {
        this.theme = currentTheme()
        this.offTheme = watchTheme(theme=>{
            this.theme = theme
        })
        document.addEventListener('keydown',this.onCaptureKeydown,true)
        this.loadTags()
        window.electron.getSetting('shortcuts')
            .then(value=>{
                this.shortcuts = Object.assign({}, DEFAULT_SHORTCUTS, value || {})
            })
            .catch(()=>{
                this.shortcuts = Object.assign({}, DEFAULT_SHORTCUTS)
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
        document.removeEventListener('keydown',this.onCaptureKeydown,true)
        if(this.offTheme) this.offTheme()
    },
    activated() {
        this.loadTags()
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
.setting-item-block{
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
}
.setting-item-block .setting-info{
    min-width: 0;
}
.setting-options-wrap{
    flex-shrink: 1;
    flex-wrap: wrap;
    justify-content: flex-end;
    min-width: 0;
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
    min-width: 76px;
    height: 26px;
    border-radius: 13px;
}
:deep(.el-switch__core .el-switch__inner){
    height: 22px;
    font-size: 13px;
    padding: 0 6px 0 28px;
}
:deep(.el-switch.is-checked .el-switch__core .el-switch__inner){
    padding: 0 28px 0 6px;
}
:deep(.el-switch__core .el-switch__action){
    width: 20px;
    height: 20px;
}
:deep(.el-switch.is-checked .el-switch__core .el-switch__action){
    left: calc(100% - 21px);
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
.shortcut-options{
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
}
.shortcut-row{
    display: flex;
    align-items: center;
    gap: 12px;
}
.shortcut-label{
    font-size: 14px;
    color: var(--text-2);
}
.shortcut-key{
    min-width: 168px;
    padding: 9px 14px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 13px;
    letter-spacing: 0.5px;
    color: var(--text-1);
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease), color 0.15s var(--ease);
}
.shortcut-key:hover:not(:disabled){
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.shortcut-key.capturing{
    color: var(--on-accent);
    background: var(--accent-strong);
    border-color: var(--accent-strong);
    cursor: not-allowed;
}
.shortcut-key:disabled{
    cursor: not-allowed;
    opacity: 0.6;
}
.tag-manager{
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    flex: 1;
    min-width: 0;
}
.tag-empty{
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
}
.tag-row{
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 8px 10px;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    background: var(--bg-1);
}
.tag-name{
    min-width: 76px;
    max-width: 160px;
    flex-shrink: 0;
    font-size: 14px;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.tag-name.pinned::after{
    content: "置顶";
    margin-left: 8px;
    padding: 1px 7px;
    font-size: 11px;
    color: var(--on-accent);
    background: var(--accent-strong);
    border-radius: 999px;
}
.tag-swatches{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex-shrink: 0;
}
.swatch{
    width: 16px;
    height: 16px;
    padding: 0;
    border: 1px solid var(--border-1);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s var(--ease), border-color 0.15s var(--ease);
}
.swatch:hover{
    border-color: var(--text-1);
}
.swatch.active{
    border-color: var(--text-1);
    box-shadow: inset 0 0 0 2px var(--bg-1);
}
.tag-ops{
    display: flex;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
}
.tag-btn-danger{
    color: var(--danger);
    border-color: var(--danger-soft);
}
.tag-btn-danger:hover{
    color: #ffffff;
    background: var(--danger);
    border-color: var(--danger);
}
.dialog-error{
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--danger);
}
.dialog-footer{
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
@media (max-width: 620px){
    .setting-item{
        flex-direction: column;
        align-items: stretch;
    }
    .theme-option{
        flex: 1;
    }
    .shortcut-options{
        align-items: stretch;
    }
    .shortcut-row{
        justify-content: space-between;
    }
}
</style>
