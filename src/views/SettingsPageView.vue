<template>
    <div id="settings-page">
        <div class="settings-panel">
            <div class="settings-head">
                <h2>设置</h2>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <p class="setting-name">深浅底色</p>
                    <p class="setting-desc">看久了眼睛舒服一点，白天黑夜随你挑</p>
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
                    <p class="setting-name">主题色</p>
                    <p class="setting-desc">按钮和高亮都用这个颜色，不喜欢就挑一个别的</p>
                </div>
                <div class="setting-options accent-options">
                    <button
                        class="accent-swatch default"
                        :class="{ active: accent === '' }"
                        title="用默认的黄"
                        :disabled="saving"
                        @click="changeAccent('')"
                    ></button>
                    <button
                        v-for="color in accentPalette"
                        :key="color"
                        class="accent-swatch"
                        :class="{ active: accent === color }"
                        :style="{ background: color }"
                        :title="color"
                        :disabled="saving"
                        @click="changeAccent(color)"
                    ></button>
                    <el-color-picker
                        v-model="accentDraft"
                        size="small"
                        :predefine="accentPalette"
                        @change="changeAccent(accentDraft)"
                    ></el-color-picker>
                </div>
            </div>
            <div class="setting-item setting-item-block">
                <div class="setting-info">
                    <p class="setting-name">自己配色</p>
                    <p class="setting-desc">挑几处颜色就能改，不用写代码；不想要的地方留空就是原来的样子</p>
                </div>
                <div class="color-board">
                    <div class="color-main">
                        <div class="color-grid">
                            <div
                                class="color-row"
                                v-for="group in colorGroups"
                                :key="group.part"
                                :data-pick="group.part"
                            >
                                <span class="color-label">{{ group.label }}</span>
                                <div class="color-control">
                                    <button
                                        class="color-chip"
                                        :class="{ on: colorDraft[group.part] }"
                                        :style="colorDraft[group.part] ? { background: colorDraft[group.part] } : {}"
                                        :title="colorDraft[group.part] || '用默认'"
                                        @click="pickColor(group.part)"
                                    >
                                        <span v-if="!colorDraft[group.part]" class="chip-empty">默认</span>
                                    </button>
                                    <el-color-picker
                                        :model-value="colorDraft[group.part] || ''"
                                        size="small"
                                        :predefine="accentPalette"
                                        @change="value => changeColor(group.part, value)"
                                    ></el-color-picker>
                                    <button
                                        v-if="colorDraft[group.part]"
                                        class="color-clear"
                                        title="回到默认"
                                        @click="changeColor(group.part, '')"
                                    >×</button>
                                </div>
                                <span class="color-hint">{{ group.hint }}</span>
                            </div>
                        </div>
                        <div class="color-preview" aria-label="配色预览">
                            <p class="preview-title">
                                <span>看着是这样</span>
                                <em class="preview-count" v-if="touchedCount > 0">改过 {{ touchedCount }} 处</em>
                            </p>
                            <div class="preview-window" :style="previewStyle">
                                <div class="preview-side">
                                    <span class="preview-dot on"></span>
                                    <span class="preview-dot"></span>
                                    <span class="preview-dot"></span>
                                    <span class="preview-dot"></span>
                                </div>
                                <div class="preview-body">
                                    <span class="preview-bar"></span>
                                    <span class="preview-line wide"></span>
                                    <span class="preview-line"></span>
                                    <span class="preview-line short"></span>
                                    <div class="preview-foot">
                                        <span class="preview-chip">选中</span>
                                        <span class="preview-note">便签</span>
                                        <span class="preview-warn">删除</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="color-presets">
                        <span class="presets-label">成套的配色</span>
                        <div class="presets-list">
                            <button
                                v-for="preset in colorPresets"
                                :key="preset.name"
                                class="preset-btn"
                                :title="preset.name"
                                :disabled="saving"
                                @click="usePreset(preset)"
                            >
                                <i
                                    v-for="(swatch, i) in presetSwatches(preset)"
                                    :key="i"
                                    class="preset-swatch"
                                    :style="{ background: swatch }"
                                ></i>
                                <span class="preset-name">{{ preset.name }}</span>
                            </button>
                        </div>
                    </div>
                    <div class="css-actions">
                        <span class="css-status">{{ cssStatus }}</span>
                        <button class="tool-btn" :disabled="saving" @click="saveColors">存下这个配色</button>
                        <button class="tool-btn" :disabled="saving" @click="resetColors">全还原</button>
                    </div>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <p class="setting-name">关掉窗口时</p>
                    <p class="setting-desc">关掉窗口后它还待在右下角图标里，随时能叫回来；关掉这个就彻底退出</p>
                </div>
                <div class="setting-options">
                    <el-switch
                        v-model="closeToTray"
                        :loading="traySaving"
                        inline-prompt
                        active-text="待着"
                        inactive-text="退出"
                        @change="changeCloseToTray"
                    ></el-switch>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <p class="setting-name">快捷键</p>
                    <p class="setting-desc">窗口藏起来也能用。点一下按键框，直接按你想要的组合键，Esc 反悔</p>
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
                    <button class="folder-btn" :disabled="shortcutSaving" @click="resetShortcuts">换回默认</button>
                </div>
            </div>
            <div class="setting-item setting-item-block">
                <div class="setting-info">
                    <p class="setting-name">整理标签</p>
                    <p class="setting-desc">改名字会一起改掉所有笔记上的标签；删标签只是在摘标签，笔记还在</p>
                </div>
                <div class="setting-options tag-manager">
                    <p v-if="tags.length === 0" class="tag-empty">还没有标签，编辑笔记时就能加</p>
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
                            <button class="folder-btn" @click="startRenameTag(tag)">改名</button>
                            <button class="folder-btn tag-btn-danger" @click="confirmRemoveTag(tag)">删除</button>
                        </span>
                    </div>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <p class="setting-name">备份</p>
                    <p class="setting-desc">一键把笔记和设置存一份，出问题随时能拿回来</p>
                </div>
                <div class="setting-options setting-options-wrap">
                    <button class="folder-btn" :disabled="backingUp" @click="backupData">
                        {{ backingUp ? '备份中…' : '备份全部数据' }}
                    </button>
                    <button class="folder-btn" :disabled="backingUp" @click="importNotes('files')">导入文件</button>
                    <button class="folder-btn" :disabled="backingUp" @click="importNotes('folder')">导入文件夹</button>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-info">
                    <p class="setting-name">存放在哪</p>
                    <p class="setting-desc">想用别的软件改也行，直接打开文件夹就能看到</p>
                </div>
                <div class="setting-options">
                    <button class="folder-btn" :disabled="opening" @click="openFolder('notes')">看笔记</button>
                    <button class="folder-btn" :disabled="opening" @click="openFolder('labels')">看便签</button>
                </div>
            </div>
        </div>
        <el-dialog
            v-model="tagDialogVisible"
title="改个名字"
            width="min(420px, 90vw)"
            @closed="resetTagDialog"
        >
            <span>「{{ tagDialogFrom }}」换个名字</span>
            <br><br>
            <el-input
                v-model="tagDialogValue"
                placeholder="新名字"
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
import { ElButton, ElColorPicker, ElDialog, ElInput, ElMessage, ElMessageBox, ElSwitch } from 'element-plus'
import { applyAccent, applyCustomColors, normalizeCustomColors } from '../utils/theme.js'
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
function remapColors(colors, from, to) {
    const list = {}
    let changed = false
    const key = String(from).toLowerCase()
    Object.keys(colors || {}).forEach(name=>{
        if(name.toLowerCase() !== key){
            list[name] = colors[name]
            return
        }
        changed = true
        const color = colors[name]
        if(color && !list[to]) list[to] = color
    })
    return { list, changed }
}
function remapPinned(pinned, from, to) {
    const list = []
    let changed = false
    const key = String(from).toLowerCase()
    ;(pinned || []).forEach(item=>{
        if(String(item).toLowerCase() !== key){
            list.push(item)
            return
        }
        changed = true
        if(!list.some(one=>String(one).toLowerCase() === String(to).toLowerCase())) list.push(to)
    })
    return { list, changed }
}
// 每个部位一行，标签和说明都放在这里，界面上直接照着渲染。
const COLOR_GROUPS = [
    { part:'page',     label:'页面底色', hint:'笔记区、列表这些大面积的背景' },
    { part:'panel',    label:'面板底色', hint:'标题栏、侧边栏这类成块的区域' },
    { part:'card',     label:'卡片底色', hint:'按钮底、历史面板这类小块' },
    { part:'text',     label:'正文文字', hint:'正文和标题的字色' },
    { part:'textSoft', label:'次要文字', hint:'说明、时间和数量的字色' },
    { part:'line',     label:'分隔线',   hint:'边框和分割线' },
    { part:'accent',   label:'主题色',   hint:'选中态和高亮，上面的主题色也可以改' },
    { part:'danger',   label:'危险提示', hint:'删除、报错这些红字' },
    { part:'sticky',   label:'便签颜色', hint:'便签纸和它的边' }
]
// 成套配色，一键把九个部位都填上，省得一个个挑。
// 「原样」没有颜色值，预览小球就取自带的默认色，免得那一颗是空的。
const DEFAULT_PREVIEW = { page:'#161618', panel:'#1a1b1f', card:'#26272d', text:'#f2f3f5', accent:'#e8d531' }
const PRESET_PREVIEW = ['page', 'panel', 'card', 'text', 'accent']
function presetSwatches(preset) {
    const source = preset && preset.colors && Object.keys(preset.colors).length > 0 ? preset.colors : DEFAULT_PREVIEW
    return PRESET_PREVIEW.map(part => source[part] || DEFAULT_PREVIEW[part])
}
const COLOR_PRESETS = [
    { name:'原样', colors:{} },
    { name:'海盐', colors:{ page:'#eef4f7', panel:'#ffffff', card:'#dde8ee', text:'#173240', textSoft:'#5b7482', line:'#c3d5de', accent:'#0e7490', danger:'#b91c1c', sticky:'#0e7490' } },
    { name:'米纸', colors:{ page:'#f6f1e7', panel:'#fdfaf3', card:'#ece2d0', text:'#3a3226', textSoft:'#7d7161', line:'#ddd0b8', accent:'#a16207', danger:'#a3311c', sticky:'#a16207' } },
    { name:'夜灯', colors:{ page:'#14161c', panel:'#1b1e26', card:'#262b35', text:'#e8ebf2', textSoft:'#949cad', line:'#343a47', accent:'#f0a93b', danger:'#f2545b', sticky:'#f0a93b' } },
    { name:'苔绿', colors:{ page:'#12160f', panel:'#1a1f16', card:'#242b1e', text:'#e6eddc', textSoft:'#9aa88c', line:'#323a2a', accent:'#84cc16', danger:'#e05252', sticky:'#84cc16' } },
    { name:'樱粉', colors:{ page:'#fdf2f4', panel:'#ffffff', card:'#f8e0e6', text:'#3d2129', textSoft:'#8a6570', line:'#eecdd6', accent:'#db2777', danger:'#be123c', sticky:'#db2777' } }
]
function stripColor(colors, tag) {
    const list = {}
    const key = String(tag).toLowerCase()
    Object.keys(colors || {}).forEach(name=>{
        if(name.toLowerCase() !== key) list[name] = colors[name]
    })
    return list
}

export default {
    components:{ ElSwitch, ElDialog, ElInput, ElButton, ElColorPicker },
    data() {
        return {
            theme: currentTheme(),
            accent: '',
            accentDraft: '',
            accentPalette: ['#e5484d','#f76808','#e8d531','#46a758','#12a594','#0090ff','#8e4ec6','#e93d82'],
            colorDraft: {},
            savedColors: {},
            colorGroups: COLOR_GROUPS,
            colorPresets: COLOR_PRESETS,
            cssStatus: '',
            cssTimer: null,
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
        },
        // 预览跟着当前选中的颜色实时变，没选的那几项就显示原来的样子。
        previewStyle() {
            const colors = normalizeCustomColors(this.colorDraft)
            const style = {}
            const set = (name, value) => { if(value) style[name] = value }
            const accent = colors.accent || this.accent
            set('--preview-page', colors.page)
            set('--preview-panel', colors.panel)
            set('--preview-card', colors.card)
            set('--preview-text', colors.text)
            set('--preview-text-soft', colors.textSoft)
            set('--preview-line', colors.line)
            set('--preview-accent', accent)
            set('--preview-danger', colors.danger)
            set('--preview-sticky', colors.sticky)
            return style
        },
        // 有几处和默认不一样，预览上标出来，用户才知道改了什么。
        touchedCount() {
            const colors = normalizeCustomColors(this.colorDraft)
            return Object.keys(colors).length
        }
    },
    methods: {
        presetSwatches,
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
                ElMessage.success('改好啦，立刻生效')
            } catch (error) {
                this.shortcuts = previous
                ElMessage.error(errorText(error) || '没保存成，再试一次')
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
                ElMessage.error('没保存成，再试一次')
            } finally {
                this.saving = false
            }
        },
        async changeAccent(value) {
            const hex = typeof value === "string" ? value.trim().toLowerCase() : ""
            if(this.saving || this.accent === hex) return
            const previous = this.accent
            this.accent = hex
            applyAccent(hex)
            this.saving = true
            try {
                await window.electron.setSetting('accentColor', hex)
            } catch {
                this.accent = previous
                applyAccent(previous)
                ElMessage.error('没保存成，再试一次')
            } finally {
                this.saving = false
            }
        },
        // 换颜色先立刻上看效果，存下去才在下次打开时还在。
        changeColor(part, value) {
            const hex = typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
                ? value.trim().toLowerCase()
                : ""
            const next = Object.assign({}, this.colorDraft)
            if(hex === "") delete next[part]
            else next[part] = hex
            this.colorDraft = next
            this.previewColors()
        },
        usePreset(preset) {
            if(!preset || this.saving) return
            this.colorDraft = Object.assign({}, preset.colors)
            this.previewColors()
        },
        pickColor(part) {
            // 点一下色块就把选择器弹到它旁边，省得再去找输入框
            this.$nextTick(()=>{
                const picker = this.$el.querySelector('.color-grid [data-pick="' + part + '"] .el-color-picker__trigger')
                if(picker && picker.click) picker.click()
            })
        },
        previewColors() {
            if(this.cssTimer) clearTimeout(this.cssTimer)
            const colors = normalizeCustomColors(this.colorDraft)
            applyCustomColors(colors)
            if(colors.accent) applyAccent(colors.accent)
            this.cssTimer = setTimeout(()=>{ this.cssTimer = null },260)
        },
        async saveColors() {
            if(this.saving) return
            const colors = normalizeCustomColors(this.colorDraft)
            this.saving = true
            try {
                await window.electron.setSetting('customColors', colors)
                this.savedColors = colors
                this.cssStatus = '配色存好了'
                setTimeout(()=>{ this.cssStatus = '' },2200)
            } catch {
                this.cssStatus = '没存上，再试一次'
            } finally {
                this.saving = false
            }
        },
        async resetColors() {
            if(this.saving) return
            const previous = this.savedColors
            this.saving = true
            try {
                await window.electron.setSetting('customColors', {})
                this.colorDraft = {}
                this.savedColors = {}
                applyCustomColors({})
                applyAccent(this.accent)
                this.cssStatus = '回到原来的样子了'
                setTimeout(()=>{ this.cssStatus = '' },2200)
            } catch {
                this.colorDraft = previous
                applyCustomColors(previous)
                if(previous.accent) applyAccent(previous.accent)
                this.cssStatus = '没还原成功'
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
                ElMessage.error('没保存成，再试一次')
            } finally {
                this.traySaving = false
            }
        },
        async openFolder(key) {
            if(this.opening) return
            this.opening = true
            try {
                const error = await window.electron.openDataFolder(key)
                if(error) ElMessage.error('打不开：' + error)
            } catch {
                ElMessage.error('打不开')
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
                ElMessage.error('颜色没保存成')
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
                ElMessage.error('没保存成')
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
                this.tagDialogError = '名字不能空着'
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
                ElMessage.success('标签已改名')
            } catch (error) {
                this.tagDialogError = errorText(error) || '没改成功，再试一次'
            } finally {
                this.tagSaving = false
            }
        },
        async migrateTagMeta(from, to) {
            const colors = remapColors(this.tagColors, from, to)
            const pinnedMapped = remapPinned(this.pinnedTags, from, to)
            if(!colors.changed && !pinnedMapped.changed) return
            try {
                await window.electron.setSetting('tagColors', colors.list)
                this.tagColors = colors.list
            }catch{}
            try {
                await window.electron.setSetting('pinnedTags', pinnedMapped.list)
                this.pinnedTags = pinnedMapped.list
            }catch{}
        },
        async confirmRemoveTag(tag) {
            if(this.tagSaving) return
            try {
                await ElMessageBox.confirm(
                    `把「${tag}」从所有笔记上摘下来？笔记本身不会动。`,
                    '摘掉标签',
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
            await this.doRemoveTag(tag)
        },
        async doRemoveTag(tag) {
            this.tagSaving = true
            try {
                await window.electron.removeTag(tag)
                await this.saveTagColors(stripColor(this.tagColors, tag))
                this.pinnedTags = this.pinnedTags.filter(item=>String(item).toLowerCase() !== tag.toLowerCase())
                try {
                    await window.electron.setSetting('pinnedTags', this.pinnedTags)
                }catch{}
                await this.loadTags()
                ElMessage.success('标签已删掉')
            } catch (error) {
                ElMessage.error(errorText(error) || '没删掉，再试一次')
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
                if(created > 0) ElMessage.success('已导入 ' + created + ' 篇笔记')
                if(failed > 0) ElMessage.warning(failed + ' 个文件没能导入')
                if(created === 0 && failed === 0) ElMessage.info('没找到可以导入的内容')
                if(created > 0) await this.loadTags()
            } catch (error) {
                ElMessage.error(errorText(error) || '没导进去，再试一次')
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
                ElMessage.success('备份好了，存在 ' + result.dir)
            } catch (error) {
                ElMessage.error(errorText(error) || '没备份成，再试一次')
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
        window.electron.getSetting('accentColor')
            .then(value=>{
                const hex = typeof value === 'string' ? value : ''
                this.accent = hex
                this.accentDraft = hex || '#e8d531'
            })
            .catch(()=>{
                this.accent = ''
                this.accentDraft = '#e8d531'
            })
        window.electron.getSetting('customColors')
            .then(value=>{
                const colors = normalizeCustomColors(value)
                this.colorDraft = colors
                this.savedColors = colors
            })
            .catch(()=>{
                this.colorDraft = {}
                this.savedColors = {}
            })
    },
    beforeUnmount() {
        document.removeEventListener('keydown',this.onCaptureKeydown,true)
        if(this.cssTimer) clearTimeout(this.cssTimer)
        if(this.offTheme) this.offTheme()
    },
    activated() {
        document.addEventListener('keydown',this.onCaptureKeydown,true)
        this.loadTags()
    },
    deactivated() {
        // 设置页是缓存起来的，离开后必须停手：正处在「请按键…」时点走，会把整页按键都吞掉
        this.capturing = null
        document.removeEventListener('keydown',this.onCaptureKeydown,true)
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
}
.accent-options{
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--block-1);
    border: 1px solid var(--border-1);
}
.accent-options :deep(.el-color-picker__trigger){
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--border-2) inset;
}
.accent-options :deep(.el-color-picker__predefine-color){
    border-radius: 50%;
}
.accent-swatch{
    /* 不写 flex-shrink 的话，颜色一多就会被挤扁成椭圆 */
    box-sizing: border-box;
    flex: 0 0 20px;
    width: 20px;
    height: 20px;
    min-width: 20px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 0 1px var(--border-2) inset;
    transition: transform 0.14s var(--ease), box-shadow 0.14s var(--ease);
}
.accent-swatch:hover:not(:disabled){
    transform: scale(1.12);
}
.accent-swatch.active{
    box-shadow: 0 0 0 2px var(--bg-1), 0 0 0 4px var(--accent);
}
.accent-swatch.default{
    background: conic-gradient(#e5484d,#f76808,#e8d531,#46a758,#0090ff,#8e4ec6,#e5484d);
}
.setting-item-block{
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
}
.color-board{
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.color-main{
    display: flex;
    gap: 16px;
    align-items: flex-start;
}
.color-grid{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 18px;
    flex: 1;
    min-width: 0;
}
.color-row{
    display: grid;
    grid-template-columns: 64px auto;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 3px 8px;
}
.color-label{
    font-size: 12px;
    color: var(--text-1);
    white-space: nowrap;
}
.color-hint{
    grid-column: 1 / -1;
    font-size: 10px;
    line-height: 1.4;
    color: var(--text-2);
}
.color-control{
    display: flex;
    align-items: center;
    gap: 5px;
}
.color-chip{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 22px;
    flex-shrink: 0;
    padding: 0;
    border: 1px solid var(--border-2);
    border-radius: 6px;
    cursor: pointer;
    background: var(--block-1);
    transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease);
}
.color-chip:hover{
    border-color: var(--accent-border);
}
.color-chip.on{
    border-color: var(--accent-border);
    box-shadow: 0 0 0 2px var(--accent-soft);
}
.chip-empty{
    font-size: 9px;
    color: var(--text-2);
}
.color-clear{
    width: 17px;
    height: 17px;
    flex-shrink: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1;
    color: var(--text-2);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.color-clear:hover{
    color: var(--danger);
    background: var(--danger-soft);
}
.color-preview{
    flex-shrink: 0;
    width: 236px;
}
.preview-title{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 11px;
    color: var(--text-2);
}
.preview-count{
    font-size: 10px;
    font-style: normal;
    color: var(--accent-strong);
}
.preview-window{
    display: flex;
    gap: 6px;
    padding: 8px;
    border-radius: var(--radius-2);
    background: var(--preview-page, var(--bg-1));
    border: 1px solid var(--preview-line, var(--border-1));
}
.preview-side{
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 34px;
    flex-shrink: 0;
    padding: 5px;
    box-sizing: border-box;
    border-radius: 5px;
    background: var(--preview-panel, var(--surface-1));
    border: 1px solid var(--preview-line, var(--border-1));
}
.preview-dot{
    width: 100%;
    height: 5px;
    border-radius: 3px;
    background: var(--preview-text-soft, var(--text-2));
    opacity: 0.5;
}
.preview-dot.on{
    background: var(--preview-accent, var(--accent-strong));
    opacity: 1;
}
.preview-body{
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 0;
    padding: 9px;
    border-radius: 5px;
    background: var(--preview-panel, var(--surface-1));
}
.preview-bar{
    width: 58%;
    height: 8px;
    border-radius: 4px;
    background: var(--preview-text, var(--text-1));
}
.preview-line{
    width: 100%;
    height: 5px;
    border-radius: 3px;
    background: var(--preview-text-soft, var(--text-2));
}
.preview-line.wide{
    width: 88%;
}
.preview-line.short{
    width: 62%;
}
.preview-foot{
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
}
.preview-chip,
.preview-note,
.preview-warn{
    padding: 2px 6px;
    font-size: 9px;
    border-radius: 4px;
}
.preview-chip{
    color: var(--on-accent);
    background: var(--preview-accent, var(--accent-strong));
}
.preview-note{
    color: var(--preview-sticky, var(--sticky-strong));
    background: var(--sticky-soft);
    border: 1px solid var(--preview-sticky, var(--sticky-strong));
}
.preview-warn{
    color: var(--preview-danger, var(--danger));
    background: var(--danger-soft);
}
.color-presets{
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border-1);
}
.presets-label{
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-2);
}
.presets-list{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.preset-btn{
    display: flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 9px;
    font-size: 11px;
    color: var(--text-2);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: 13px;
    cursor: pointer;
    transition: color 0.14s var(--ease), border-color 0.14s var(--ease);
}
.preset-btn:hover:not(:disabled){
    color: var(--text-1);
    border-color: var(--accent-border);
}
.preset-btn:disabled{
    opacity: 0.5;
    cursor: default;
}
.preset-swatch{
    width: 9px;
    height: 9px;
    flex-shrink: 0;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--border-2) inset;
}
.preset-name{
    white-space: nowrap;
}
/* 这块的操作按钮比别处更轻，靠位置和分组来区分 */
.tool-btn{
    height: 28px;
    padding: 0 14px;
    font-size: 12px;
    color: var(--text-2);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.14s var(--ease), border-color 0.14s var(--ease), background 0.14s var(--ease);
}
.tool-btn:hover:not(:disabled){
    color: var(--text-1);
    border-color: var(--accent-border);
}
.tool-btn:disabled{
    opacity: 0.5;
    cursor: default;
}
.theme-option-text{
    font-size: 12px;
    color: inherit;
}
.css-actions{
    display: flex;
    align-items: center;
    gap: 8px;
}
.css-status{
    flex: 1;
    font-size: 11px;
    color: var(--text-2);
}
@media (max-width: 620px){
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
