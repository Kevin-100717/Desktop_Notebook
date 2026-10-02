const fs = require("fs")
const path = require("path")
const { getNotes } = require("./noteFile")

const GRAPH_VERSION = 1
const MAX_NODES = 500
const MAX_EDGES = 2000
const MAX_GROUPS = 200
const MIN_GROUP_SIZE = 120
const MAX_GROUP_TITLE = 40
const MAX_TEXT_LENGTH = 2000
const WATCH_INTERVAL = 200
const WATCH_DEBOUNCE = 100

let dataDir = null
let graphPath = ""
let watcher = null

function graph_init(dir){
    dataDir = dir
    graphPath = path.join(dataDir, "graph.json")
    if(!fs.existsSync(graphPath)) writeGraph({ version:GRAPH_VERSION, nodes:[], edges:[], groups:[] })
    return graphPath
}
function getGraphPath(){
    return graphPath
}
function newId(prefix){
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,6)
}
const LOCK_CODES = new Set(["EPERM","EBUSY","EACCES"])
function retryRename(from,to){
    // Windows 上目标可能瞬时被占用，renameSync 会丢 EPERM/EBUSY，稍等重试
    let attempts = 0
    for(;;){
        try{
            fs.renameSync(from,to)
            return
        }catch(error){
            if(!LOCK_CODES.has(error && error.code)) throw error
            attempts++
            if(attempts > 8) throw error
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,40)
        }
    }
}
function writeAtomic(file,content){
    const tempPath = file + ".tmp-" + process.pid + "-" + Date.now()
    try{
        fs.writeFileSync(tempPath, content, "utf-8")
        retryRename(tempPath, file)
    }catch(error){
        try{ fs.unlinkSync(tempPath) }catch{}
        throw error
    }
}
function writeGraph(graph){
    if(!graphPath) throw new Error("graph is not inited")
    writeAtomic(graphPath, JSON.stringify(graph, null, 2))
    return graph
}
function normalizeNode(item){
    if(item == null || typeof item !== "object") return null
    if(typeof item.id !== "string" || item.id.length === 0) return null
    const x = Number.isFinite(item.x) ? item.x : 0
    const y = Number.isFinite(item.y) ? item.y : 0
    if(item.type === "note"){
        const tid = Number(item.tid)
        if(!Number.isFinite(tid)) return null
        return {
            id: item.id,
            type: "note",
            tid: tid,
            title: typeof item.title === "string" ? item.title : "",
            x: x,
            y: y
        }
    }
    return {
        id: item.id,
        type: "text",
        text: typeof item.text === "string" ? item.text.slice(0, MAX_TEXT_LENGTH) : "",
        x: x,
        y: y
    }
}
const GROUP_COLOR_POOL = ["#e5484d","#f76808","#e8d531","#46a758","#12a594","#0090ff","#8e4ec6","#e93d82"]
const GROUP_OPACITY_MIN = 0.05
const GROUP_OPACITY_MAX = 0.4

// 分组框：位置、大小、标题和颜色都存起来；宽高有下限，免得缩成一个点找不回来。
function normalizeGroup(item){
    if(item == null || typeof item !== "object") return null
    if(typeof item.id !== "string" || item.id.length === 0) return null
    const x = Number.isFinite(item.x) ? item.x : 0
    const y = Number.isFinite(item.y) ? item.y : 0
    const w = Number.isFinite(item.w) ? item.w : 360
    const h = Number.isFinite(item.h) ? item.h : 260
    let color = typeof item.color === "string" ? item.color.trim().toLowerCase() : ""
    if(!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) color = GROUP_COLOR_POOL[0]
    let opacity = Number(item.opacity)
    if(!Number.isFinite(opacity)) opacity = 0.14
    opacity = Math.min(GROUP_OPACITY_MAX,Math.max(GROUP_OPACITY_MIN,opacity))
    return {
        id: item.id,
        title: typeof item.title === "string" ? item.title.slice(0, MAX_GROUP_TITLE) : "",
        color: color,
        opacity: opacity,
        x: x,
        y: y,
        w: Math.max(MIN_GROUP_SIZE,w),
        h: Math.max(MIN_GROUP_SIZE,h)
    }
}
function addGroup(data){
    if(!graphPath) throw new Error("graph is not inited")
    const payload = data != null && typeof data === "object" ? data : {}
    const graph = readGraph()
    if(Array.isArray(graph.groups) && graph.groups.length >= MAX_GROUPS) throw new Error("too many groups")
    const group = normalizeGroup({
        id: newId("gp"),
        title: typeof payload.title === "string" ? payload.title : "",
        color: payload.color,
        opacity: payload.opacity,
        x: Number.isFinite(payload.x) ? payload.x : 60,
        y: Number.isFinite(payload.y) ? payload.y : 60,
        w: Number.isFinite(payload.w) ? payload.w : 420,
        h: Number.isFinite(payload.h) ? payload.h : 300
    })
    graph.groups.push(group)
    writeGraph(graph)
    return group
}
function updateGroup(data){
    if(!graphPath) throw new Error("graph is not inited")
    if(data == null || typeof data !== "object" || typeof data.id !== "string") throw new Error("invalid graph group payload")
    const graph = readGraph()
    const group = graph.groups.find(item=> item.id === data.id)
    if(group == null) throw new Error("graph group is not found")
    if(typeof data.title === "string") group.title = data.title.slice(0, MAX_GROUP_TITLE)
    if(typeof data.color === "string"){
        const color = data.color.trim().toLowerCase()
        if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) group.color = color
    }
    if(Number.isFinite(data.opacity)){
        group.opacity = Math.min(GROUP_OPACITY_MAX,Math.max(GROUP_OPACITY_MIN,data.opacity))
    }
    if(Number.isFinite(data.x)) group.x = data.x
    if(Number.isFinite(data.y)) group.y = data.y
    if(Number.isFinite(data.w)) group.w = Math.max(MIN_GROUP_SIZE,data.w)
    if(Number.isFinite(data.h)) group.h = Math.max(MIN_GROUP_SIZE,data.h)
    writeGraph(graph)
    return group
}
function removeGroup(data){
    if(!graphPath) throw new Error("graph is not inited")
    if(data == null || typeof data !== "object" || typeof data.id !== "string") throw new Error("invalid graph group payload")
    const graph = readGraph()
    const index = graph.groups.findIndex(item=> item.id === data.id)
    if(index === -1) throw new Error("graph group is not found")
    const removed = graph.groups.splice(index, 1)[0]
    writeGraph(graph)
    return { id: data.id, removed: removed }
}
function normalizeEdge(item, alive){
    if(item == null || typeof item !== "object") return null
    if(typeof item.id !== "string" || item.id.length === 0) return null
    if(typeof item.from !== "string" || typeof item.to !== "string") return null
    if(item.from === item.to) return null
    if(!alive.has(item.from) || !alive.has(item.to)) return null
    return {
        id: item.id,
        from: item.from,
        to: item.to,
        fromSide: item.fromSide === "left" ? "left" : "right"
    }
}
function normalizeGraph(data){
    const graph = { version:GRAPH_VERSION, nodes:[], edges:[], groups:[] }
    if(data == null || typeof data !== "object") return graph
    Object.keys(data).forEach(key=>{
        if(key === "version" || key === "nodes" || key === "edges" || key === "groups") return
        graph[key] = data[key]                                   // 保留高版本写入的未知字段
    })
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    const ids = new Set()
    nodes.forEach(item=>{
        const node = normalizeNode(item)
        if(node == null || ids.has(node.id)) return
        ids.add(node.id)
        graph.nodes.push(node)
    })
    const pairs = new Set()
    const edges = Array.isArray(data.edges) ? data.edges : []
    edges.forEach(item=>{
        const edge = normalizeEdge(item, ids)
        if(edge == null) return
        const pair = [edge.from, edge.to].sort().join("|")
        if(pairs.has(pair)) return
        pairs.add(pair)
        graph.edges.push(edge)
    })
    // 老版本的 graph.json 里没有 groups，这里补一个空数组，界面上不会出现「未定义」
    const groups = Array.isArray(data.groups) ? data.groups : []
    const groupIds = new Set()
    groups.forEach(item=>{
        const group = normalizeGroup(item)
        if(group == null || groupIds.has(group.id)) return
        groupIds.add(group.id)
        graph.groups.push(group)
    })
    return graph
}
function readGraph(){
    if(!graphPath) throw new Error("graph is not inited")
    if(!fs.existsSync(graphPath)) return { version:GRAPH_VERSION, nodes:[], edges:[], groups:[] }
    let raw = null
    try{
        raw = fs.readFileSync(graphPath, "utf-8")
    }catch(error){
        // 读失败不能当空画布：空画布会被下一次保存覆盖掉，等于整张图没了
        if(!error || error.code !== "ENOENT") throw error
    }
    let parsed = null
    try{
        parsed = raw != null ? JSON.parse(raw) : null
    }catch(error){
        // 可能是外部程序正在写，读到半截字节：再读一次，字节变了就抛出去让调用方重试，
        // 不能当成损坏重建空画布（那会把真实布局顶掉）
        let again = null
        try{
            again = fs.readFileSync(graphPath, "utf-8")
        }catch{}
        if(again !== raw) throw new Error("graph.json 正在被写入，稍后再试")
        parsed = null
    }
    if(parsed == null || typeof parsed !== "object"){
        try{
            const dir = path.dirname(graphPath), base = path.basename(graphPath)
            // 一直读不出来时只备一次，别每次读都复制一份堆满目录
            if(!fs.readdirSync(dir).some(name=>name.startsWith(base+".broken-"))){
                const backup = graphPath + ".broken-" + Date.now()
                fs.copyFileSync(graphPath, backup)
                console.warn("[graphFile] graph.json 解析失败，已备份为 " + path.basename(backup) + " 并重建空画布")
            }
        }catch(error){}
        parsed = { version:GRAPH_VERSION, nodes:[], edges:[], groups:[] }
    }
    return normalizeGraph(parsed)
}
function noteTitleMap(){
    const map = new Map()
    // 读列表失败必须往上抛：当成“没有笔记”会把所有笔记节点修剪掉，布局就没了
    const list = getNotes()
    const notes = list != null && Array.isArray(list.notes) ? list.notes : []
    notes.forEach(item=>{
        if(item == null || item.time == null) return
        map.set(String(item.time), typeof item.det?.title === "string" ? item.det.title : "")
    })
    return map
}
function syncWithNotes(graph){
    const titles = noteTitleMap()
    const alive = []
    const aliveIds = new Set()
    let pruned = 0
    graph.nodes.forEach(node=>{
        if(node.type !== "note"){
            alive.push(node)
            aliveIds.add(node.id)
            return
        }
        if(!titles.has(String(node.tid))){
            pruned++
            return
        }
        node.title = titles.get(String(node.tid))
        alive.push(node)
        aliveIds.add(node.id)
    })
    const edges = graph.edges.filter(edge=> aliveIds.has(edge.from) && aliveIds.has(edge.to))
    const dropped = graph.edges.length - edges.length
    graph.nodes = alive
    graph.edges = edges
    return { pruned: pruned, dropped: dropped }
}
function getGraph(){
    const graph = readGraph()
    let sync
    try{
        sync = syncWithNotes(graph)
    }catch(error){
        // 笔记列表暂时读不到就原样返回，绝不能按“没有笔记”修剪
        return graph
    }
    if(sync.pruned > 0 || sync.dropped > 0) writeGraph(graph)
    return graph
}
function nextFreeSpot(graph){
    if(graph.nodes.length === 0) return { x: 120, y: 120 }
    let maxX = 0
    let maxY = 0
    graph.nodes.forEach(node=>{
        maxX = Math.max(maxX, node.x)
        maxY = Math.max(maxY, node.y)
    })
    return { x: maxX + 260, y: maxY }
}
function addNoteNode(data){
    if(!graphPath) throw new Error("graph is not inited")
    if(data == null || typeof data !== "object") throw new Error("invalid graph node payload")
    const tid = Number(data.tid)
    if(!Number.isFinite(tid)) throw new Error("invalid note id")
    const titles = noteTitleMap()
    if(!titles.has(String(tid))) throw new Error("note is not found")
    const graph = readGraph()
    syncWithNotes(graph)
    if(graph.nodes.length >= MAX_NODES) throw new Error("too many nodes")
    const spot = Number.isFinite(data.x) && Number.isFinite(data.y) ? { x:data.x, y:data.y } : nextFreeSpot(graph)
    const node = { id:newId("g"), type:"note", tid:tid, title:titles.get(String(tid)), x:spot.x, y:spot.y }
    graph.nodes.push(node)
    writeGraph(graph)
    return node
}
function addTextNode(data){
    if(!graphPath) throw new Error("graph is not inited")
    const payload = data != null && typeof data === "object" ? data : {}
    const graph = readGraph()
    syncWithNotes(graph)
    if(graph.nodes.length >= MAX_NODES) throw new Error("too many nodes")
    const spot = Number.isFinite(payload.x) && Number.isFinite(payload.y) ? { x:payload.x, y:payload.y } : nextFreeSpot(graph)
    const node = {
        id: newId("g"),
        type: "text",
        text: typeof payload.text === "string" ? payload.text.slice(0, MAX_TEXT_LENGTH) : "",
        x: spot.x,
        y: spot.y
    }
    graph.nodes.push(node)
    writeGraph(graph)
    return node
}
function updateNode(data){
    if(!graphPath) throw new Error("graph is not inited")
    if(data == null || typeof data !== "object" || typeof data.id !== "string") throw new Error("invalid graph node payload")
    const graph = readGraph()
    syncWithNotes(graph)
    const node = graph.nodes.find(item=> item.id === data.id)
    if(node == null) throw new Error("graph node is not found")
    if(Number.isFinite(data.x)) node.x = data.x
    if(Number.isFinite(data.y)) node.y = data.y
    if(typeof data.text === "string") node.text = data.text.slice(0, MAX_TEXT_LENGTH)
    writeGraph(graph)
    return node
}
function removeNode(data){
    if(!graphPath) throw new Error("graph is not inited")
    if(data == null || typeof data !== "object" || typeof data.id !== "string") throw new Error("invalid graph node payload")
    const graph = readGraph()
    const index = graph.nodes.findIndex(item=> item.id === data.id)
    if(index === -1) throw new Error("graph node is not found")
    graph.nodes.splice(index, 1)
    const before = graph.edges.length
    graph.edges = graph.edges.filter(edge=> edge.from !== data.id && edge.to !== data.id)
    writeGraph(graph)
    return { id: data.id, removedEdges: before - graph.edges.length }
}
function addEdge(data){
    if(!graphPath) throw new Error("graph is not inited")
    if(data == null || typeof data !== "object") throw new Error("invalid graph edge payload")
    if(typeof data.from !== "string" || typeof data.to !== "string") throw new Error("invalid graph edge payload")
    if(data.from === data.to) throw new Error("cannot link a node to itself")
    const graph = readGraph()
    syncWithNotes(graph)
    const ids = new Set(graph.nodes.map(item=> item.id))
    if(!ids.has(data.from) || !ids.has(data.to)) throw new Error("graph node is not found")
    if(graph.edges.length >= MAX_EDGES) throw new Error("too many edges")
    const pair = [data.from, data.to].sort().join("|")
    if(graph.edges.some(edge=> [edge.from, edge.to].sort().join("|") === pair)) return { duplicated:true }
    const edge = {
        id: newId("e"),
        from: data.from,
        to: data.to,
        fromSide: data.fromSide === "left" ? "left" : "right"
    }
    graph.edges.push(edge)
    writeGraph(graph)
    return edge
}
function removeEdge(data){
    if(!graphPath) throw new Error("graph is not inited")
    if(data == null || typeof data !== "object" || typeof data.id !== "string") throw new Error("invalid graph edge payload")
    const graph = readGraph()
    const index = graph.edges.findIndex(item=> item.id === data.id)
    if(index === -1) throw new Error("graph edge is not found")
    graph.edges.splice(index, 1)
    writeGraph(graph)
    return { id:data.id }
}
function watchGraph(callback){
    if(typeof callback !== "function") return
    if(watcher != null) return
    if(!graphPath) return
    let timer = null
    watcher = fs.watchFile(graphPath, { interval: WATCH_INTERVAL }, ()=>{
        if(timer != null) clearTimeout(timer)
        timer = setTimeout(()=>{
            timer = null
            try{
                callback()
            }catch(error){}
        }, WATCH_DEBOUNCE)
    })
}
module.exports = {
    graph_init: graph_init,
    getGraphPath: getGraphPath,
    getGraph: getGraph,
    addNoteNode: addNoteNode,
    addTextNode: addTextNode,
    updateNode: updateNode,
    removeNode: removeNode,
    addEdge: addEdge,
    removeEdge: removeEdge,
    addGroup: addGroup,
    updateGroup: updateGroup,
    removeGroup: removeGroup,
    watchGraph: watchGraph
}
