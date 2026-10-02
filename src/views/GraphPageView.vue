<template>
<div id="graph-page">
    <header id="graph-header">
        <div>
            <p class="graph-title">知识网</p>
            <p class="graph-sub">把笔记连起来，拖一拖就成</p>
        </div>
        <div class="graph-head-tools">
            <span class="graph-count">{{ nodes.length }} 个点 · {{ edges.length }} 条线</span>
            <div class="graph-zoom">
                <button class="graph-btn" title="缩小" @click="zoomOut">−</button>
                <span class="graph-zoom-value">{{ zoomText }}</span>
                <button class="graph-btn" title="放大" @click="zoomIn">＋</button>
            </div>
            <button class="graph-btn" title="圈一个范围把相关的笔记归到一起" @click="createGroup">圈个分组</button>
            <button class="graph-btn" @click="fitView">收进画面</button>
            <button class="graph-btn" @click="resetView">回到起点</button>
        </div>
    </header>

    <div
        id="graph-canvas"
        ref="canvasRef"
        :class="{ panning: panning }"
        :style="canvasStyle"
        @mousedown="onCanvasMouseDown"
        @wheel.prevent="onWheel"
        @contextmenu.prevent="onContextMenu"
    >
        <div id="graph-layer" :style="layerStyle">
            <div
                v-for="group in groups"
                :key="group.id"
                class="graph-group"
                :class="{ selected: groupSelected === group.id }"
                :style="groupStyle(group)"
                @mousedown.stop="onGroupMouseDown($event, group)"
                @contextmenu.prevent.stop="onGroupContextMenu($event, group)"
            >
                <div class="group-title" @dblclick.stop="startRenameGroup(group)">
                    <span class="group-dot" :style="{ background: group.color }"></span>
                    <span class="group-name">{{ group.title || '没名字的分组' }}</span>
                </div>
                <input
                    v-if="renamingId === group.id"
                    ref="renameInput"
                    v-model="renameValue"
                    class="group-rename"
                    maxlength="40"
                    @mousedown.stop
                    @keydown.enter.prevent="commitRename"
                    @keydown.esc.prevent="cancelRename"
                    @blur="commitRename"
                >
                <div
                    v-for="handle in GROUP_HANDLES"
                    :key="handle"
                    class="group-handle"
                    :class="'handle-' + handle"
                    @mousedown.stop="startResize($event, group, handle)"
                ></div>
                <div v-if="groupSelected === group.id" class="group-actions" @mousedown.stop>
                    <button class="group-btn" :style="{ background: group.color }" title="换个颜色" @click="cycleGroupColor(group)"></button>
                    <button class="group-btn group-btn-text" title="删掉这个框" @click="confirmRemoveGroup(group)">×</button>
                </div>
            </div>
            <svg id="graph-wires" :width="LAYER_W" :height="LAYER_H">
                <g v-for="edge in edgeViews" :key="edge.id" class="wire">
                    <line class="wire-line" vector-effect="non-scaling-stroke" :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"></line>
                    <circle class="wire-del-bg" :cx="edge.mx" :cy="edge.my" :r="8 / scale"></circle>
                    <text class="wire-del-text" :x="edge.mx" :y="edge.my + 4 / scale" :style="{ fontSize: (13 / scale) + 'px' }">×</text>
                    <circle
                        class="wire-del"
                        :cx="edge.mx"
                        :cy="edge.my"
                        :r="9 / scale"
                        @mousedown.stop
                        @click.stop="confirmRemoveEdge(edge)"
                    ></circle>
                </g>
                <line
                    v-if="linkPreview"
                    class="wire-ghost"
                    vector-effect="non-scaling-stroke"
                    :x1="linkPreview.x1"
                    :y1="linkPreview.y1"
                    :x2="linkPreview.x2"
                    :y2="linkPreview.y2"
                ></line>
            </svg>

            <div
                v-for="node in nodes"
                :key="node.id"
                :ref="el => registerNodeEl(node.id, el)"
                class="graph-node"
                :class="'type-' + node.type"
                :style="nodeStyle(node)"
                @mousedown.stop="onNodeMouseDown($event, node)"
            >
                <div class="node-port" title="从这里往左连" @mousedown.stop="startLink($event, node, 'left')">+</div>
                <div class="node-card" @click.stop="onCardClick(node)">
                    <div class="node-head">
                        <span class="node-kind">{{ node.type === 'note' ? '笔记' : '说明' }}</span>
                        <span class="node-name" :title="node.type === 'note' ? node.title : '说明节点'">{{ node.type === 'note' ? node.title : '说明' }}</span>
                        <button class="node-more" title="更多操作" @mousedown.stop @click.stop="toggleNodeMenu(node.id)">⋯</button>
                    </div>
                    <div v-if="node.type === 'text'" class="node-body">
                        <textarea
                            :ref="el => registerTextEl(node.id, el)"
                            class="node-input"
                            :value="node.text"
                            placeholder="写点什么…"
                            @mousedown.stop
                            @click.stop
                            @input="onNodeInput(node, $event)"
                        ></textarea>
                    </div>
                    <div v-else class="node-body node-open">点开看看</div>
                    <div v-if="openMenuId === node.id" class="node-menu" @mousedown.stop @click.stop>
                        <button class="node-menu-item danger" @click="confirmRemoveNode(node)">删掉</button>
                    </div>
                </div>
                <div class="node-port" title="从这里往右连" @mousedown.stop="startLink($event, node, 'right')">+</div>
            </div>

            <p v-if="nodes.length === 0 && groups.length === 0" class="graph-empty">在空白处点右键，就能加东西</p>
        </div>
    </div>

    <div
        v-if="menu.visible"
        class="graph-menu"
        :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
        @mousedown.stop
        @contextmenu.prevent
    >
        <button class="graph-menu-item" @click="menuAction('note')">加一篇笔记</button>
        <button class="graph-menu-item" @click="menuAction('text')">加一段说明</button>
        <button class="graph-menu-item" @click="menuAction('group')">圈一块当分组</button>
        <div class="graph-menu-sep"></div>
        <button class="graph-menu-item" @click="menuAction('fit')">收进画面</button>
    </div>

    <div v-if="picker.visible" class="graph-picker-mask" @mousedown.self="picker.visible = false">
        <div class="graph-picker">
            <p class="picker-title">挑一篇笔记</p>
            <input v-model="picker.keyword" class="picker-search" placeholder="搜标题或标签" />
            <div class="picker-list">
                <p v-if="pickerList.length === 0" class="picker-empty">
                    {{ noteList.length === 0 ? '还没有笔记，先去写一篇' : '没找到' }}
                </p>
                <div v-for="item in pickerList" :key="item.time" class="picker-item" @click="createNoteNode(item)">
                    <p class="picker-item-title">{{ item.det.title }}</p>
                    <p class="picker-item-meta">
                        {{ fmtDate(item.time) }}
                        <span v-if="item.tags && item.tags.length > 0"> · {{ item.tags.join(' / ') }}</span>
                    </p>
                </div>
            </div>
            <div class="picker-ops">
                <button class="graph-btn" @click="picker.visible = false">算了</button>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus'
import emitter from '../utils/emitter.js'
import uiState from '../utils/uiState.js'
import NoteEditPage from '../components/NoteEditPage.vue'

const LAYER_W = 6000
const LAYER_H = 4000
const TEXT_SAVE_DELAY = 400
const MIN_SCALE = 0.4
const MAX_SCALE = 2
const ZOOM_STEP = 1.15
const GRID_SIZE = 26
const GROUP_HANDLES = ['nw','ne','sw','se']
const GROUP_COLOR_POOL = ['#e5484d','#f76808','#e8d531','#46a758','#12a594','#0090ff','#8e4ec6','#e93d82']
const MIN_GROUP_SIZE = 120

function clampScale(value){
    if(!Number.isFinite(value)) return 1
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}
// 把主题色和透明度拼成 rgba，这样框本身不用降透明度，标题和角标才是清楚的。
function hexToRgba(hex, alpha){
    let full = String(hex || "").slice(1)
    if(full.length === 3) full = full.split('').map(ch=> ch + ch).join('')
    if(full.length !== 6 || !/^[0-9a-f]{6}$/i.test(full)) return "rgba(232,213,49,0.14)"
    const rgb = [
        parseInt(full.slice(0,2),16),
        parseInt(full.slice(2,4),16),
        parseInt(full.slice(4,6),16)
    ]
    const safe = Number.isFinite(alpha) ? Math.min(0.4,Math.max(0.05,alpha)) : 0.14
    return "rgba(" + rgb.join(",") + "," + safe + ")"
}

export default {
    data(){
        return {
            LAYER_W: LAYER_W,
            LAYER_H: LAYER_H,
            GROUP_HANDLES: GROUP_HANDLES,
            nodes: [],
            edges: [],
            groups: [],
            groupSelected: "",
            renamingId: "",
            renameValue: "",
            groupDrag: null,
            groupResize: null,
            pan: { x: 40, y: 20 },
            scale: 1,
            rects: {},
            menu: { visible: false, x: 0, y: 0 },
            menuLayer: { x: 120, y: 120 },
            picker: { visible: false, keyword: "" },
            noteList: [],
            openMenuId: "",
            draggingId: "",
            dragOffset: { x: 0, y: 0 },
            canvasRect: null,
            panning: false,
            panStart: { x: 0, y: 0, panX: 0, panY: 0 },
            linking: null,
            textTimers: {},
            rafId: 0,
            pendingReload: false
        }
    },
    computed: {
        zoomText(){
            return Math.round(this.scale * 100) + "%"
        },
        layerStyle(){
            return { transform: 'translate(' + this.pan.x + 'px,' + this.pan.y + 'px) scale(' + this.scale + ')' }
        },
        canvasStyle(){
            const step = GRID_SIZE * this.scale
            return {
                backgroundSize: step + 'px ' + step + 'px',
                backgroundPosition: this.pan.x + 'px ' + this.pan.y + 'px'
            }
        },
        edgeViews(){
            return this.edges.map(edge=>{
                const from = this.rects[edge.from]
                const to = this.rects[edge.to]
                if(!from || !to) return null
                const fromRight = from.x + from.w / 2 <= to.x + to.w / 2
                const start = sidePoint(from, edge.fromSide)
                const end = sidePoint(to, fromRight ? "left" : "right")
                return {
                    id: edge.id,
                    x1: start.x,
                    y1: start.y,
                    x2: end.x,
                    y2: end.y,
                    mx: Math.round((start.x + end.x) / 2),
                    my: Math.round((start.y + end.y) / 2)
                }
            }).filter(item=> item != null)
        },
        linkPreview(){
            if(this.linking == null) return null
            const rect = this.rects[this.linking.from]
            if(!rect) return null
            const start = sidePoint(rect, this.linking.fromSide)
            return { x1: start.x, y1: start.y, x2: Math.round(this.linking.x), y2: Math.round(this.linking.y) }
        },
        pickerList(){
            const keyword = this.picker.keyword.trim().toLowerCase()
            if(keyword === "") return this.noteList
            return this.noteList.filter(item=>{
                const title = String(item.det?.title || "").toLowerCase()
                if(title.includes(keyword)) return true
                const tags = Array.isArray(item.tags) ? item.tags : []
                return tags.some(tag=> String(tag).toLowerCase().includes(keyword))
            })
        }
    },
    watch: {
        nodes(){
            this.$nextTick(()=>{
                this.syncTextHeights()
                this.refreshRects()
            })
        }
    },
    created(){
        this.nodeEls = new Map()
        this.textEls = new Map()
    },
    async mounted(){
        this.addGlobalListeners()
        this.offGraph = window.electron.onGraphUpdated(()=> this.requestReload())
        this.offNote = window.electron.onNoteUpdated(()=>{
            this.loadGraph()
            this.requestReload()
        })
        await this.loadGraph()
        await this.loadNotes()
    },
    activated(){
        this.addGlobalListeners()      // 页面是缓存的，切回来要重新接管全局按键
        uiState.focus = false
        this.loadGraph()
    },
    deactivated(){
        this.removeGlobalListeners()   // 人不在图谱页了，Delete/Escape 这些键不该再由这里处理
    },
    beforeUnmount(){
        this.removeGlobalListeners()
        if(this.rafId) cancelAnimationFrame(this.rafId)
        Object.values(this.textTimers).forEach(timer=> clearTimeout(timer))
        if(this.offGraph) this.offGraph()
        if(this.offNote) this.offNote()
    },
    methods: {
        addGlobalListeners(){
            window.addEventListener("mousemove", this.onWindowMouseMove)
            window.addEventListener("mouseup", this.onWindowMouseUp)
            window.addEventListener("keydown", this.onKeyDown)
            document.addEventListener("mousedown", this.onDocMouseDown)
            window.addEventListener("resize", this.scheduleRects)
        },
        removeGlobalListeners(){
            window.removeEventListener("mousemove", this.onWindowMouseMove)
            window.removeEventListener("mouseup", this.onWindowMouseUp)
            window.removeEventListener("keydown", this.onKeyDown)
            document.removeEventListener("mousedown", this.onDocMouseDown)
            window.removeEventListener("resize", this.scheduleRects)
        },
        fmtDate(time){
            const date = new Date(Number(time))
            if(Number.isNaN(date.getTime())) return ""
            const pad = value=> String(value).padStart(2, "0")
            return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
        },
        errorText(error){
            const message = error?.message || String(error || "")
            return message.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, "")
        },
        async loadGraph(){
            try{
                const data = await window.electron.getGraph()
                this.nodes = Array.isArray(data?.nodes) ? data.nodes : []
                this.edges = Array.isArray(data?.edges) ? data.edges : []
                this.groups = Array.isArray(data?.groups) ? data.groups : []
                if(this.groupSelected !== "" && !this.groups.some(item=> item.id === this.groupSelected)){
                    this.groupSelected = ""
                }
                this.$nextTick(()=> this.refreshRects())
            }catch(error){
                ElMessage.error(this.errorText(error) || "知识网没打开成")
            }
        },
        async loadNotes(){
            try{
                const data = await window.electron.getNoteList()
                this.noteList = Array.isArray(data?.notes) ? data.notes.filter(item=> item?.det != null) : []
            }catch{
                this.noteList = []
            }
        },
        requestReload(){
            if(this.draggingId !== "" || this.groupDrag != null || this.groupResize != null || this.linking != null || this.busyText()){
                this.pendingReload = true
                return
            }
            this.loadGraph()
        },
        flushReload(){
            if(!this.pendingReload) return
            this.pendingReload = false
            this.loadGraph()
        },
        busyText(){
            return Object.keys(this.textTimers).length > 0
        },
        registerNodeEl(id, el){
            if(el) this.nodeEls.set(id, el)
            else this.nodeEls.delete(id)
        },
        registerTextEl(id, el){
            if(el) this.textEls.set(id, el)
            else this.textEls.delete(id)
        },
        refreshRects(){
            const map = {}
            this.nodeEls.forEach((el, id)=>{
                if(el == null || el.offsetParent == null) return
                map[id] = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
            })
            this.rects = map
        },
        scheduleRects(){
            if(this.rafId) return
            this.rafId = requestAnimationFrame(()=>{
                this.rafId = 0
                this.refreshRects()
            })
        },
        nodeStyle(node){
            return { left: node.x + 'px', top: node.y + 'px' }
        },
        groupStyle(group){
            const alpha = group.opacity == null ? 0.14 : group.opacity
            return {
                left: group.x + 'px',
                top: group.y + 'px',
                width: group.w + 'px',
                height: group.h + 'px',
                '--group-color': group.color,
                '--group-fill': hexToRgba(group.color,alpha),
                '--group-edge': hexToRgba(group.color,Math.min(0.85,alpha + 0.4)),
                '--group-alpha': String(alpha)
            }
        },
        groupIndex(){
            return this.groups.findIndex(item=> item.id === this.groupSelected)
        },
        async saveGroup(group, extra){
            if(group == null) return
            try{
                await window.electron.updateGraphGroup({
                    id: group.id,
                    x: Math.round(group.x),
                    y: Math.round(group.y),
                    w: Math.round(group.w),
                    h: Math.round(group.h),
                    title: group.title,
                    color: group.color,
                    opacity: group.opacity,
                    ...(extra || {})
                })
            }catch(error){
                ElMessage.error(this.errorText(error) || "这个框没存住")
            }
        },
        onGroupMouseDown(event, group){
            this.groupSelected = group.id
            this.openMenuId = ""
            this.menu.visible = false
            const point = this.toLayerPoint(event)
            this.groupDrag = {
                id: group.id,
                offsetX: point.x - group.x,
                offsetY: point.y - group.y,
                moved: false
            }
            event.preventDefault()
        },
        onGroupContextMenu(event, group){
            this.groupSelected = group.id
            const point = this.toLayerPoint(event)
            this.menuLayer = { x: point.x, y: point.y }
            this.menu.visible = true
            this.picker.visible = false
        },
        startResize(event, group, handle){
            this.groupSelected = group.id
            const point = this.toLayerPoint(event)
            this.groupResize = {
                id: group.id,
                handle: handle,
                startX: point.x,
                startY: point.y,
                box: { x: group.x, y: group.y, w: group.w, h: group.h },
                moved: false
            }
            event.preventDefault()
            event.stopPropagation()
        },
        applyGroupDrag(event){
            const drag = this.groupDrag
            const group = this.groups.find(item=> item.id === drag.id)
            if(group == null) return
            const point = this.toLayerPoint(event)
            const nextX = point.x - drag.offsetX
            const nextY = point.y - drag.offsetY
            if(Math.abs(nextX - group.x) > 1 || Math.abs(nextY - group.y) > 1) drag.moved = true
            group.x = Math.round(nextX)
            group.y = Math.round(nextY)
        },
        applyGroupResize(event){
            const resize = this.groupResize
            const group = this.groups.find(item=> item.id === resize.id)
            if(group == null) return
            const point = this.toLayerPoint(event)
            const dx = point.x - resize.startX
            const dy = point.y - resize.startY
            if(Math.abs(dx) > 1 || Math.abs(dy) > 1) resize.moved = true
            const box = resize.box
            let x = box.x
            let y = box.y
            let w = box.w
            let h = box.h
            if(resize.handle.indexOf("w") !== -1){
                x = box.x + dx
                w = box.w - dx
            }
            if(resize.handle.indexOf("e") !== -1){
                w = box.w + dx
            }
            if(resize.handle.indexOf("n") !== -1){
                y = box.y + dy
                h = box.h - dy
            }
            if(resize.handle.indexOf("s") !== -1){
                h = box.h + dy
            }
            // 拖过头时改成从另一边长回来，框不会翻转成负数
            if(w < MIN_GROUP_SIZE){
                if(resize.handle.indexOf("w") !== -1) x = box.x + box.w - MIN_GROUP_SIZE
                w = MIN_GROUP_SIZE
            }
            if(h < MIN_GROUP_SIZE){
                if(resize.handle.indexOf("n") !== -1) y = box.y + box.h - MIN_GROUP_SIZE
                h = MIN_GROUP_SIZE
            }
            group.x = Math.round(x)
            group.y = Math.round(y)
            group.w = Math.round(w)
            group.h = Math.round(h)
        },
        async endGroupGesture(){
            if(this.groupDrag != null){
                const drag = this.groupDrag
                this.groupDrag = null
                if(drag.moved){
                    const group = this.groups.find(item=> item.id === drag.id)
                    await this.saveGroup(group)
                }
            }
            if(this.groupResize != null){
                const resize = this.groupResize
                this.groupResize = null
                if(resize.moved){
                    const group = this.groups.find(item=> item.id === resize.id)
                    await this.saveGroup(group)
                }
            }
            this.flushReload()
        },
        async createGroup(){
            const view = this.$refs.canvasRef
            const rect = view != null ? view.getBoundingClientRect() : null
            if(rect == null) return
            const center = {
                x: (rect.width / 2 - this.pan.x) / this.scale,
                y: (rect.height / 2 - this.pan.y) / this.scale
            }
            await this.createGroupAt(center.x,center.y)
        },
        startRenameGroup(group){
            this.groupSelected = group.id
            this.renamingId = group.id
            this.renameValue = group.title || ""
            this.$nextTick(()=>{
                const input = Array.isArray(this.$refs.renameInput) ? this.$refs.renameInput[0] : this.$refs.renameInput
                if(input){
                    input.focus()
                    input.select()
                }
            })
        },
        commitRename(){
            const id = this.renamingId
            if(id === "") return
            // 先把名字取出来再收状态，否则输入框里的字会先被清掉
            const typed = String(this.renameValue == null ? "" : this.renameValue).trim()
            this.renamingId = ""
            this.renameValue = ""
            const group = this.groups.find(item=> item.id === id)
            if(group == null) return
            const title = typed === "" ? "没名字的分组" : typed
            if(title === group.title) return
            group.title = title
            this.saveGroup(group)
        },
        cancelRename(){
            this.renamingId = ""
            this.renameValue = ""
        },
        cycleGroupColor(group){
            const at = GROUP_COLOR_POOL.indexOf(group.color)
            const color = GROUP_COLOR_POOL[(at + 1) % GROUP_COLOR_POOL.length]
            group.color = color
            this.saveGroup(group,{ color:color })
        },
        async confirmRemoveGroup(group){
            try{
                await ElMessageBox.confirm('删掉「' + (group.title || "没名字的分组") + '」这个框？框里的笔记和连线都不会动。', '删掉', {
                    confirmButtonText: '删掉',
                    cancelButtonText: '算了',
                    type: 'warning'
                })
            }catch{
                return
            }
            try{
                await window.electron.removeGraphGroup(group.id)
                this.groups = this.groups.filter(item=> item.id !== group.id)
                if(this.groupSelected === group.id) this.groupSelected = ""
            }catch(error){
                ElMessage.error(this.errorText(error) || "没删掉")
            }
        },
        syncTextHeights(){
            this.textEls.forEach(el=>{
                if(el == null) return
                el.style.height = "auto"
                el.style.height = el.scrollHeight + "px"
            })
        },
        toLayerPoint(event){
            const rect = this.canvasRect || this.$refs.canvasRef.getBoundingClientRect()
            return {
                x: (event.clientX - rect.left - this.pan.x) / this.scale,
                y: (event.clientY - rect.top - this.pan.y) / this.scale
            }
        },
        onWheel(event){
            const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
            this.zoomBy(factor, event)
        },
        zoomBy(factor, event){
            const view = this.$refs.canvasRef?.getBoundingClientRect()
            if(view == null) return
            const next = clampScale(this.scale * factor)
            if(next === this.scale) return
            const anchorX = event != null ? event.clientX - view.left : view.width / 2
            const anchorY = event != null ? event.clientY - view.top : view.height / 2
            const layerX = (anchorX - this.pan.x) / this.scale
            const layerY = (anchorY - this.pan.y) / this.scale
            this.scale = next
            this.pan = {
                x: Math.round(anchorX - layerX * next),
                y: Math.round(anchorY - layerY * next)
            }
        },
        zoomIn(){
            this.zoomBy(ZOOM_STEP, null)
        },
        zoomOut(){
            this.zoomBy(1 / ZOOM_STEP, null)
        },
        onDocMouseDown(){
            if(this.menu.visible) this.menu.visible = false
        },
        onContextMenu(event){
            const point = this.toLayerPoint(event)
            this.menuLayer = { x: Math.round(point.x), y: Math.round(point.y) }
            const width = 150
            const height = 132
            this.menu = {
                visible: true,
                x: event.clientX + width + 8 > window.innerWidth ? event.clientX - width : event.clientX,
                y: event.clientY + height + 8 > window.innerHeight ? event.clientY - height : event.clientY
            }
            this.openMenuId = ""
        },
        menuAction(kind){
            this.menu.visible = false
            if(kind === "fit"){
                this.fitView()
                return
            }
            if(kind === "note"){
                this.picker.keyword = ""
                this.picker.visible = true
                return
            }
            if(kind === "group"){
                this.createGroupAt(this.menuLayer.x,this.menuLayer.y)
                return
            }
            this.createTextNode()
        },
        async createGroupAt(x, y){
            try{
                const index = this.groups.length
                const group = await window.electron.addGraphGroup({
                    title: "新分组 " + (index + 1),
                    color: GROUP_COLOR_POOL[index % GROUP_COLOR_POOL.length],
                    opacity: 0.14,
                    x: Math.round(x - 30),
                    y: Math.round(y - 24),
                    w: 420,
                    h: 300
                })
                if(group != null){
                    this.groups.push(group)
                    this.groupSelected = group.id
                }
            }catch(error){
                ElMessage.error(this.errorText(error) || "没加上这个框")
            }
        },
        async createTextNode(){
            try{
                await window.electron.addGraphTextNode(this.menuLayer.x, this.menuLayer.y, "")
                await this.loadGraph()
            }catch(error){
                ElMessage.error(this.errorText(error) || "没加上")
            }
        },
        async createNoteNode(item){
            this.picker.visible = false
            try{
                await window.electron.addGraphNoteNode(item.time, this.menuLayer.x, this.menuLayer.y)
                await this.loadGraph()
            }catch(error){
                ElMessage.error(this.errorText(error) || "没加上")
            }
        },
        onCanvasMouseDown(event){
            if(event.button !== 0) return
            this.menu.visible = false
            this.openMenuId = ""
            this.canvasRect = this.$refs.canvasRef.getBoundingClientRect()
            this.panning = true
            this.panStart = { x: event.clientX, y: event.clientY, panX: this.pan.x, panY: this.pan.y }
        },
        onNodeMouseDown(event, node){
            if(event.button !== 0) return
            const tag = event.target?.tagName
            if(tag === "TEXTAREA" || tag === "BUTTON") return
            this.canvasRect = this.$refs.canvasRef.getBoundingClientRect()
            const point = this.toLayerPoint(event)
            this.draggingId = node.id
            this.dragMoved = false
            this.dragOffset = { x: point.x - node.x, y: point.y - node.y }
            this.openMenuId = ""
        },
        startLink(event, node, side){
            if(event.button !== 0) return
            this.canvasRect = this.$refs.canvasRef.getBoundingClientRect()
            const point = this.toLayerPoint(event)
            this.linking = { from: node.id, fromSide: side, x: point.x, y: point.y }
            this.openMenuId = ""
            this.menu.visible = false
        },
        onWindowMouseMove(event){
            if(this.panning){
                this.updatePan(event)
                return
            }
            if(this.draggingId !== ""){
                this.updateDrag(event)
                return
            }
            if(this.groupDrag != null){
                this.applyGroupDrag(event)
                return
            }
            if(this.groupResize != null){
                this.applyGroupResize(event)
                return
            }
            if(this.linking != null){
                this.updateLinking(event)
            }
        },
        updatePan(event){
            this.pan = {
                x: Math.round(this.panStart.panX + event.clientX - this.panStart.x),
                y: Math.round(this.panStart.panY + event.clientY - this.panStart.y)
            }
        },
        updateDrag(event){
            const node = this.nodes.find(item=> item.id === this.draggingId)
            if(!node) return
            const point = this.toLayerPoint(event)
            if(Math.abs(point.x - this.dragOffset.x - node.x) > 2 || Math.abs(point.y - this.dragOffset.y - node.y) > 2){
                this.dragMoved = true
            }
            node.x = Math.round(point.x - this.dragOffset.x)
            node.y = Math.round(point.y - this.dragOffset.y)
            this.scheduleRects()
        },
        updateLinking(event){
            const point = this.toLayerPoint(event)
            this.linking = { from: this.linking.from, fromSide: this.linking.fromSide, x: point.x, y: point.y }
        },
        async onWindowMouseUp(){
            if(this.panning){
                this.panning = false
                return
            }
            if(this.draggingId !== ""){
                await this.finishDrag()
                return
            }
            if(this.groupDrag != null || this.groupResize != null){
                await this.endGroupGesture()
                return
            }
            if(this.linking != null){
                await this.finishLink()
            }
        },
        async finishDrag(){
            const node = this.nodes.find(item=> item.id === this.draggingId)
            this.draggingId = ""
            if(node != null){
                try{
                    await window.electron.updateGraphNode(node.id, node.x, node.y, undefined)
                }catch(error){
                    ElMessage.error(this.errorText(error) || "位置没存住")
                }
            }
            this.flushReload()
        },
        async finishLink(){
            const link = this.linking
            this.linking = null
            const target = this.hitNode(link.x, link.y)
            if(target != null && target.id !== link.from){
                try{
                    await window.electron.addGraphEdge(link.from, target.id, link.fromSide)
                    await this.loadGraph()
                }catch(error){
                    ElMessage.error(this.errorText(error) || "这条线没连上")
                }
            }
            this.flushReload()
        },
        hitNode(x, y){
            const nodes = this.nodes
            for(let i = nodes.length - 1; i >= 0; i--){
                const rect = this.rects[nodes[i].id]
                if(!rect) continue
                if(x >= rect.x - 4 && x <= rect.x + rect.w + 4 && y >= rect.y - 4 && y <= rect.y + rect.h + 4) return nodes[i]
            }
            return null
        },
        onKeyDown(event){
            if(event.key === "Enter" && this.groupSelected !== "" && this.renamingId === ""){
                const target = event.target
                const tag = target?.tagName
                if(tag === "INPUT" || tag === "TEXTAREA") return
                const group = this.groups.find(item=> item.id === this.groupSelected)
                if(group != null){
                    event.preventDefault()
                    this.startRenameGroup(group)
                }
                return
            }
            if(event.key === "Delete" && this.groupSelected !== "" && this.renamingId === ""){
                const target = event.target
                const tag = target?.tagName
                if(tag === "INPUT" || tag === "TEXTAREA") return
                const group = this.groups.find(item=> item.id === this.groupSelected)
                if(group != null){
                    event.preventDefault()
                    this.confirmRemoveGroup(group)
                }
                return
            }
            if(event.key !== "Escape") return
            this.menu.visible = false
            this.picker.visible = false
            this.openMenuId = ""
            this.linking = null
            this.panning = false
            if(this.renamingId !== "") this.cancelRename()
            else if(this.groupSelected !== "") this.groupSelected = ""
        },
        toggleNodeMenu(id){
            this.openMenuId = this.openMenuId === id ? "" : id
        },
        onCardClick(node){
            if(this.dragMoved){
                this.dragMoved = false
                return
            }
            if(node.type === "note"){
                this.openNote(node)
                return
            }
            const el = this.textEls.get(node.id)
            if(el != null) el.focus()
        },
        openNote(node){
            const target = this.noteList.find(item=> String(item.time) === String(node.tid))
            if(target == null){
                ElMessage.warning("这篇笔记已不存在")
                return
            }
            uiState.focus = false
            const openTab = ()=> emitter.emit("add-tab", {
                title: target.det.title,
                component: NoteEditPage,
                props: { noteData: target },
                closable: true
            })
            if(this.$route.path === "/"){
                openTab()
                return
            }
            this.$router.push("/")
            this.$nextTick(()=> this.$nextTick(openTab))
        },
        onNodeInput(node, event){
            const el = event.target
            node.text = el.value
            el.style.height = "auto"
            el.style.height = el.scrollHeight + "px"
            this.scheduleRects()
            if(this.textTimers[node.id] != null) clearTimeout(this.textTimers[node.id])
            this.textTimers[node.id] = setTimeout(()=>{
                delete this.textTimers[node.id]
                window.electron.updateGraphNode(node.id, undefined, undefined, node.text)
                    .then(()=> this.flushReload())
                    .catch(()=>{})
            }, TEXT_SAVE_DELAY)
        },
        async confirmRemoveNode(node){
            try{
                await ElMessageBox.confirm("删掉它，和它相连的线也会一起消失。", "删掉", {
                    confirmButtonText: "删除",
                    cancelButtonText: "取消",
                    confirmButtonClass: "el-button--danger"
                })
            }catch{
                return
            }
            try{
                await window.electron.removeGraphNode(node.id)
                this.openMenuId = ""
                await this.loadGraph()
            }catch(error){
                ElMessage.error(this.errorText(error) || "没删掉")
            }
        },
        async confirmRemoveEdge(edge){
            try{
                await ElMessageBox.confirm("这条线不要了？", "删掉", {
                    confirmButtonText: "删除",
                    cancelButtonText: "取消",
                    confirmButtonClass: "el-button--danger"
                })
            }catch{
                return
            }
            try{
                await window.electron.removeGraphEdge(edge.id)
                await this.loadGraph()
            }catch(error){
                ElMessage.error(this.errorText(error) || "这条线没删掉")
            }
        },
        fitView(){
            const view = this.$refs.canvasRef?.getBoundingClientRect()
            if(view == null) return
            const rects = this.nodes.map(node=> this.rects[node.id]).filter(item=> item != null)
            // 分组框比里面的笔记大，只看笔记会把框裁掉，所以一起算进来
            const groupRects = this.groups.map(group=>({ x:group.x, y:group.y, w:group.w, h:group.h }))
            const all = rects.concat(groupRects)
            if(all.length === 0){
                this.resetView()
                return
            }
            const fitted = fitBounds(all, view.width, view.height)
            if(fitted == null) return
            this.scale = fitted.scale
            this.pan = fitted.pan
        },
        resetView(){
            this.scale = 1
            this.pan = { x: 40, y: 20 }
        }
    }
}
function sidePoint(rect, side){
    return { x: rect.x + (side === "left" ? 0 : rect.w), y: rect.y + rect.h / 2 }
}
function fitBounds(rects, viewW, viewH){
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    rects.forEach(rect=>{
        minX = Math.min(minX, rect.x)
        minY = Math.min(minY, rect.y)
        maxX = Math.max(maxX, rect.x + rect.w)
        maxY = Math.max(maxY, rect.y + rect.h)
    })
    const contentW = maxX - minX + 80
    const contentH = maxY - minY + 80
    const next = clampScale(Math.min(1, viewW / contentW, viewH / contentH))
    return {
        scale: next,
        pan: {
            x: Math.round(viewW / 2 - (minX + maxX) / 2 * next),
            y: Math.round(viewH / 2 - (minY + maxY) / 2 * next)
        }
    }
}
</script>

<style scoped>
#graph-page{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-1);
}
#graph-header{
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border-1);
    background: var(--surface-1);
}
.graph-title{
    font-size: 15px;
    font-weight: 500;
    color: var(--text-1);
}
.graph-sub{
    margin-top: 3px;
    font-size: 12px;
    color: var(--unhighlight);
}
.graph-head-tools{
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}
.graph-count{
    font-family: var(--font-en);
    font-size: 12px;
    color: var(--unhighlight);
}
.graph-zoom{
    display: flex;
    align-items: center;
    gap: 6px;
}
.graph-zoom .graph-btn{
    width: 28px;
    padding: 0;
    font-family: var(--font-en);
    font-size: 14px;
}
.graph-zoom-value{
    min-width: 42px;
    font-family: var(--font-en);
    font-size: 12px;
    text-align: center;
    color: var(--text-2);
}
.graph-btn{
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    color: var(--text-2);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.graph-btn:hover{
    color: var(--text-1);
    border-color: var(--border-2);
}
#graph-canvas{
    position: relative;
    flex: 1;
    width: 100%;
    overflow: hidden;
    background-color: var(--bg-1);
    background-image: radial-gradient(var(--border-1) 1px, transparent 1px);
    cursor: grab;
    user-select: none;
}
#graph-canvas.panning{
    cursor: grabbing;
}
#graph-layer{
    position: absolute;
    top: 0;
    left: 0;
    width: 6000px;
    height: 4000px;
    transform-origin: 0 0;
}
.graph-group{
    position: absolute;
    z-index: 0;
    box-sizing: border-box;
    padding: 26px 10px 10px;
    border: 1.5px dashed var(--group-edge);
    border-radius: 14px;
    background: var(--group-fill);
    cursor: grab;
}
.graph-group.selected{
    border-style: solid;
    border-width: 2px;
    cursor: grab;
}
.group-title{
    position: absolute;
    top: 4px;
    left: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 20px;
    color: var(--group-color);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    cursor: text;
}
.group-dot{
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
}
.group-name{
    overflow: hidden;
    text-overflow: ellipsis;
}
.group-rename{
    position: absolute;
    top: 2px;
    left: 8px;
    right: 8px;
    z-index: 3;
    height: 22px;
    padding: 0 4px;
    box-sizing: border-box;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-1);
    background: var(--block-2);
    border: 1px solid var(--group-color);
    border-radius: 4px;
    outline: none;
}
.group-handle{
    position: absolute;
    z-index: 2;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    background: var(--group-color);
    border: 1.5px solid var(--bg-1);
    opacity: 0;
    cursor: nwse-resize;
    transition: opacity 0.14s var(--ease);
}
.graph-group:hover .group-handle,
.graph-group.selected .group-handle{
    opacity: 0.85;
}
.handle-nw{
    top: -6px;
    left: -6px;
    cursor: nwse-resize;
}
.handle-ne{
    top: -6px;
    right: -6px;
    cursor: nesw-resize;
}
.handle-sw{
    bottom: -6px;
    left: -6px;
    cursor: nesw-resize;
}
.handle-se{
    bottom: -6px;
    right: -6px;
    cursor: nwse-resize;
}
.group-actions{
    position: absolute;
    top: 3px;
    right: 6px;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 4px;
}
.group-btn{
    width: 14px;
    height: 14px;
    padding: 0;
    border: 1.5px solid var(--bg-1);
    border-radius: 50%;
    cursor: pointer;
}
.group-btn:hover{
    transform: scale(1.15);
}
.group-btn-text{
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    line-height: 1;
    color: var(--text-1);
    background: var(--block-2);
    cursor: pointer;
}
#graph-wires{
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    overflow: visible;
    pointer-events: none;
}
.wire-line{
    stroke: var(--border-2);
    stroke-width: 1.4;
}
.wire-ghost{
    stroke: var(--accent-strong);
    stroke-width: 1.4;
    stroke-dasharray: 5 4;
}
.wire-del{
    fill: transparent;
    pointer-events: auto;
    cursor: pointer;
}
.wire-del-bg{
    fill: var(--surface-1);
    stroke: var(--border-2);
    stroke-width: 1;
    opacity: 0;
    transition: opacity 0.15s var(--ease);
}
.wire-del-text{
    font-size: 13px;
    fill: var(--text-1);
    text-anchor: middle;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s var(--ease);
}
.wire:hover .wire-del-bg,.wire:hover .wire-del-text{
    opacity: 1;
}
.graph-node{
    position: absolute;
    z-index: 2;
    display: flex;
    align-items: center;
    cursor: default;
}
.node-card{
    position: relative;
    flex: 0 0 200px;
    width: 200px;
    padding: 8px 10px 10px;
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-left: 3px solid var(--accent-strong);
    border-radius: var(--radius-1);
    cursor: pointer;
    transition: border-color 0.15s var(--ease);
}
.graph-node.type-text .node-card{
    border-left-color: var(--unhighlight);
}
.node-card:hover{
    border-color: var(--border-2);
    border-left-color: var(--accent-strong);
}
.node-head{
    display: flex;
    align-items: center;
    gap: 6px;
}
.node-kind{
    flex-shrink: 0;
    padding: 1px 5px;
    font-family: var(--font-en);
    font-size: 10px;
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-radius: 3px;
}
.type-text .node-kind{
    color: var(--unhighlight);
    background: transparent;
    border: 1px solid var(--border-1);
}
.node-name{
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.node-more{
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    font-size: 13px;
    line-height: 1;
    color: var(--unhighlight);
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: color 0.15s var(--ease), background 0.15s var(--ease);
}
.node-more:hover{
    color: var(--text-1);
    background: var(--accent-soft);
}
.node-body{
    margin-top: 6px;
}
.node-open{
    font-size: 12px;
    color: var(--unhighlight);
    transition: color 0.15s var(--ease);
}
.node-card:hover .node-open{
    color: var(--accent-strong);
}
.node-input{
    display: block;
    box-sizing: border-box;
    width: 100%;
    max-width: 176px;
    min-height: 56px;
    padding: 4px 6px;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-1);
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 3px;
    resize: none;
    overflow: hidden;
}
.node-input:focus{
    outline: none;
    border-color: var(--accent-border);
}
.node-port{
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    font-size: 13px;
    line-height: 1;
    color: var(--text-2);
    background: var(--surface-1);
    border: 1px solid var(--border-1);
    border-radius: 50%;
    cursor: crosshair;
    opacity: 0;
    transition: opacity 0.15s var(--ease), color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.graph-node:hover .node-port{
    opacity: 1;
}
.node-port:hover{
    color: var(--accent-strong);
    border-color: var(--accent-strong);
}
.node-menu{
    position: absolute;
    top: 26px;
    right: 6px;
    z-index: 6;
    min-width: 92px;
    padding: 4px;
    background: var(--surface-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
}
.node-menu-item{
    display: block;
    width: 100%;
    padding: 6px 10px;
    font-size: 12px;
    text-align: left;
    color: var(--text-1);
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s var(--ease);
}
.node-menu-item:hover{
    background: var(--accent-soft);
}
.node-menu-item.danger{
    color: #ff4d4f;
}
.node-menu-item.danger:hover{
    color: #fff;
    background: #ff4d4f;
}
.graph-empty{
    position: absolute;
    top: 120px;
    left: 120px;
    font-size: 13px;
    color: var(--unhighlight);
}
.graph-menu{
    position: fixed;
    z-index: 30;
    min-width: 150px;
    padding: 4px;
    background: var(--surface-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
}
.graph-menu-item{
    display: block;
    width: 100%;
    padding: 7px 10px;
    font-size: 12px;
    text-align: left;
    color: var(--text-1);
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s var(--ease);
}
.graph-menu-item:hover{
    color: var(--accent-strong);
    background: var(--accent-soft);
}
.graph-menu-sep{
    height: 1px;
    margin: 4px 2px;
    background: var(--border-1);
}
.graph-picker-mask{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 34;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.28);
}
.graph-picker{
    width: 420px;
    max-width: calc(100% - 40px);
    max-height: 70%;
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: var(--surface-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
}
.picker-title{
    font-size: 14px;
    color: var(--text-1);
}
.picker-search{
    height: 30px;
    margin-top: 12px;
    padding: 0 10px;
    font-family: inherit;
    font-size: 13px;
    color: var(--text-1);
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
}
.picker-search:focus{
    outline: none;
    border-color: var(--accent-border);
}
.picker-list{
    flex: 1;
    min-height: 120px;
    margin-top: 10px;
    overflow-y: auto;
}
.picker-item{
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-1);
    cursor: pointer;
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.picker-item:hover{
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.picker-item-title{
    font-size: 13px;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.picker-item-meta{
    margin-top: 3px;
    font-family: var(--font-en);
    font-size: 11px;
    color: var(--unhighlight);
}
.picker-empty{
    padding: 20px 4px;
    font-size: 12px;
    text-align: center;
    color: var(--unhighlight);
}
.picker-ops{
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
}
</style>
