<template>
    <div class="edit-page">
    <div id="header-panel">
        <div class="header-top">
            <h1>{{ noteData.det.title }}</h1>
            <div class="header-side">
                <span class="word-count">{{ wordCountText }}</span>
                <span id="create-time">{{ timeString }}</span>
            </div>
        </div>
        <div class="tag-bar">
            <el-select
                v-model="tagList"
                class="tag-select"
                multiple
                filterable
                allow-create
                default-first-option
                :multiple-limit="3"
                :disabled="tagsSaving"
                placeholder="加个标签，最多 3 个"
                @change="onTagsChange"
            >
                <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag"></el-option>
            </el-select>
            <span v-if="tagsSaving" class="tag-status">存一下</span>
            <span v-if="imageBusy" class="tag-status">放图片</span>
            <div class="view-tools">
                <div class="view-switch" role="group" aria-label="写作方式">
                    <button
                        class="seg-btn"
                        :class="{ on: !reading }"
                        title="边写边看（Ctrl + E）"
                        @click="setReading(false)"
                    ><i class="ic ic-pen"></i><span>编辑</span></button>
                    <button
                        class="seg-btn"
                        :class="{ on: reading }"
                        title="看看排好版的样子"
                        @click="setReading(true)"
                    ><i class="ic ic-eye"></i><span>阅读</span></button>
                </div>
                <span class="tool-div"></span>
                <button
                    class="icon-btn"
                    :class="{ on: uiState.focus }"
                    :title="uiState.focus ? '不专注了' : '只留正文，安心写'"
                    @click="toggleFocus"
                ><i class="ic ic-focus"></i></button>
                <button
                    class="icon-btn"
                    :class="{ on: findOpen }"
                    :title="findOpen ? '关掉查找' : '在这篇里找（Ctrl + F，F3 跳下一个）'"
                    @click="findOpen ? closeFind() : openFind()"
                ><i class="ic ic-find"></i></button>
                <button
                    class="icon-btn"
                    :class="{ on: typewriter }"
                    :title="typewriter ? '光标停在中间，关掉' : '打字机：光标待在中间，别跑偏'"
                    :disabled="reading"
                    @click="typewriter = !typewriter"
                ><i class="ic ic-typewriter"></i></button>
                <button
                    class="icon-btn"
                    :class="{ on: minimapOn }"
                    :title="minimapOn ? '收掉小地图' : '长文有个大概样子，方便跳来跳去'"
                    :disabled="reading"
                    @click="minimapOn = !minimapOn"
                ><i class="ic ic-map"></i></button>
                <span class="tool-div"></span>
                <button
                    class="icon-btn"
                    :class="{ on: backlinksOpen, marked: backlinks.length > 0 }"
                    :title="'哪些笔记提到了这篇（' + backlinks.length + '）'"
                    @click="toggleBacklinks"
                ><i class="ic ic-note"></i><em v-if="backlinks.length > 0" class="dot-badge">{{ backlinks.length }}</em></button>
                <button class="icon-btn" title="看看这篇以前的写法，可以随时退回去" @click="toggleHistory"><i class="ic ic-clock"></i></button>
                <div class="export-wrap">
                    <button
                        class="icon-btn"
                        :class="{ on: exportMenu }"
                        title="把这篇存到电脑上"
                        @click="exportMenu = !exportMenu"
                    ><i class="ic ic-download"></i></button>
                    <div v-if="exportMenu" class="menu-mask" @mousedown="exportMenu = false"></div>
                    <div v-if="exportMenu" class="export-menu" @mousedown.stop @click.stop>
                        <button class="export-item" @click="doExport('pdf')">存成 PDF</button>
                        <button class="export-item" @click="doExport('html')">存成网页</button>
                        <button class="export-item" @click="doExport('md')">存成 Markdown</button>
                    </div>
                </div>
            </div>
        </div>
        <p v-if="ready && showStarterHint" class="starter-hint">
            <i class="ic ic-pen"></i>
            <span>直接往下写就行。找东西按 <kbd>Ctrl</kbd><kbd>F</kbd>，跳到下一个按 <kbd>F3</kbd>。</span>
            <button class="starter-close" title="不再提示" @click="starterHintOff = true">×</button>
        </p>
    </div>
    <div
        class="editor-wrap"
        @paste.capture="onEditorPaste"
        @drop.capture="onEditorDrop"
        @dragover.prevent
    >
        <div ref="editorElement" class="vditor" @keydown.capture="handleKeydown"></div>
        <div v-if="loadError" class="editor-loading">
            <p class="loading-text">这篇没打开成，关掉重开一下</p>
        </div>
        <div v-else-if="!ready" class="editor-loading">
            <div class="loading-skeleton">
                <span class="skeleton-line w90"></span>
                <span class="skeleton-line w70"></span>
                <span class="skeleton-line w85"></span>
                <span class="skeleton-line w60"></span>
                <span class="skeleton-line w75"></span>
            </div>
            <div class="loading-status">
                <span>正在打开…</span>
                <span class="loading-track"><i></i></span>
            </div>
        </div>
        <div v-if="reading" class="reader">
            <div ref="readerElement" class="reader-body"></div>
        </div>
    <div
            v-if="uiState.focus && !reading"
            class="focus-stats"
        >
            <span class="focus-stat">{{ sessionWords > 0 ? '+' + sessionWords : '' }}{{ sessionWords > 0 ? ' 字' : '还没动笔' }}</span>
            <span class="focus-stat-sep"></span>
            <span class="focus-stat">{{ focusClock }}</span>
        </div>
        <NoteMinimap
            v-if="!reading && minimapOn"
            class="note-minimap"
            :markdown="editorText"
            :ratio="scrollRatio"
            @seek="seekByRatio"
        ></NoteMinimap>
        <div
            v-if="findOpen"
            class="find-bar"
        >
            <input
                ref="findInput"
                v-model="findQuery"
                class="find-input"
                placeholder="在这篇里找"
                @input="onFindInput"
                @keydown.enter.prevent="stepFind(1)"
                @keydown.shift.enter.prevent="stepFind(-1)"
                @keydown.esc.prevent="closeFind"
            >
            <span class="find-count">{{ findOpen ? findLabel : '' }}</span>
            <button class="find-btn" title="上一个（Shift + Enter）" :disabled="findHits.length === 0" @click="stepFind(-1)">↑</button>
            <button class="find-btn" title="下一个（Enter）" :disabled="findHits.length === 0" @click="stepFind(1)">↓</button>
            <button class="find-btn find-btn-close" title="关上（F3 / Esc）" @click="closeFind">×</button>
        </div>
        <div
            v-for="box in flashBoxes"
            :key="box.id"
            class="find-flash"
            :style="box.style"
        ></div>
    </div>
    <div v-if="linkMenu" class="link-mask" @mousedown="closeLinkMenu"></div>
    <aside v-if="linkMenu" class="link-panel">
        <div class="link-head">
            <span class="link-title">接上另一篇</span>
            <button class="link-close" title="关闭" @click="closeLinkMenu">×</button>
        </div>
        <input
            ref="linkSearch"
            v-model="linkQuery"
            class="link-search"
            type="text"
            placeholder="找一篇来接上"
            @keydown.esc="closeLinkMenu"
        >
        <div class="link-list">
            <p v-if="linkLoading" class="link-tip">正在找…</p>
            <p v-else-if="linkCandidates.length === 0" class="link-tip">还没有别的笔记可以接。</p>
            <p v-else-if="linkFiltered.length === 0" class="link-tip">没找到。</p>
            <button
                v-for="item in linkFiltered"
                :key="item.time"
                class="link-item"
                @click="insertNoteLink(item)"
            >
                <span class="link-item-title">{{ item.title }}</span>
                <span class="link-item-time">{{ formatStamp(item.time) }}</span>
            </button>
        </div>
    </aside>
    <input ref="imagePicker" class="hidden-picker" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" multiple @change="onPickImages">
    <div v-if="historyOpen" class="history-mask" @mousedown="closeHistory"></div>
    <aside v-if="historyOpen" class="history-panel">
        <div class="history-head">
            <span class="history-title">改过什么</span>
            <span class="history-count">留着最近 {{ historyLimit }} 版 · 现在有 {{ historyItems.length }} 版</span>
            <button class="history-close" title="关闭" @click="closeHistory">×</button>
        </div>
        <div class="history-list">
            <p v-if="historyLoading" class="history-tip">正在找…</p>
            <p v-else-if="historyItems.length === 0" class="history-tip">这篇还没改过几次，保存之后就有了。</p>
            <template v-else>
                <button
                    v-for="item in historyItems"
                    :key="item.stamp"
                    class="history-item"
                    :class="{ active: item.stamp === historyCurrent }"
                    @click="selectHistory(item)"
                >
                    <span class="history-time">{{ formatStamp(item.time) }}</span>
                    <span class="history-size">{{ formatSize(item.size) }}</span>
                </button>
            </template>
        </div>
        <div class="history-foot">
            <div class="history-modes">
                <button class="history-mode" :class="{ active: historyMode === 'diff' }" @click="historyMode = 'diff'">看看改了什么</button>
                <button class="history-mode" :class="{ active: historyMode === 'raw' }" @click="historyMode = 'raw'">看看原文</button>
                <span v-if="historyMode === 'diff' && historyDiff" class="history-stat">
                    <span class="stat-add">+{{ historyDiff.added }}</span>
                    <span class="stat-del">−{{ historyDiff.removed }}</span>
                </span>
            </div>
            <div v-if="historyMode === 'diff'" class="diff-body">
                <p v-if="!historyCurrent" class="history-tip">挑左边一个时间点</p>
                <p v-else-if="diffEmpty" class="history-tip">这一版和现在写的一模一样</p>
                <div v-else class="diff-grid">
                    <div v-for="(row,index) in diffRows" :key="index" class="diff-row" :class="row.pair ? (row.left.kind === 'trim' ? 'kind-trim' : 'kind-pair') : ''">
                        <div class="diff-cell" :class="cellClass(row.left)">
                            <span class="diff-no">{{ row.left ? row.left.left : '' }}</span>
                            <span class="diff-text">{{ row.left ? row.left.text : '' }}</span>
                        </div>
                        <div class="diff-cell" :class="cellClass(row.right)">
                            <span class="diff-no">{{ row.right ? row.right.right : '' }}</span>
                            <span class="diff-text">{{ row.right ? row.right.text : '' }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <pre v-else-if="historyPreview" class="history-preview">{{ historyPreview }}</pre>
            <p v-else class="history-tip">挑一个时间点，看看那时候写成什么样了</p>
            <div class="history-actions">
                <button class="tool-btn" :disabled="!historyCurrent" @click="restoreHistory">回到这一版</button>
            </div>
        </div>
    </aside>
    <div v-if="backlinksOpen" class="back-mask" @mousedown="closeBacklinks"></div>
    <aside v-if="backlinksOpen" class="back-panel">
        <div class="back-head">
            <span class="back-title">谁提到了我</span>
            <span class="back-count">{{ backlinks.length }} 处引用</span>
            <button class="back-close" title="关闭" @click="closeBacklinks">×</button>
        </div>
        <div class="back-list">
            <p v-if="backlinksLoading" class="back-tip">正在找…</p>
            <p v-else-if="backlinks.length === 0" class="back-tip">还没有别的笔记提到这篇。在别的笔记里点「接上另一篇」，这篇就会出现在那儿。</p>
            <button
                v-for="item in backlinks"
                :key="item.kind + '-' + item.time"
                class="back-item"
                @click="openBacklink(item)"
            >
                <span class="back-kind" :class="item.kind">{{ item.kind === "note" ? "笔记" : "便签" }}</span>
                <span class="back-main">
                    <span class="back-item-title">{{ item.title || "未命名" }}</span>
                    <span v-if="item.snippet" class="back-snippet">{{ snippetPreview(item.snippet) }}</span>
                </span>
                <span class="back-side">
                    <span class="back-time">{{ formatStamp(item.time) }}</span>
                    <span v-if="(item.count || 0) > 1" class="back-count-inline">×{{ item.count }}</span>
                </span>
            </button>
        </div>
    </aside>
    </div>
</template>
<script>
import Vditor from 'vditor';
import "vditor/src/assets/less/index.less"
import { ElNotification, ElOption, ElSelect } from "element-plus"
import { markRaw } from 'vue'
import emitter from '../utils/emitter'
import uiState from '../utils/uiState'
import { resolveImageSrc, toPortableMarkdown } from '../utils/noteImage'
import { buildNoteSnippet, noteLinkTid, stripNoteLinksFromHtml, stripNoteLinksFromMarkdown } from '../utils/noteLink'
import { buildTextIndex, findMatches, rectOf, scrollRectIntoView } from '../utils/textFind'
import { diffLines, pairRows } from '../utils/textDiff'
import NoteMinimap from './NoteMinimap.vue'

const HEADER_HEIGHT = 148
const LINK_TARGET_LIMIT = 200

function editorTheme(theme){
    const dark = theme !== 'light'
    return {
        theme: dark ? 'dark' : 'light',
        content: dark ? 'dark' : 'light',
        code: dark ? 'monokai' : 'github',
        dark
    }
}
function readAsBase64(file){
    return new Promise((resolve,reject)=>{
        const reader = new FileReader()
        reader.onload = ()=>{
            const result = String(reader.result == null ? "" : reader.result)
            const comma = result.indexOf(",")
            resolve(comma === -1 ? "" : result.slice(comma+1))
        }
        reader.onerror = ()=>reject(new Error("这张图片读不出来"))
        reader.readAsDataURL(file)
    })
}
function errorText(error){
    const message = String((error && error.message) || error || "")
    const index = message.lastIndexOf("Error: ")
    return index >= 0 ? message.slice(index+7) : message
}

export default {
    components:{ ElOption, ElSelect, NoteMinimap },
    props:{
        noteData:Object
    },
    data(){
        return {
            editor:null,
            ready:false,
            loadError:false,
            tagList:[],
            savedTags:[],
            allTags:[],
            tagsSaving:false,
            disposed:false,
            noteText:"",
            editorText:"",
            reading:false,
            wordCount:0,
            diskVersion:0,
            readId:0,
            pendingSaveContent:null,
            queuedSaveContent:null,
            savePromise:null,
            unsubscribe:null,
            timeString:"",
            imageBusy:false,
            exportMenu:false,
            historyOpen:false,
            historyLoading:false,
            historyItems:[],
            historyLimit:30,
            historyCurrent:"",
            historyPreview:"",
            historyMode:"diff",
            historyDiff:null,
            diffRows:[],
            imageObserver:null,
            imageFrame:null,
            linkMenu:false,
            linkQuery:"",
            linkLoading:false,
            linkTargets:[],
            linkTargetsReady:false,
            backlinksOpen:false,
            backlinksLoading:false,
            backlinks:[],
            findOpen:false,
            findQuery:"",
            lastFindTerm:"",
            findPos:0,
            findHits:[],
            findIndex:null,
            findTimer:null,
            flashBoxes:[],
            flashSeq:0,
            flashTimers:[],
            typewriter:false,
            minimapOn:false,
            scrollRatio:0,
            sessionStart:0,
            sessionBaseWords:0,
            sessionTick:0,
            clockTimer:null,
            starterHintOff:false,
            pendingJump:""
        }
    },
    computed:{
        uiState(){
            return uiState
        },
        wordCountText(){
            return this.wordCount + " 字"
        },
        findLabel(){
            const term = this.findQuery.trim()
            if(term === "") return ""
            if(this.findHits.length === 0) return "这篇里没有"
            return (this.findPos + 1) + " / " + this.findHits.length
        },
        sessionWords(){
            if(this.sessionStart === 0) return 0
            return Math.max(0,this.wordCount - this.sessionBaseWords)
        },
        focusClock(){
            if(this.sessionStart === 0) return "00:00"
            const total = Math.max(0,this.sessionTick)   // 计时按 tick 累计，别用 now-start 再减 tick（那样永远 00:00）
            const mm = String(Math.floor(total / 60)).padStart(2,"0")
            const ss = String(total % 60).padStart(2,"0")
            return mm + ":" + ss
        },
        isDirty(){
            if(!this.ready || !this.editor) return false
            this.editorText      // 读一次挂上依赖：getValue() 不是响应式的，靠输入镜像触发重算
            try{
                return toPortableMarkdown(this.editor.getValue()) !== this.noteText
            }catch{
                return false
            }
        },
        diffEmpty(){
            if(this.historyDiff == null) return false
            return this.historyDiff.added === 0 && this.historyDiff.removed === 0
        },
        // 空白笔记才给一次引导，写过字就不再打扰
        showStarterHint(){
            if(this.starterHintOff) return false
            if(!this.ready) return false
            return String(this.noteText || '').trim().length === 0
        },
        linkCandidates(){
            return this.linkTargets
        },
        focusOn(){
            return uiState.focus
        },
        linkFiltered(){
            const query = this.linkQuery.trim().toLowerCase()
            if(query === "") return this.linkCandidates
            return this.linkCandidates.filter(item=>item.title.toLowerCase().includes(query))
        }
    },
    watch:{
        // 打开打字机就把光标拉到中间，不用等下一次敲键盘
        typewriter(value){
            if(!value || this.reading) return
            this.$nextTick(()=>this.centerCaret())
        },
        // 专注开关可能被侧栏、命令面板改掉，时钟跟着它走而不是只认自己的按钮
        focusOn(value){
            if(value) this.startSessionClock()
            else this.stopSessionClock()
        }
    },
    methods:{
        async loadTags(){
            if(this.disposed) return
            try{
                const all = await window.electron.getTags()
                if(this.disposed) return
                this.allTags = Array.isArray(all) ? all : []
            }catch{}
        },
        syncEditorText(){
            if(!this.editor) return
            try{
                this.setEditorText(toPortableMarkdown(this.editor.getValue()))
            }catch{}
        },
        setupRenderWatcher(){
            if(this.imageObserver || typeof MutationObserver === "undefined") return
            const root = this.$el
            if(!root || typeof root.querySelectorAll !== "function") return
            this.imageObserver = new MutationObserver(()=>this.scheduleRenderSync())
            this.imageObserver.observe(root,{ childList:true, subtree:true })
            this.scheduleRenderSync()
        },
        scheduleRenderSync(){
            if(this.imageFrame != null) return
            const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : fn=>setTimeout(fn,16)
            this.imageFrame = raf(()=>{
                this.imageFrame = null
                this.syncRenderedNodes()
            })
        },
        syncRenderedNodes(){
            if(this.disposed) return
            const root = this.$el
            if(!root || typeof root.querySelectorAll !== "function") return
            if(window.electron && typeof window.electron.noteImageUrl === "function"){
                const tid = this.noteData.time
                const build = (t,name)=>window.electron.noteImageUrl(t,name)
                const href = window.location.href
                const images = root.querySelectorAll("img")
                for(let i=0;i<images.length;i++){
                    const img = images[i]
                    const current = img.getAttribute("src") || ""
                    const target = resolveImageSrc(current,tid,build,href)
                    if(target === "" || target === current) continue
                    img.setAttribute("src",target)
                }
            }
            this.markNoteLinks(root)
        },
        setEditorText(text){
            if(typeof text !== "string") return
            this.editorText = text
        },
        // 让 Vditor 自己数一遍字，交给 counter 回调写回 wordCount
        refreshCounter(){
            if(!this.editor) return
            try{
                const host = this.editor.vditor
                if(host && host.counter && typeof host.counter.render === "function"){
                    host.counter.render(host,this.editor.getValue())
                }
            }catch{}
        },
        scroller(){
            const root = this.$el
            if(!root || typeof root.querySelector !== "function") return null
            if(this.reading) return root.querySelector(".reader") || root
            const surface = this.contentRoot()
            if(surface) return surface
            return root.querySelector(".editor-wrap") || root
        },
        updateScrollRatio(){
            if(!this.pageVisible()) return
            const box = this.scroller()
            if(box == null) return
            const span = box.scrollHeight - box.clientHeight
            const ratio = span > 0 ? box.scrollTop / span : 0
            this.scrollRatio = Math.min(1,Math.max(0,ratio))
        },
        // 切走的标签页还挂着 window 监听，靠这个把快捷键挡在可见页面里
        pageVisible(){
            const el = this.$el
            if(!el || typeof el.getClientRects !== "function") return false
            return el.getClientRects().length > 0
        },
        seekByRatio(ratio){
            const box = this.scroller()
            if(box == null) return
            const span = box.scrollHeight - box.clientHeight
            if(span <= 0) return
            box.scrollTop = Math.min(1,Math.max(0,ratio)) * span
            this.updateScrollRatio()
        },
        centerOnText(text){
            if(typeof text !== "string") return false
            const term = text.trim()
            if(term === "") return false
            const root = this.contentRoot()
            if(root == null) return false
            try{
                if(root.tagName === "TEXTAREA"){
                    const at = String(root.value || "").toLowerCase().indexOf(term.toLowerCase())
                    if(at === -1) return false
                    this.scrollTextarea(root,at)
                    return true
                }
                const index = buildTextIndex(root)
                if(index.parts.length === 0) return false
                const at = index.text.toLowerCase().indexOf(term.toLowerCase())
                if(at === -1) return false
                const box = this.scroller() || root
                let rect = rectOf(index,at,at + term.length)
                if(rect == null) return false
                scrollRectIntoView(box,rect,Math.max(80,box.clientHeight / 3))
                rect = rectOf(index,at,at + term.length)     // 滚动完坐标会变，重取一次再高亮
                this.flashRange(rect)
                return true
            }catch{
                return false
            }
        },
        // 源码模式（textarea）没有 DOM 位置，按行估算滚动
        scrollTextarea(el,at){
            let lineHeight = 22
            try{
                const style = window.getComputedStyle(el)
                lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.7 || 22
            }catch{}
            const lines = String(el.value || "").slice(0,at).split("\n").length - 1
            el.scrollTop = Math.max(0,lines * lineHeight - el.clientHeight / 3)
            this.updateScrollRatio()
        },
        flashRange(rect){
            if(rect == null) return
            const id = ++this.flashSeq
            this.flashBoxes.push({ id:id, style:this.rectStyle(rect) })
            const timer = setTimeout(()=>{
                this.flashTimers = this.flashTimers.filter(item=>item !== timer)
                this.flashBoxes = this.flashBoxes.filter(item=>item.id !== id)
            },1300)
            this.flashTimers.push(timer)
        },
        rectStyle(rect){
            // 高亮框挂在 .editor-wrap 里，按它的位置换算，别用页面滚动量
            const root = this.$el
            const host = root && typeof root.querySelector === "function" ? root.querySelector(".editor-wrap") : null
            const box = host ? host.getBoundingClientRect() : null
            const top = rect.top - (box ? box.top : 0)
            const left = rect.left - (box ? box.left : 0)
            return "top:" + Math.round(top) + "px;left:" + Math.round(left) + "px;width:" + Math.round(rect.width) + "px;height:" + Math.round(rect.height) + "px;"
        },
        openFind(){
            this.findOpen = true
            this.findQuery = this.pendingJump || this.findQuery
            this.pendingJump = ""
            this.$nextTick(()=>{
                const input = this.$refs.findInput
                if(input){
                    input.focus()
                    input.select()
                }
                this.refreshFind()
            })
        },
        closeFind(){
            const last = this.findQuery.trim()
            this.findOpen = false
            this.findQuery = ""
            this.findHits = []
            this.findPos = 0
            this.findIndex = null
            this.flashBoxes = []
            this.lastFindTerm = last
        },
        // 输入框里的词以输入框为准，不依赖 v-model 的更新顺序
        onFindInput(event){
            const el = event && event.target
            if(el && typeof el.value === "string") this.findQuery = el.value
            this.refreshFind()
        },
        refreshFind(){
            if(!this.findOpen) return
            const term = this.findQuery.trim()
            this.lastFindTerm = term
            if(term === ""){
                this.findHits = []
                this.findPos = 0
                this.findIndex = null
                this.flashBoxes = []
                return
            }
            const root = this.contentRoot()
            if(root == null){
                this.findHits = []
                this.findPos = 0
                this.findIndex = null
                return
            }
            if(root.tagName === "TEXTAREA"){
                this.findIndex = { text:String(root.value || ""), parts:[], field:root }
            }else{
                this.findIndex = buildTextIndex(root)
            }
            this.findHits = findMatches(this.findIndex, term)
            if(this.findPos >= this.findHits.length) this.findPos = 0
            if(this.findHits.length > 0) this.gotoFind()
            else this.flashBoxes = []
        },
        stepFind(step){
            if(this.findHits.length === 0) return
            const next = (this.findPos + step + this.findHits.length) % this.findHits.length
            this.findPos = next
            this.gotoFind()
        },
        gotoFind(){
            const hit = this.findHits[this.findPos]
            if(hit == null || this.findIndex == null) return
            const index = this.findIndex
            if(index.field){
                if(!index.field.isConnected){ this.refreshFind(); return }
                this.scrollTextarea(index.field,hit.start)
                return
            }
            let rect = rectOf(index,hit.start,hit.end)
            if(rect == null) return
            const box = this.scroller()
            if(box){
                const boxRect = box.getBoundingClientRect()
                scrollRectIntoView(box,rect,Math.max(80,boxRect.height / 3))
            }else{
                window.scrollTo({
                    top:window.scrollY + rect.top - window.innerHeight / 3,
                    behavior:"smooth"
                })
            }
            rect = rectOf(index,hit.start,hit.end)      // 滚动后再取一次，坐标才是现在的
            if(rect != null) this.flashRange(rect)
        },
        contentRoot(){
            const root = this.$el
            if(root == null || typeof root.querySelector !== "function") return null
            if(this.reading) return root.querySelector(".reader-body") || root
            const surface = this.activeSurface()
            if(surface) return surface
            return root.querySelector(".reader-body")
        },
        // 当前模式的编辑面（ir/wysiwyg 是 pre，sv 是 textarea），用官方 getCurrentMode 判断
        activeSurface(){
            const editor = this.editor
            if(editor && typeof editor.getCurrentMode === "function"){
                try{
                    const host = editor.vditor && editor.vditor[editor.getCurrentMode()]
                    if(host && host.element) return host.element
                }catch{}
            }
            const root = this.$el
            if(root == null || typeof root.querySelectorAll !== "function") return null
            const list = root.querySelectorAll(".vditor-reset")
            for(let i = 0; i < list.length; i++){
                if(list[i].getClientRects().length > 0) return list[i]
            }
            return null
        },
        currentMarkdown(){
            if(this.ready && this.editor){
                try{
                    const value = this.editor.getValue()
                    if(typeof value === "string") return toPortableMarkdown(value)
                }catch{}
            }
            return this.editorText || this.noteText || ""
        },
        toggleFocus(){
            // 时钟的启停交给 focusOn 监听，这里只管翻开关（侧栏和命令面板也会改这个开关）
            uiState.focus = !uiState.focus
        },
        toggleReading(){
            this.setReading(!this.reading)
        },
        setReading(value){
            if(this.reading === value) return
            this.reading = value
            if(value){
                this.closeFind()
                this.renderReader()
                return
            }
            this.$nextTick(()=>this.scheduleRenderSync())
        },
        renderReader(){
            this.$nextTick(()=>{
                const target = this.$refs.readerElement
                if(!target || this.disposed) return
                const style = editorTheme(document.documentElement.getAttribute('data-theme'))
                const markdown = this.currentMarkdown()
                try{
                    Promise.resolve(Vditor.preview(target,markdown,{
                        mode:style.dark ? "dark" : "light",
                        hljs:{
                            enable:true,
                            lineNumber:true,
                            style:style.code
                        },
                        anchor:0,
                        math:{
                            engine:"MathJax"
                        }
                    })).catch(()=>{
                        if(!this.disposed && target) target.textContent = markdown
                    })
                }catch{
                    target.textContent = markdown
                }
            })
        },
        async onTagsChange(value){
            const tags = (Array.isArray(value) ? value : [])
                .filter(item=>typeof item === "string")
                .map(item=>item.trim())
                .filter(Boolean)
            if(tags.length > 3){
                this.tagList = [...this.savedTags]
                this.notify("提示","最多只能挂 3 个标签","warning")
                return
            }
            if(this.tagsSaving) return
            const previous = [...this.savedTags]
            this.tagsSaving = true
            try{
                const result = await window.electron.setNoteTags(this.noteData.time, tags)
                if(this.disposed) return
                this.savedTags = [...result.tags]
                this.tagList = [...result.tags]
                this.allTags = Array.isArray(result.allTags) ? result.allTags : this.allTags
            }catch{
                if(!this.disposed){
                    this.tagList = previous
                    this.notify("错误","标签没存上","error")
                }
            }finally{
                this.tagsSaving = false
            }
        },
        handleKeydown(event){
            if((event.ctrlKey || event.metaKey) && !event.repeat && event.key.toLowerCase() === "s"){
                event.preventDefault()
                event.stopPropagation()
                this.save()
            }
        },
        formatStamp(time){
            const date = new Date(Number(time))
            if(Number.isNaN(date.getTime())) return "未知时间"
            const pad = value=>String(value).padStart(2,"0")
            return date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate())+" "+pad(date.getHours())+":"+pad(date.getMinutes())+":"+pad(date.getSeconds())
        },
        formatSize(size){
            const value = Number(size)
            if(!Number.isFinite(value)) return ""
            if(value < 1024) return value + " B"
            if(value < 1024*1024) return (value/1024).toFixed(1) + " KB"
            return (value/1024/1024).toFixed(2) + " MB"
        },
        insertAtCaret(target){
            if(!this.editor) return
            const mode = this.editorMode()
            const snippet = mode === "wysiwyg"
                ? '<img src="'+target+'" alt="">'
                : "![]("+target+")"
            try{
                this.editor.insertValue(snippet,true)
            }catch{
                this.editor.insertValue(snippet)
            }
        },
        insertSnippetAtCaret(snippet){
            if(!this.editor) return
            try{
                this.editor.insertValue(snippet,true)
            }catch{
                this.editor.insertValue(snippet)
            }
        },
        pickImages(){
            const picker = this.$refs.imagePicker
            if(!picker) return
            picker.value = ""
            picker.click()
        },
        async onPickImages(event){
            const input = event.target
            const files = input.files ? Array.from(input.files) : []
            input.value = ""
            if(files.length === 0) return
            await this.insertImages(files)
        },
        async loadLinkTargets(){
            this.linkLoading = true
            this.linkTargetsReady = false
            try{
                const result = await window.electron.getNoteList()
                if(this.disposed) return
                const notes = Array.isArray(result?.notes) ? result.notes : []
                const self = String(this.noteData.time)
                this.linkTargets = notes
                    .filter(note=>String(note.time) !== self)
                    .map(note=>({ time:note.time, title:String((note.det || {}).title || "未命名") }))
                    .sort((a,b)=>Number(b.time) - Number(a.time))
                    .slice(0,LINK_TARGET_LIMIT)
                this.linkTargetsReady = true
            }catch{
                if(!this.disposed) this.linkTargets = []
            }finally{
                if(!this.disposed){
                    this.linkLoading = false
                    this.scheduleRenderSync()      // 拿到结果再刷新一次失效标记
                }
            }
        },
        toggleLinkMenu(){
            if(this.linkMenu){
                this.closeLinkMenu()
                return
            }
            this.linkMenu = true
            this.linkQuery = ""
            this.loadLinkTargets()
            this.$nextTick(()=>{
                const input = this.$refs.linkSearch
                if(input) input.focus()
            })
        },
        closeLinkMenu(){
            this.linkMenu = false
            this.linkQuery = ""
        },
        toggleBacklinks(){
            if(this.backlinksOpen){
                this.closeBacklinks()
                return
            }
            this.backlinksOpen = true
            this.refreshBacklinks()
        },
        closeBacklinks(){
            this.backlinksOpen = false
            this.backlinks = []
        },
        async refreshBacklinks(){
            if(this.disposed || !this.backlinksOpen) return
            this.backlinksLoading = true
            try{
                const result = await window.electron.getNoteBacklinks(this.noteData.time)
                if(this.disposed || !this.backlinksOpen) return
                this.backlinks = Array.isArray(result?.results) ? result.results : []
            }catch{
                if(!this.disposed) this.backlinks = []
            }finally{
                if(!this.disposed) this.backlinksLoading = false
            }
        },
        snippetPreview(snippet){
            if(!snippet) return ""
            const text = String(snippet.text == null ? "" : snippet.text).replace(/\s+/g," ").trim()
            return (snippet.prefix ? "…" : "") + text + (snippet.suffix ? "…" : "")
        },
        openBacklink(item){
            if(!item) return
            if(item.kind === "sticky"){
                window.electron.openSticky(item.time).catch(()=>this.notify("错误","这张便签没打开成","error"))
                return
            }
            this.closeBacklinks()
            this.openLinkedNote(String(item.time))
        },
        insertNoteLink(item){
            if(!item || item.time == null) return
            if(String(item.time) === String(this.noteData.time)){
                this.notify("提示","不能接到自己","warning")
                return
            }
            this.closeLinkMenu()
            this.insertSnippetAtCaret(buildNoteSnippet(item.time,item.title,this.editorMode()))
            this.syncEditorText()
            this.save()
        },
        editorMode(){
            if(!this.editor) return "ir"
            try{
                if(typeof this.editor.getCurrentMode === "function") return this.editor.getCurrentMode()
            }catch{}
            return "ir"
        },
        async openLinkedNote(tid){
            if(tid === "") return
            if(String(tid) === String(this.noteData.time)){
                this.notify("提示","不能接到自己","warning")
                return
            }
            let notes = []
            try{
                const result = await window.electron.getNoteList()      // 每次点击都重新读，避免缓存里的旧数据
                if(this.disposed) return
                notes = Array.isArray(result?.notes) ? result.notes : []
            }catch{
                notes = []
            }
            const target = notes.find(note=>String(note.time) === String(tid))
            if(target == null){
                this.notify("提示","接上的那篇已经不在了","warning")
                await this.loadLinkTargets()                            // 顺手刷新，失效链接立刻变灰
                return
            }
            emitter.emit("add-tab",{
                title:String((target.det || {}).title || "未命名"),
                props:{ noteData:target },
                closable:true
            })
        },
        onRenderedClick(event){
            const node = event.target
            if(!node || typeof node.closest !== "function") return
            const anchor = node.closest("a[href]")
            if(!anchor) return
            const tid = noteLinkTid(anchor.getAttribute("href"))
            if(tid === "") return
            event.preventDefault()                                        // 别让浏览器去解析这个协议
            event.stopPropagation()
            this.openLinkedNote(tid)
        },
        markNoteLinks(root){
            if(typeof root.querySelectorAll !== "function") return
            // 列表没加载完、加载失败或被截断（超过 LINK_TARGET_LIMIT）时不确定哪些链接已失效，先不标灰
            const settled = this.linkTargetsReady && !this.linkLoading && this.linkTargets.length < LINK_TARGET_LIMIT
            const alive = new Set(this.linkTargets.map(item=>String(item.time)))
            const anchors = root.querySelectorAll("a[href]")
            for(let i=0;i<anchors.length;i++){
                const anchor = anchors[i]
                const tid = noteLinkTid(anchor.getAttribute("href"))
                if(tid === "") continue
                const dead = settled && !alive.has(tid)
                anchor.classList.toggle("note-link-dead",dead)
                anchor.setAttribute("title",dead ? "这篇已经不在了" : "点开这篇")
            }
        },
        async insertImages(files){
            if(this.disposed || files.length === 0) return
            this.imageBusy = true
            try{
                for(const file of files){
                    try{
                        const base64 = await readAsBase64(file)
                        if(base64 === "") throw new Error("这张图片读不出来")
                        const result = await window.electron.saveNoteImage(this.noteData.time,base64,file.type)
                        if(this.disposed) return
                        this.insertAtCaret(result.path)
                    }catch(error){
                        if(this.disposed) return
                        this.notify("错误",errorText(error) || "图片没放进去","error")
                    }
                }
                this.syncEditorText()
            }finally{
                this.imageBusy = false
            }
        },
        async onEditorPaste(event){
            const items = event.clipboardData ? event.clipboardData.items : null
            if(!items) return
            const files = []
            for(let i=0;i<items.length;i++){
                const item = items[i]
                if(item.kind !== "file" || !String(item.type || "").startsWith("image/")) continue
                const file = item.getAsFile()
                if(file) files.push(file)
            }
            if(files.length === 0) return
            event.preventDefault()
            event.stopPropagation()
            await this.insertImages(files)
        },
        async onEditorDrop(event){
            const list = event.dataTransfer ? event.dataTransfer.files : null
            if(!list || list.length === 0) return
            const files = Array.from(list).filter(file=>String(file.type || "").startsWith("image/"))
            if(files.length === 0){
                // 非图片文件同样拦下默认行为，否则 Electron 会把整个窗口导航到被拖入的文件
                event.preventDefault()
                return      // 其余交给 Vditor 自己处理纯文本拖放
            }
            event.preventDefault()             // 不拦住的话 Electron 会把窗口导航到被拖入的文件
            event.stopPropagation()
            await this.insertImages(files)
        },
        async doExport(format){
            this.exportMenu = false
            if(format === "md"){
                try{
                    const result = await window.electron.exportContent("note",this.noteData.time)
                    if(result && result.canceled) return
                    this.notify("完成","Markdown 存好了","success")
                }catch(error){
                    this.notify("错误",errorText(error) || "没导出成","error")
                }
                return
            }
            let html = ""
            try{ html = this.editor.getHTML() }catch{ html = "" }
            try{
                const result = await window.electron.exportNoteDoc(this.noteData.time,format,html)
                if(this.disposed) return
                if(!result || result.canceled) return
                const name = String(result.filePath).split(/[\\/]/).pop()
                this.notify("完成","存好了 " + name,"success")
            }catch(error){
                if(!this.disposed) this.notify("错误",errorText(error) || "没导出成","error")
            }
        },
        async toggleHistory(){
            if(this.historyOpen){
                this.closeHistory()
                return
            }
            this.historyOpen = true
            this.historyCurrent = ""
            this.historyPreview = ""
            await this.loadHistory()
        },
        closeHistory(){
            this.historyOpen = false
            this.historyCurrent = ""
            this.historyPreview = ""
            this.historyDiff = null
            this.diffRows = []
        },
        cellClass(cell){
            if(cell == null) return "cell-empty"
            if(cell.kind === "add") return "cell-add"
            if(cell.kind === "del") return "cell-del"
            if(cell.kind === "trim") return "cell-trim"
            return "cell-same"
        },
        async loadHistory(){
            this.historyLoading = true
            try{
                const result = await window.electron.getNoteHistory(this.noteData.time)
                if(this.disposed || !this.historyOpen) return
                this.historyItems = Array.isArray(result?.items) ? result.items : []
                this.historyLimit = Number(result?.limit) > 0 ? Number(result.limit) : 30
            }catch{
                if(!this.disposed) this.historyItems = []
            }finally{
                this.historyLoading = false
            }
        },
        async selectHistory(item){
            if(!item || !item.stamp) return
            this.historyCurrent = item.stamp
            this.historyPreview = "读取中…"
            try{
                const content = await window.electron.readNoteHistory(this.noteData.time,item.stamp)
                if(this.disposed || this.historyCurrent !== item.stamp) return
                this.historyPreview = String(content == null ? "" : content)
                this.computeDiff(this.historyPreview)
            }catch{
                if(!this.disposed) this.historyPreview = "读取失败"
            }
        },
        computeDiff(oldText){
            let result
            try{
                result = diffLines(oldText,this.currentMarkdown())
            }catch{
                result = null
            }
            if(result == null || !Array.isArray(result.rows)){
                this.historyDiff = null
                this.diffRows = []
                return
            }
            this.historyDiff = result
            this.diffRows = pairRows(result.rows)
        },
        async restoreHistory(){
            if(!this.historyCurrent) return
            const stamp = this.historyCurrent
            try{
                const result = await window.electron.restoreNoteHistory(this.noteData.time,stamp)
                if(this.disposed) return
                if(result !== "success") throw new Error(String(result))
                this.diskVersion++
                if(this.editor){
                    this.editor.setValue(this.historyPreview)
                    try{ this.noteText = this.editor.getValue() }catch{}
                    this.setEditorText(this.noteText)
                    if(this.reading) this.renderReader()
                }
                this.historyCurrent = ""
                this.historyPreview = ""
                this.historyDiff = null
                this.diffRows = []
                await this.loadHistory()
                this.notify("完成","回到那一版了","success")
            }catch(error){
                if(!this.disposed) this.notify("错误",errorText(error) || "没退回去","error")
            }
        },
        notify(title,message,type){
            ElNotification({
                id:`note-save-${this.noteData.time}`,
                title,
                message,
                type,
                position:"bottom-right"
            })
        },
        applyFileUpdate(note){
            if(note?.deleted) return
            // 便签删除、列表变更这类广播没有正文，混进来会把 noteText 冲掉
            if(typeof note.content !== "string") return
            if(String(note.tid) !== String(this.noteData.time)) return
            if(note.content === this.noteText) return
            const current = this.ready ? toPortableMarkdown(this.editor.getValue()) : null
            const ownSave = note.content === this.pendingSaveContent
            const canUpdate = !this.ready || current === this.noteText
            this.diskVersion++
            this.noteText = note.content
            if(!this.ready || current === note.content || ownSave) return
            if(canUpdate){
                this.editor.setValue(note.content)
                try{this.noteText = toPortableMarkdown(this.editor.getValue())}catch{}
                this.setEditorText(note.content)
                if(this.reading) this.renderReader()      // 阅读模式下外部改动也要跟着重排
            }else{
                this.notify("提示","这篇在别处被改过了，你写的内容先留着","warning")
            }
        },
        async refreshFromDisk(){
            if(this.disposed || !this.editor) return
            const request = ++this.readId
            const version = this.diskVersion
            try{
                const content = await window.electron.getNoteContent(this.noteData.time)
                if(this.disposed || request !== this.readId || version !== this.diskVersion) return
                this.applyFileUpdate({tid:this.noteData.time,content})
            }catch{}
        },
        async save(){
            if(!this.ready || !this.editor || this.disposed) return false
            let content
            try{
                content = toPortableMarkdown(this.editor.getValue())
            }catch{
                this.notify("错误","还没准备好，稍等一下","error")
                return false
            }
            if(this.savePromise){
                this.queuedSaveContent = content
                return this.savePromise
            }
            this.queuedSaveContent = content
            this.savePromise = Promise.resolve().then(()=>this.saveContent())
            return this.savePromise
        },
        async saveContent(){
            let ok = true
            try{
                while(this.queuedSaveContent !== null && !this.disposed){
                    const content = this.queuedSaveContent
                    this.queuedSaveContent = null
                    this.pendingSaveContent = content
                    try{
                        const result = await window.electron.saveNote(this.noteData.time,content)
                        if(this.disposed) return false
                        if(result !== "success") throw new Error(result)
                        this.noteText = content
                        this.setEditorText(content)
                        this.notify("完成","存好了","success")
                    }catch{
                        // 这次没存上也不能吞掉排队里的新内容，接着存更新的那一版
                        ok = false
                        if(!this.disposed) this.notify("错误","没存上","error")
                    }finally{
                        if(this.pendingSaveContent === content) this.pendingSaveContent = null
                    }
                }
                return ok && !this.disposed
            }finally{
                this.savePromise = null
                this.queuedSaveContent = null
                this.pendingSaveContent = null
            }
        },
        applyTheme(theme){
            if(!this.editor) return
            const target = editorTheme(theme)
            try{
                this.editor.setTheme(target.theme,target.content,target.code)
            }catch{}
            if(this.reading) this.renderReader()
        },
        createVditor(){
            if(this.disposed || this.editor) return
            const editor = new Vditor(this.$refs.editorElement,{
                preview:{
                    hljs:{
                        enable:true,
                        lineNumber:true,
                        style:"monokai"
                    }
                },
                cache:{
                    enable:false
                },
                mode:"ir",
                counter:{
                    enable:true,
                    type:"text",
                    after:(length)=>{
                        if(this.disposed) return
                        this.wordCount = Number(length) || 0
                    }
                },
                input:(md)=>{
                    if(this.disposed) return
                    this.setEditorText(md)
                    this.onEditorCaretChange()
                },
                focus:()=>this.onEditorCaretChange(),
                keydown:()=>this.onEditorCaretChange(),
                unSelect:()=>this.onEditorCaretChange(),
                after:()=>this.onEditorReady(editor),
                height:`calc( 100% - ${HEADER_HEIGHT}px )`,
                outline:{
                    enable:true
                },
                toolbar:this.editorToolbar(),
            })
            this.editor = markRaw(editor)
        },
onEditorReady(editor){
            if(this.disposed){
                try{editor.destroy()}catch{}
                return
            }
            editor.setValue(this.noteText)
            try{this.noteText = toPortableMarkdown(editor.getValue())}catch{}
            this.syncEditorText()
            const target = editorTheme(document.documentElement.getAttribute('data-theme'))
            editor.setTheme(target.theme,target.content,target.code)
            this.ready = true
            this.refreshCounter()
            if(uiState.focus) this.startSessionClock()
            this.$nextTick(()=>this.updateScrollRatio())
            if(this.pendingJump){
                this.$nextTick(()=>this.runPendingJump())
            }
        },
        editorToolbar(){
            return [
                "emoji","headings","bold","italic","strike","|"
                ,"line","quote","list","ordered-list","check" ,"outdent"
                ,"indent","code","inline-code","insert-after","insert-before"
                ,"link","table","|",
                {
                    name: 'insert-image',
                    tipPosition: 's',
                    tip: '放张图片',
                    icon: '<i class="dnote-icon-image"></i>',
                    click:()=>this.pickImages()
                },
                {
                    name: 'insert-note-link',
                    tipPosition: 's',
                    tip: '接上另一篇',
                    icon: '<i class="dnote-icon-note-link"></i>',
                    click:()=>this.toggleLinkMenu()
                },
                "|","undo","redo","|","edit-mode","|",
                {
                    name: 'save',
                    tipPosition: 's',
                    tip: '存一下',
                    className: 'right',
                    icon: '<i class="dnote-icon-save"></i>',
                    click:()=>this.save()
                },
            ]
        },
        onNoteSetChanged(payload){
            if(this.disposed) return
            // 重命名广播带 {tid,title}，把本页标题同步过来；删除广播是数字 tid，这里自动跳过
            if(payload && typeof payload === "object" && payload.tid != null
                && String(payload.tid) === String(this.noteData.time)
                && typeof payload.title === "string"
                && this.noteData.det && this.noteData.det.title !== payload.title){
                this.noteData.det.title = payload.title
            }
            this.loadLinkTargets()
            this.refreshBacklinks()
        },
        onInnerScroll(event){
            const target = event && event.target
            if(target && target.nodeType === 1) this.updateScrollRatio()
        },
        onNoteJump(payload){
            if(!payload) return
            const tid = String(payload.tid || "")
            if(tid !== String(this.noteData.time)) return
            this.pendingJump = String(payload.term || "")
            // 编辑器早就就绪的话不会再走 ready 流程，当场跳
            if(this.ready && this.editor) this.$nextTick(()=>this.runPendingJump())
        },
        runPendingJump(){
            if(this.pendingJump === "" || !this.ready || !this.editor) return
            const term = this.pendingJump
            this.pendingJump = ""
            this.$nextTick(()=>this.centerOnText(term))
        },
        onWindowKeydown(event){
            if(!this.pageVisible()) return
            if(!this.ready || !this.editor) return
            const ctrl = event.ctrlKey || event.metaKey
            if(ctrl && event.key.toLowerCase() === "s"){
                // 焦点不在编辑器里（标签、查找框等）时编辑器自己拦不到，窗口级再兜一次
                event.preventDefault()
                this.save()
                return
            }
            if(ctrl && event.key.toLowerCase() === "f"){
                event.preventDefault()
                this.openFind()
                return
            }
            if(event.key === "F3"){
                event.preventDefault()
                if(this.findOpen) this.stepFind(event.shiftKey ? -1 : 1)
                else{
                    this.findQuery = this.lastFindTerm || ""
                    this.openFind()
                }
                return
            }
            if(event.key === "Escape" && this.findOpen){
                event.preventDefault()
                this.closeFind()
            }
        },
        onEditorCaretChange(){
            if(!this.typewriter || this.reading) return
            if(this.findOpen) return
            this.$nextTick(()=>this.centerCaret())
        },
        centerCaret(){
            const box = this.scroller()
            if(box == null) return
            const sel = typeof window !== "undefined" ? window.getSelection() : null
            if(sel == null || sel.rangeCount === 0 || sel.anchorNode == null) return
            if(!(this.contentRoot() || box).contains(sel.anchorNode)) return
            const range = document.createRange()
            try{
                range.setStart(sel.anchorNode,sel.anchorOffset)
                range.setEnd(sel.anchorNode,sel.anchorOffset)
            }catch{
                return
            }
            let rect = range.getBoundingClientRect()
            if((rect == null || (rect.width === 0 && rect.height === 0)) && sel.anchorNode.parentElement != null){
                rect = sel.anchorNode.parentElement.getBoundingClientRect()
            }
            if(rect == null || rect.height === 0) return
            const boxRect = box.getBoundingClientRect()
            const offset = rect.top - boxRect.top - boxRect.height / 2 + rect.height / 2
            box.scrollTop += offset
            this.updateScrollRatio()
        },
        startSessionClock(){
            this.sessionStart = Date.now()
            this.sessionTick = 0
            this.sessionBaseWords = this.wordCount
            if(this.clockTimer) clearInterval(this.clockTimer)
            this.clockTimer = setInterval(()=>{
                if(this.disposed){
                    clearInterval(this.clockTimer)
                    this.clockTimer = null
                    return
                }
                this.sessionTick++
            },1000)
        },
        stopSessionClock(){
            if(this.clockTimer){
                clearInterval(this.clockTimer)
                this.clockTimer = null
            }
        }
    },
    async mounted(){
        document.documentElement.style.setProperty('--editor-header-height', HEADER_HEIGHT + 'px')
        this.unsubscribe = window.electron.onNoteUpdated(note=>{
            this.applyFileUpdate(note)
            this.refreshBacklinks()
        })
        emitter.on('theme-changed',this.applyTheme)
        emitter.on('note-deleted',this.onNoteSetChanged)
        emitter.on('note-renamed',this.onNoteSetChanged)
        emitter.on('note-jump',this.onNoteJump)
        this.setupRenderWatcher()
        if(this.$el && typeof this.$el.addEventListener === "function"){
            this.$el.addEventListener("click",this.onRenderedClick,true)   // 捕获阶段抢在编辑器自己的链接处理之前
            this.$el.addEventListener("scroll",this.onInnerScroll,true)
        }
        if(typeof window !== "undefined"){
            window.addEventListener("keydown",this.onWindowKeydown)
            window.addEventListener("resize",this.updateScrollRatio)
        }
        const initialTags = Array.isArray(this.noteData.tags) ? this.noteData.tags.filter(item=>typeof item === "string" && item.trim()) : []
        this.savedTags = [...initialTags]
        this.tagList = [...initialTags]
        this.loadTags()
        this.loadLinkTargets()
        const version = this.diskVersion
        try{
            const content = await window.electron.getNoteContent(this.noteData.time)
            const date = new Date()
            date.setTime(this.noteData.time)
            this.timeString = "创建于 - "+date.toLocaleDateString()
            if(this.disposed) return
            if(version === this.diskVersion) this.noteText = content
            this.createVditor()
        }catch{
            this.loadError = true
            this.notify("错误","这篇没打开成","error")
        }
    },
    activated(){
        this.loadTags()
        this.refreshFromDisk()
        this.syncEditorText()
        if(this.reading) this.renderReader()
        this.scheduleRenderSync()
        this.refreshBacklinks()
        this.$nextTick(()=>this.runPendingJump())
    },
    beforeUnmount(){
        this.disposed = true
        this.readId++
        if(this.imageObserver){
            this.imageObserver.disconnect()
            this.imageObserver = null
        }
        if(this.imageFrame != null){
            if(typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.imageFrame)
            else clearTimeout(this.imageFrame)
            this.imageFrame = null
        }
        if(this.findTimer) clearTimeout(this.findTimer)
        this.flashTimers.forEach(timer=>clearTimeout(timer))
        this.flashTimers = []
        this.stopSessionClock()
        if(this.$el && typeof this.$el.removeEventListener === "function"){
            this.$el.removeEventListener("click",this.onRenderedClick,true)
            this.$el.removeEventListener("scroll",this.onInnerScroll,true)
        }
        if(typeof window !== "undefined"){
            window.removeEventListener("keydown",this.onWindowKeydown)
            window.removeEventListener("resize",this.updateScrollRatio)
        }
        if(this.unsubscribe) this.unsubscribe()
        emitter.off('theme-changed',this.applyTheme)
        emitter.off('note-deleted',this.onNoteSetChanged)
        emitter.off('note-renamed',this.onNoteSetChanged)
        emitter.off('note-jump',this.onNoteJump)
        if(this.editor){
            try{this.editor.destroy()}catch{}
        }
    }
}
</script>
<style scoped>
.edit-page{
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}
#header-panel{
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 12;
    box-sizing: border-box;
    height: var(--editor-header-height, 148px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    padding: 0 24px;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-1);
}
.header-top{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}
#header-panel h1{
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.header-side{
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}
.word-count{
    flex-shrink: 0;
    padding: 5px 12px;
    font-size: 13px;
    color: var(--text-2);
    font-family: var(--font-en);
    white-space: nowrap;
    border: 1px solid var(--border-1);
    border-radius: 999px;
    background: var(--block-1);
}
#create-time{
    flex-shrink: 0;
    padding: 5px 12px;
    font-size: 13px;
    color: var(--text-2);
    font-family: var(--font-en);
    white-space: nowrap;
    border: 1px solid var(--border-1);
    border-radius: 999px;
    background: var(--block-1);
}
.view-tools{
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
}
.view-switch{
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: 9px;
    background: var(--block-1);
    border: 1px solid var(--border-1);
}
.seg-btn{
    display: flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 10px;
    font-size: 12px;
    color: var(--text-2);
    background: transparent;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.14s var(--ease), background 0.14s var(--ease);
}
.seg-btn .ic{
    width: 13px;
    height: 13px;
    opacity: 0.75;
}
.seg-btn:hover{
    color: var(--text-1);
}
.seg-btn.on{
    color: var(--text-1);
    background: var(--block-2);
    box-shadow: 0 1px 2px var(--shadow-1);
}
.seg-btn.on .ic{
    color: var(--accent-strong);
    opacity: 1;
}
.tool-div{
    width: 1px;
    height: 16px;
    margin: 0 5px;
    background: var(--border-1);
}
.icon-btn{
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--text-2);
    background: transparent;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    transition: color 0.14s var(--ease), background 0.14s var(--ease);
}
.icon-btn .ic{
    width: 16px;
    height: 16px;
}
.icon-btn:hover:not(:disabled){
    color: var(--text-1);
    background: var(--hover-1);
}
.icon-btn:disabled{
    opacity: 0.32;
    cursor: default;
}
.icon-btn.on{
    color: var(--accent-strong);
    background: var(--accent-soft);
}
.icon-btn.marked{
    color: var(--accent-strong);
}
.icon-btn .dot-badge{
    position: absolute;
    top: 1px;
    right: 1px;
    min-width: 13px;
    height: 13px;
    padding: 0 3px;
    box-sizing: border-box;
    border-radius: 7px;
    font-size: 9px;
    font-style: normal;
    line-height: 13px;
    text-align: center;
    color: var(--on-accent);
    background: var(--accent-strong);
}
/* 小地图贴着右侧，顶部避开标题栏；它自带背景，不会透出正文 */
.note-minimap{
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
}
.note-minimap :deep(.doc-map){
    pointer-events: auto;
}
.ic{
    display: inline-block;
    background-color: currentColor;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
}
.ic-pen{
    -webkit-mask-image: var(--icon-pen);
    mask-image: var(--icon-pen);
}
.ic-eye{
    -webkit-mask-image: var(--icon-eye);
    mask-image: var(--icon-eye);
}
.ic-focus{
    -webkit-mask-image: var(--icon-focus);
    mask-image: var(--icon-focus);
}
.ic-find{
    -webkit-mask-image: var(--icon-find);
    mask-image: var(--icon-find);
}
.ic-typewriter{
    -webkit-mask-image: var(--icon-typewriter);
    mask-image: var(--icon-typewriter);
}
.ic-map{
    -webkit-mask-image: var(--icon-map);
    mask-image: var(--icon-map);
}
.ic-clock{
    -webkit-mask-image: var(--icon-clock);
    mask-image: var(--icon-clock);
}
.ic-download{
    -webkit-mask-image: var(--icon-download);
    mask-image: var(--icon-download);
}
.ic-note{
    -webkit-mask-image: var(--icon-note);
    mask-image: var(--icon-note);
}
.ic-tag{
    -webkit-mask-image: var(--icon-tag);
    mask-image: var(--icon-tag);
}
.ic-group{
    -webkit-mask-image: var(--icon-group);
    mask-image: var(--icon-group);
}
.starter-hint{
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-2);
    background: var(--accent-soft);
    border: 1px solid var(--accent-border);
}
.starter-hint .ic{
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    color: var(--accent-strong);
}
.starter-hint kbd{
    display: inline-block;
    margin: 0 1px;
    padding: 0 4px;
    font-family: var(--font-en);
    font-size: 10px;
    line-height: 15px;
    color: var(--text-1);
    background: var(--block-2);
    border: 1px solid var(--border-2);
    border-radius: 3px;
}
.starter-close{
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-left: auto;
    padding: 0;
    font-size: 13px;
    line-height: 1;
    color: var(--text-2);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.starter-close:hover{
    color: var(--text-1);
    background: var(--hover-1);
}
.focus-stats{
    position: absolute;
    top: calc(10px + var(--editor-header-height, 148px));
    right: 18px;
    z-index: 8;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 11px;
    border-radius: 999px;
    font-size: 11px;
    color: var(--text-2);
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    box-shadow: 0 3px 14px var(--shadow-1);
    pointer-events: none;
    user-select: none;
}
.focus-stat{
    font-family: var(--font-en);
    letter-spacing: 0.02em;
}
.focus-stat-sep{
    width: 1px;
    height: 11px;
    background: var(--border-2);
}
.find-bar{
    position: absolute;
    top: 12px;
    right: 18px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 6px 5px 10px;
    border-radius: 9px;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    box-shadow: 0 6px 22px var(--shadow-1);
}
.find-input{
    width: 168px;
    padding: 3px 0;
    font-size: 12px;
    color: var(--text-1);
    background: transparent;
    border: none;
    outline: none;
}
.find-input::placeholder{
    color: var(--text-2);
}
.find-count{
    min-width: 54px;
    font-size: 11px;
    font-family: var(--font-en);
    color: var(--text-2);
    text-align: right;
}
.find-btn{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    font-size: 11px;
    line-height: 1;
    color: var(--text-2);
    background: transparent;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.14s var(--ease), color 0.14s var(--ease);
}
.find-btn:hover:not(:disabled){
    color: var(--text-1);
    background: var(--hover-1);
}
.find-btn:disabled{
    opacity: 0.35;
    cursor: default;
}
.find-btn-close{
    font-size: 14px;
}
.find-flash{
    position: absolute;
    z-index: 19;
    pointer-events: none;
    border-radius: 3px;
    background: var(--accent-soft);
    box-shadow: 0 0 0 2px var(--accent-border), 0 0 14px 3px var(--accent-glow);
    animation: find-flash 1.3s ease-out forwards;
}
@keyframes find-flash{
    0%{
        opacity: 0;
        transform: scale(1.18);
    }
    16%{
        opacity: 1;
        transform: scale(1);
    }
    72%{
        opacity: 0.9;
    }
    100%{
        opacity: 0;
    }
}
.history-modes{
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 0 8px;
    border-bottom: 1px solid var(--border-2);
}
.history-mode{
    padding: 3px 9px;
    font-size: 11px;
    color: var(--text-2);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: color 0.14s var(--ease), background 0.14s var(--ease);
}
.history-mode:hover{
    color: var(--text-1);
    background: var(--hover-1);
}
.history-mode.active{
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.history-stat{
    display: flex;
    gap: 7px;
    margin-left: auto;
    font-family: var(--font-en);
    font-size: 11px;
}
.stat-add{
    color: #1f9d55;
}
.stat-del{
    color: #d1453b;
}
.diff-body{
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding-top: 8px;
}
.diff-grid{
    font-family: var(--font-en);
    font-size: 11.5px;
    line-height: 18px;
}
.diff-row{
    display: grid;
    grid-template-columns: 1fr 1fr;
}
.diff-cell{
    display: flex;
    gap: 6px;
    padding: 0 6px;
    border-left: 2px solid transparent;
    white-space: pre-wrap;
    word-break: break-word;
}
.diff-no{
    flex-shrink: 0;
    min-width: 22px;
    font-size: 10px;
    line-height: 18px;
    text-align: right;
    opacity: 0.4;
}
.diff-text{
    flex: 1;
    min-width: 0;
}
.cell-same{
    color: var(--text-2);
}
.cell-add{
    color: #14663a;
    background: rgba(31,157,85,0.14);
    border-left-color: #1f9d55;
}
.cell-del{
    color: #93261f;
    background: rgba(209,69,59,0.13);
    border-left-color: #d1453b;
}
.cell-trim{
    color: #8a6410;
    background: rgba(214,163,32,0.16);
    border-left-color: #d6a320;
}
.cell-empty{
    background: var(--hover-1);
}
.diff-row.kind-pair .cell-del{
    background: rgba(209,69,59,0.13);
}
.tool-btn{
    height: 30px;
    padding: 0 14px;
    font-size: 13px;
    color: var(--text-2);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s var(--ease), border-color 0.15s var(--ease), background 0.15s var(--ease);
}
.tool-btn:hover{
    color: var(--text-1);
    border-color: var(--border-2);
}
.tool-btn.active{
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.tool-btn:disabled{
    opacity: 0.5;
    cursor: default;
}
.export-wrap{
    position: relative;
}
.menu-mask{
    position: fixed;
    inset: 0;
    z-index: 18;
}
.export-menu{
    position: absolute;
    top: 34px;
    right: 0;
    z-index: 19;
    box-sizing: border-box;
    width: 168px;
    padding: 4px;
    background: var(--surface-1);
    border: 1px solid var(--border-2);
    border-radius: var(--radius-1);
}
.export-item{
    display: block;
    width: 100%;
    height: 30px;
    padding: 0 10px;
    font-size: 13px;
    text-align: left;
    color: var(--text-1);
    background: transparent;
    border: 0;
    border-radius: var(--radius-1);
    cursor: pointer;
    transition: background 0.15s var(--ease);
}
.export-item:hover{
    background: var(--block-2);
}
.history-mask{
    position: fixed;
    inset: 0;
    z-index: 28;
    background: rgba(0,0,0,0.18);
}
.history-panel{
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 29;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 400px;
    max-width: 90vw;
    background: var(--surface-1);
    border-left: 1px solid var(--border-2);
}
.history-head{
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    height: 46px;
    padding: 0 8px 0 16px;
    border-bottom: 1px solid var(--border-1);
}
.history-title{
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
}
.history-count{
    font-size: 12px;
    color: var(--text-2);
}
.history-close{
    margin-left: auto;
    width: 26px;
    height: 26px;
    font-size: 16px;
    color: var(--text-2);
    background: transparent;
    border: 0;
    border-radius: var(--radius-1);
    cursor: pointer;
}
.history-close:hover{
    color: var(--text-1);
    background: var(--block-2);
}
.hidden-picker{
    display: none;
}
.link-mask{
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgba(0,0,0,0.18);
}
.link-panel{
    position: fixed;
    top: calc(var(--editor-header-height, 148px) + 46px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 31;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 420px;
    max-width: 92vw;
    max-height: 60vh;
    background: var(--surface-1);
    border: 1px solid var(--border-2);
    border-radius: var(--radius-2);
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
}
.link-head{
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    height: 42px;
    padding: 0 8px 0 16px;
    border-bottom: 1px solid var(--border-1);
}
.link-title{
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
}
.link-close{
    margin-left: auto;
    width: 26px;
    height: 26px;
    font-size: 16px;
    color: var(--text-2);
    background: transparent;
    border: 0;
    border-radius: var(--radius-1);
    cursor: pointer;
}
.link-close:hover{
    color: var(--text-1);
    background: var(--block-2);
}
.link-search{
    flex-shrink: 0;
    margin: 12px 12px 8px;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text-1);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    outline: none;
}
.link-search:focus{
    border-color: var(--accent-1);
}
.link-list{
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0 8px 10px;
}
.link-tip{
    margin: 0;
    padding: 14px 8px;
    font-size: 13px;
    color: var(--text-2);
}
.link-item{
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 8px;
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: var(--radius-1);
    cursor: pointer;
}
.link-item:hover{
    background: var(--block-2);
}
.link-item-title{
    flex: 1 1 auto;
    min-width: 0;
    font-size: 13px;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.link-item-time{
    flex-shrink: 0;
    font-size: 12px;
    color: var(--text-2);
}
:deep(.vditor-reset a[href^="dnote:note/"]){
    color: var(--accent-1);
    text-decoration: none;
    border-bottom: 1px solid var(--border-2);
    cursor: pointer;
}
:deep(.vditor-reset a.note-link-dead),
:deep(.reader-body a.note-link-dead){
    color: var(--text-2);
    text-decoration: line-through;
    border-bottom-color: var(--border-1);
    cursor: not-allowed;
}
:deep(.dnote-icon-image),
:deep(.dnote-icon-note-link),
:deep(.dnote-icon-save){
    display: inline-block;
    width: 16px;
    height: 16px;
    background-color: currentColor;
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
    vertical-align: -3px;
}
:deep(.dnote-icon-image){
    mask-image: var(--icon-image);
}
:deep(.dnote-icon-note-link){
    mask-image: var(--icon-note-link);
}
:deep(.dnote-icon-save){
    mask-image: var(--icon-save);
}
.history-list{
    flex: 0 0 auto;
    max-height: 38%;
    padding: 8px;
    overflow-y: auto;
    border-bottom: 1px solid var(--border-1);
}
.history-item{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    height: 30px;
    padding: 0 10px;
    font-size: 13px;
    color: var(--text-1);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-1);
    cursor: pointer;
    text-align: left;
}
.history-item:hover{
    background: var(--block-2);
}
.history-item.active{
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.history-time{
    font-family: var(--font-en);
}
.history-size{
    flex-shrink: 0;
    font-size: 12px;
    color: var(--text-2);
}
.history-foot{
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    gap: 10px;
    padding: 12px 16px 16px;
}
.history-preview{
    flex: 1 1 auto;
    min-height: 0;
    margin: 0;
    padding: 10px 12px;
    overflow: auto;
    font-family: var(--font-en);
    font-size: 12px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-1);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
}
.history-actions{
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
}
.history-tip{
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-2);
}
.back-badge{
    display: inline-block;
    margin-left: 6px;
    min-width: 16px;
    padding: 0 5px;
    font-size: 11px;
    line-height: 16px;
    text-align: center;
    color: var(--on-accent);
    background: var(--accent-strong);
    border-radius: 999px;
}
.back-mask{
    position: fixed;
    inset: 0;
    z-index: 26;
    background: rgba(0,0,0,0.18);
}
.back-panel{
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 27;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 388px;
    max-width: 90vw;
    background: var(--surface-1);
    border-left: 1px solid var(--border-2);
}
.back-head{
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    height: 46px;
    padding: 0 8px 0 16px;
    border-bottom: 1px solid var(--border-1);
}
.back-title{
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
}
.back-count{
    font-size: 12px;
    color: var(--text-2);
}
.back-close{
    margin-left: auto;
    width: 26px;
    height: 26px;
    font-size: 16px;
    color: var(--text-2);
    background: transparent;
    border: 0;
    border-radius: var(--radius-1);
    cursor: pointer;
}
.back-close:hover{
    color: var(--text-1);
    background: var(--block-2);
}
.back-list{
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 10px;
}
.back-tip{
    margin: 0;
    padding: 14px 8px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-2);
}
.back-item{
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 10px;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-1);
    cursor: pointer;
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.back-item:hover{
    background: var(--block-2);
    border-color: var(--border-2);
}
.back-kind{
    flex-shrink: 0;
    min-width: 34px;
    text-align: center;
    padding: 2px 0;
    font-size: 11px;
    color: var(--text-2);
    background: var(--block-2);
    border-radius: var(--radius-1);
}
.back-kind.note{
    color: var(--accent-strong);
    background: var(--accent-soft);
}
.back-main{
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.back-item-title{
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.back-snippet{
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-2);
    word-break: break-all;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.back-side{
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
}
.back-time{
    font-size: 11px;
    font-family: var(--font-en);
    color: var(--text-2);
    white-space: nowrap;
}
.back-count-inline{
    font-size: 11px;
    color: var(--on-accent);
    background: var(--accent-strong);
    border-radius: 999px;
    padding: 0 5px;
    line-height: 16px;
}
.tag-bar{
    display: flex;
    align-items: center;
    gap: 10px;
}
.tag-select{
    width: min(380px, 100%);
}
.tag-status{
    flex-shrink: 0;
    font-size: 12px;
    color: var(--text-2);
}
:deep(.tag-select .el-select__wrapper){
    min-height: 30px;
    padding: 2px 8px;
    gap: 4px;
    background: var(--block-1);
    box-shadow: none;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    transition: border-color 0.15s var(--ease);
}
:deep(.tag-select .el-select__wrapper:hover){
    border-color: var(--border-2);
}
:deep(.tag-select .el-select__wrapper.is-focused){
    border-color: var(--accent-border);
}
:deep(.tag-select .el-tag){
    --el-tag-bg-color:var(--accent-soft);
    --el-tag-border-color:var(--accent-border);
    --el-tag-text-color:var(--accent-strong);
    height: 22px;
    border-radius: var(--radius-1);
}
:deep(.tag-select .el-tag .el-tag__close){
    color: var(--accent-strong);
}
:deep(.tag-select .el-select__placeholder){
    font-size: 13px;
    color: var(--text-2);
}
:deep(.tag-select .el-select__input){
    font-size: 13px;
}
.editor-wrap{
    position: relative;
    height: 100%;
}
.editor-loading{
    position: absolute;
    left: 0;
    right: 0;
    top: var(--editor-header-height, 148px);
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 34px 40px;
    background: var(--bg-1);
}
.loading-skeleton{
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.skeleton-line{
    display: block;
    height: 14px;
    border-radius: 4px;
    background: var(--block-1);
    animation: skeleton-pulse 1.5s var(--ease) infinite;
}
.skeleton-line.w90{ width: 90%; }
.skeleton-line.w85{ width: 85%; }
.skeleton-line.w75{ width: 75%; }
.skeleton-line.w70{ width: 70%; }
.skeleton-line.w60{ width: 60%; }
@keyframes skeleton-pulse{
    0%,100%{ opacity: 1; }
    50%{ opacity: 0.4; }
}
.loading-status{
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: auto;
    font-size: 13px;
    color: var(--text-2);
}
.loading-track{
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: var(--block-1);
    overflow: hidden;
}
.loading-track i{
    display: block;
    width: 32%;
    height: 100%;
    background: var(--accent-strong);
    animation: loading-slide 1.1s var(--ease) infinite;
}
@keyframes loading-slide{
    0%{ transform: translateX(-110%); }
    100%{ transform: translateX(340%); }
}
.loading-text{
    font-size: 14px;
    color: var(--text-2);
}
.vditor{
    position: absolute;
    top: var(--editor-header-height, 148px);
    left: 0;
    right: 0;
    background: var(--bg-1);
}
.reader{
    position: absolute;
    top: var(--editor-header-height, 148px);
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    overflow-y: auto;
    background: var(--bg-1);
    animation: reader-in 0.18s var(--ease);
}
@keyframes reader-in{
    from{ opacity: 0; }
    to{ opacity: 1; }
}
.reader-body{
    box-sizing: border-box;
    max-width: 780px;
    margin: 0 auto;
    padding: 40px 32px 96px;
    font-size: 16px;
    line-height: 1.85;
    color: var(--text-1);
    word-break: break-word;
}
.reader-body:empty::after{
    content: "还是空的，写点什么吧";
    display: block;
    font-size: 14px;
    color: var(--text-2);
}
.reader-body :deep(h1),
.reader-body :deep(h2),
.reader-body :deep(h3),
.reader-body :deep(h4),
.reader-body :deep(h5),
.reader-body :deep(h6){
    margin: 1.6em 0 0.7em;
    font-weight: 600;
    line-height: 1.4;
}
.reader-body :deep(h1){ font-size: 28px; }
.reader-body :deep(h2){
    font-size: 23px;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--border-1);
}
.reader-body :deep(h3){ font-size: 20px; }
.reader-body :deep(h4),
.reader-body :deep(h5),
.reader-body :deep(h6){ font-size: 17px; }
.reader-body :deep(p){
    margin: 0.9em 0;
}
.reader-body :deep(a){
    color: var(--accent-strong);
    text-decoration: none;
}
.reader-body :deep(a:hover){
    text-decoration: underline;
}
.reader-body :deep(blockquote){
    margin: 1.2em 0;
    padding: 2px 0 2px 16px;
    color: var(--text-2);
    border-left: 3px solid var(--accent-border);
}
.reader-body :deep(ul),
.reader-body :deep(ol){
    margin: 0.9em 0;
    padding-left: 1.6em;
}
.reader-body :deep(li){
    margin: 0.35em 0;
}
.reader-body :deep(li.task-list-item){
    list-style: none;
}
.reader-body :deep(li.task-list-item input){
    margin-right: 8px;
    vertical-align: middle;
}
.reader-body :deep(code){
    padding: 2px 6px;
    font-size: 0.88em;
    font-family: var(--font-en);
    background: var(--block-1);
    border-radius: var(--radius-1);
}
.reader-body :deep(pre){
    margin: 1.2em 0;
    padding: 14px 16px;
    overflow-x: auto;
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
}
.reader-body :deep(pre code){
    padding: 0;
    background: transparent;
    font-size: 13.5px;
    line-height: 1.7;
}
.reader-body :deep(table){
    width: 100%;
    margin: 1.2em 0;
    border-collapse: collapse;
    font-size: 14px;
}
.reader-body :deep(th),
.reader-body :deep(td){
    padding: 8px 12px;
    border: 1px solid var(--border-1);
    text-align: left;
}
.reader-body :deep(th){
    background: var(--block-1);
    font-weight: 600;
}
.reader-body :deep(img){
    max-width: 100%;
    border-radius: var(--radius-1);
}
.reader-body :deep(hr){
    height: 1px;
    margin: 2em 0;
    border: 0;
    background: var(--border-1);
}
.reader-body del{
    color: var(--text-2);
}
:deep(.vditor-toolbar){
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-1);
}
:deep(.vditor-counter){
    display: none;
}
:deep(.vditor-reset){
    color: var(--text-1);
    font-size: 15px;
}
</style>
