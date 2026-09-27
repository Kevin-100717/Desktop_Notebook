const fs = require("fs")
const path = require("path")
const { getNotes } = require("./noteFile")

const GRAPH_VERSION = 1
const MAX_NODES = 500
const MAX_EDGES = 2000
const MAX_TEXT_LENGTH = 2000
const WATCH_INTERVAL = 200
const WATCH_DEBOUNCE = 100

let dataDir = null
let graphPath = ""
let watcher = null

function graph_init(dir){
    dataDir = dir
    graphPath = path.join(dataDir, "graph.json")
    if(!fs.existsSync(graphPath)) writeGraph({ version:GRAPH_VERSION, nodes:[], edges:[] })
    return graphPath
}
function getGraphPath(){
    return graphPath
}
function newId(prefix){
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,6)
}
function writeAtomic(file,content){
    const tempPath = file + ".tmp-" + process.pid + "-" + Date.now()
    try{
        fs.writeFileSync(tempPath, content, "utf-8")
        fs.renameSync(tempPath, file)
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
    const graph = { version:GRAPH_VERSION, nodes:[], edges:[] }
    if(data == null || typeof data !== "object") return graph
    Object.keys(data).forEach(key=>{
        if(key === "version" || key === "nodes" || key === "edges") return
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
    return graph
}
function readGraph(){
    if(!graphPath) throw new Error("graph is not inited")
    if(!fs.existsSync(graphPath)) return { version:GRAPH_VERSION, nodes:[], edges:[] }
    let parsed = null
    try{
        parsed = JSON.parse(fs.readFileSync(graphPath, "utf-8"))
    }catch(error){
        parsed = null
    }
    if(parsed == null || typeof parsed !== "object"){
        try{
            const backup = graphPath + ".broken-" + Date.now()
            fs.copyFileSync(graphPath, backup)
            console.warn("[graphFile] graph.json 解析失败，已备份为 " + path.basename(backup) + " 并重建空画布")
        }catch(error){}
        parsed = { version:GRAPH_VERSION, nodes:[], edges:[] }
    }
    return normalizeGraph(parsed)
}
function noteTitleMap(){
    const map = new Map()
    let list = null
    try{
        list = getNotes()
    }catch(error){
        return map
    }
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
    const sync = syncWithNotes(graph)
    if(sync.pruned > 0 || sync.dropped > 0) writeGraph(graph)
    return graph
}
function nextFreeSpot(){
    const graph = readGraph()
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
    const spot = Number.isFinite(data.x) && Number.isFinite(data.y) ? { x:data.x, y:data.y } : nextFreeSpot()
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
    const spot = Number.isFinite(payload.x) && Number.isFinite(payload.y) ? { x:payload.x, y:payload.y } : nextFreeSpot()
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
    watchGraph: watchGraph
}
