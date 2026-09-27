<template>
<div id="graph-page">
    <header id="graph-header">
        <div class="graph-head-text">
            <p class="graph-title">知识网</p>
            <p class="graph-sub">编辑我的知识网 · 拖动空白处平移 · 滚轮缩放 · 右键新建节点 · 拖动节点两侧的加号建立联系</p>
        </div>
        <div class="graph-head-tools">
            <span class="graph-count">{{ nodes.length }} 个节点 · {{ edges.length }} 条联系</span>
            <div class="graph-zoom">
                <button class="graph-btn" title="缩小" @click="zoomOut">−</button>
                <span class="graph-zoom-value">{{ zoomText }}</span>
                <button class="graph-btn" title="放大" @click="zoomIn">＋</button>
            </div>
            <button class="graph-btn" @click="fitView">适应视图</button>
            <button class="graph-btn" @click="resetView">回到原点</button>
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
                <div class="node-port left" title="向左引出联系" @mousedown.stop="startLink($event, node, 'left')">+</div>
                <div class="node-card" @click.stop="onCardClick(node)">
                    <div class="node-head">
                        <span class="node-kind">{{ node.type === 'note' ? '笔记' : '注释' }}</span>
                        <span class="node-name" :title="node.type === 'note' ? node.title : '注释节点'">{{ node.type === 'note' ? node.title : '注释' }}</span>
                        <button class="node-more" title="更多" @mousedown.stop @click.stop="toggleNodeMenu(node.id)">⋯</button>
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
                    <div v-else class="node-body node-open">打开笔记</div>
                    <div v-if="openMenuId === node.id" class="node-menu" @mousedown.stop @click.stop>
                        <button class="node-menu-item danger" @click="confirmRemoveNode(node)">删除节点</button>
                    </div>
                </div>
                <div class="node-port right" title="向右引出联系" @mousedown.stop="startLink($event, node, 'right')">+</div>
            </div>

            <p v-if="nodes.length === 0" class="graph-empty">在空白处右键 → 新建知识节点 / 新建注释</p>
        </div>
    </div>

    <div
        v-if="menu.visible"
        class="graph-menu"
        :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
        @mousedown.stop
        @contextmenu.prevent
    >
        <button class="graph-menu-item" @click="menuAction('note')">新建知识节点</button>
        <button class="graph-menu-item" @click="menuAction('text')">新建注释</button>
        <div class="graph-menu-sep"></div>
        <button class="graph-menu-item" @click="menuAction('fit')">适应视图</button>
    </div>

    <div v-if="picker.visible" class="graph-picker-mask" @mousedown.self="picker.visible = false">
        <div class="graph-picker">
            <p class="picker-title">选择一篇笔记作为知识节点</p>
            <input v-model="picker.keyword" class="picker-search" placeholder="搜索标题或标签" />
            <div class="picker-list">
                <p v-if="pickerList.length === 0" class="picker-empty">
                    {{ noteList.length === 0 ? '还没有笔记，先去笔记页新建一篇' : '没有匹配的笔记' }}
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
                <button class="graph-btn" @click="picker.visible = false">取消</button>
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

function clampScale(value){
    if(!Number.isFinite(value)) return 1
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export default {
    data(){
        return {
            LAYER_W: LAYER_W,
            nodes: [],
            edges: [],
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
        window.addEventListener("mousemove", this.onWindowMouseMove)
        window.addEventListener("mouseup", this.onWindowMouseUp)
        window.addEventListener("keydown", this.onKeyDown)
        document.addEventListener("mousedown", this.onDocMouseDown)
        window.addEventListener("resize", this.scheduleRects)
        this.offGraph = window.electron.onGraphUpdated(()=> this.requestReload())
        this.offNote = window.electron.onNoteUpdated(()=>{
            this.loadNotes()
            this.requestReload()
        })
        await this.loadGraph()
        await this.loadNotes()
    },
    activated(){
        uiState.focus = false
        this.loadGraph()
    },
    beforeUnmount(){
        window.removeEventListener("mousemove", this.onWindowMouseMove)
        window.removeEventListener("mouseup", this.onWindowMouseUp)
        window.removeEventListener("keydown", this.onKeyDown)
        document.removeEventListener("mousedown", this.onDocMouseDown)
        window.removeEventListener("resize", this.scheduleRects)
        if(this.rafId) cancelAnimationFrame(this.rafId)
        Object.values(this.textTimers).forEach(timer=> clearTimeout(timer))
        if(this.offGraph) this.offGraph()
        if(this.offNote) this.offNote()
    },
    methods: {
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
                this.$nextTick(()=> this.refreshRects())
            }catch(error){
                ElMessage.error(this.errorText(error) || "知识网加载失败")
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
            if(this.draggingId !== "" || this.linking != null || this.busyText()){
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
            this.createTextNode()
        },
        async createTextNode(){
            try{
                await window.electron.addGraphTextNode(this.menuLayer.x, this.menuLayer.y, "")
                await this.loadGraph()
            }catch(error){
                ElMessage.error(this.errorText(error) || "注释创建失败")
            }
        },
        async createNoteNode(item){
            this.picker.visible = false
            try{
                await window.electron.addGraphNoteNode(item.time, this.menuLayer.x, this.menuLayer.y)
                await this.loadGraph()
            }catch(error){
                ElMessage.error(this.errorText(error) || "知识节点创建失败")
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
                this.pan = {
                    x: Math.round(this.panStart.panX + event.clientX - this.panStart.x),
                    y: Math.round(this.panStart.panY + event.clientY - this.panStart.y)
                }
                return
            }
            if(this.draggingId !== ""){
                const node = this.nodes.find(item=> item.id === this.draggingId)
                if(!node) return
                const point = this.toLayerPoint(event)
                if(Math.abs(point.x - this.dragOffset.x - node.x) > 2 || Math.abs(point.y - this.dragOffset.y - node.y) > 2){
                    this.dragMoved = true
                }
                node.x = Math.round(point.x - this.dragOffset.x)
                node.y = Math.round(point.y - this.dragOffset.y)
                this.scheduleRects()
                return
            }
            if(this.linking != null){
                const point = this.toLayerPoint(event)
                this.linking = { from: this.linking.from, fromSide: this.linking.fromSide, x: point.x, y: point.y }
            }
        },
        async onWindowMouseUp(){
            if(this.panning){
                this.panning = false
                return
            }
            if(this.draggingId !== ""){
                const node = this.nodes.find(item=> item.id === this.draggingId)
                this.draggingId = ""
                if(node != null){
                    try{
                        await window.electron.updateGraphNode(node.id, node.x, node.y, undefined)
                    }catch(error){
                        ElMessage.error(this.errorText(error) || "节点位置保存失败")
                    }
                }
                this.flushReload()
                return
            }
            if(this.linking != null){
                const link = this.linking
                this.linking = null
                const target = this.hitNode(link.x, link.y)
                if(target != null && target.id !== link.from){
                    try{
                        await window.electron.addGraphEdge(link.from, target.id, link.fromSide)
                        await this.loadGraph()
                    }catch(error){
                        ElMessage.error(this.errorText(error) || "联系创建失败")
                    }
                }
                this.flushReload()
            }
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
            if(event.key !== "Escape") return
            this.menu.visible = false
            this.picker.visible = false
            this.openMenuId = ""
            this.linking = null
            this.panning = false
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
                await ElMessageBox.confirm("删除后该节点和它的所有联系都会消失，确定吗？", "删除节点", {
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
                ElMessage.error(this.errorText(error) || "节点删除失败")
            }
        },
        async confirmRemoveEdge(edge){
            try{
                await ElMessageBox.confirm("确定删除这条联系吗？", "删除联系", {
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
                ElMessage.error(this.errorText(error) || "联系删除失败")
            }
        },
        fitView(){
            const view = this.$refs.canvasRef?.getBoundingClientRect()
            if(view == null) return
            const rects = this.nodes.map(node=> this.rects[node.id]).filter(item=> item != null)
            if(rects.length === 0){
                this.resetView()
                return
            }
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
            const next = clampScale(Math.min(1, view.width / contentW, view.height / contentH))
            this.scale = next
            this.pan = {
                x: Math.round(view.width / 2 - (minX + maxX) / 2 * next),
                y: Math.round(view.height / 2 - (minY + maxY) / 2 * next)
            }
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
#graph-wires{
    position: absolute;
    top: 0;
    left: 0;
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
