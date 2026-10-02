const { ipcMain, shell, dialog, app, BrowserWindow } = require("electron")
const { existsSync, mkdirSync, rmSync } = require("fs")
const path = require("path")
const { getConfig, setSetting:applySetting, getRootDir, hasSettingKey } = require("./configInit")
const { getNotes,readNote, saveNote, saveNoteImage, getNoteHistory, readNoteHistory, restoreNoteHistory, createNote, deleteNote, renameNote, getTrash:getNoteTrash, restoreNote, purgeNote, emptyTrash:emptyNoteTrash, getTags, setNoteTags, renameTag, removeTag, watchNotes } = require("./noteFile")
const { getStickies,readSticky, saveSticky, createSticky, deleteSticky, getTrash:getStickyTrash, restoreSticky, purgeSticky, emptyTrash:emptyStickyTrash, watchSticky } = require("./labelFile")
const { searchAll, getNoteBacklinks } = require("./searchFile")
const { importNotesFromFiles, importNotesFromFolder, exportNote, exportSticky, backupData } = require("./transferFile")
const { exportNoteDoc, writeTempHtml } = require("./exportDoc")
const { getGraph, addNoteNode, addTextNode, updateNode: updateGraphNode, removeNode: removeGraphNode, addEdge, removeEdge, addGroup, updateGroup, removeGroup, watchGraph } = require("./graphFile")

const windows = new Set()
let initialized = false
let settingValidator = null

function setSettingValidator(fn){
    settingValidator = typeof fn === "function" ? fn : null
}

function getUserInfo(){
    return getConfig("userKey")
}
function getSetting(event,key){
    return getConfig(key)
}
function setSetting(event,args){
    if(!args || typeof args.key !== "string" || !hasSettingKey(args.key)){
        throw new Error("invalid setting key")
    }
    if(args.key === "theme" && args.value !== "light" && args.value !== "dark"){
        throw new Error("invalid theme value")
    }
    if(args.key === "closeToTray" && typeof args.value !== "boolean"){
        throw new Error("invalid closeToTray value")
    }
    if(args.key === "accentColor"){
        const hex = typeof args.value === "string" ? args.value.trim() : ""
        if(hex !== "" && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)){
            throw new Error("invalid accentColor value")
        }
    }
    if(args.key === "customColors" && (args.value == null || typeof args.value !== "object" || Array.isArray(args.value))){
        throw new Error("invalid customColors value")
    }
    if(settingValidator){
        const error = settingValidator({ key:args.key, value:args.value })
        if(typeof error === "string" && error.length > 0) throw new Error(error)
    }
    applySetting({ key:args.key, value:args.value })
    sendSettingUpdate({key:args.key,value:args.value})
    return "success"
}
function getNoteList(){
    return getNotes()
}
function getNoteContent(event,args){
    return readNote(args)
}
function saveNoteData(event,args){
    return saveNote(args)
}
function saveNoteImageData(event,args){
    if(!args) throw new Error("invalid image payload")
    return saveNoteImage(args)
}
function getNoteHistoryData(event,tid){
    return getNoteHistory(tid)
}
function readNoteHistoryData(event,args){
    if(!args) throw new Error("invalid history payload")
    return readNoteHistory(args)
}
function restoreNoteHistoryData(event,args){
    if(!args) throw new Error("invalid history payload")
    const result = restoreNoteHistory(args)
    sendNoteUpdate({tid:args.tid,content:readNote(args.tid)})
    return result
}
function createNoteData(event,title){
    return createNote(title)
}
function deleteNoteData(event,tid){
    const result = deleteNote(tid)
    sendNoteUpdate({deleted:true,tid:tid})
    return result
}
function renameNoteData(event,args){
    if(!args) throw new Error("invalid rename payload")
    const result = renameNote({tid:args.tid,title:args.title})
    sendNoteUpdate({list:true})
    return result
}
function getNoteTags(){
    return getTags()
}
function setNoteTagsData(event,args){
    if(!args) throw new Error("invalid tag payload")
    return setNoteTags(args.tid,args.tags)
}
function renameTagData(event,args){
    if(!args) throw new Error("invalid tag payload")
    const result = renameTag({ from:args.from, to:args.to })
    sendNoteUpdate({list:true})
    return result
}
function removeTagData(event,args){
    if(!args) throw new Error("invalid tag payload")
    const result = removeTag({ tag:args.tag })
    sendNoteUpdate({list:true})
    return result
}
function getTrashList(){
    return { notes:getNoteTrash(), sticky:getStickyTrash() }
}
function trashKind(args){
    if(!args || (args.kind !== "note" && args.kind !== "sticky")) throw new Error("invalid trash payload")
    return args.kind
}
function restoreTrashItem(event,args){
    const kind = trashKind(args)
    const result = kind === "sticky" ? restoreSticky(args.tid) : restoreNote(args.tid)
    sendNoteUpdate({ list:true, sticky:true })
    if(kind === "sticky") sendNoteUpdate({ stickyDeleted:false, tid:args.tid })
    return Object.assign({ kind:kind }, result)
}
function purgeTrashItem(event,args){
    const kind = trashKind(args)
    const result = kind === "sticky" ? purgeSticky(args.tid) : purgeNote(args.tid)
    sendNoteUpdate({ list:true, sticky:true })
    return result
}
function emptyTrashData(){
    const notes = emptyNoteTrash()
    const sticky = emptyStickyTrash()
    sendNoteUpdate({ list:true, sticky:true })
    return { notes:notes.removed, sticky:sticky.removed }
}
function searchData(event,keyword){
    return searchAll(keyword)
}
function noteBacklinksData(event,tid){
    return getNoteBacklinks(tid)
}
async function importNotesData(event,args){
    const mode = args != null && typeof args === "object" ? args.mode : "files"
    let result = null
    if(mode === "folder"){
        const picked = await dialog.showOpenDialog({ title:"选择包含 Markdown 的文件夹", properties:["openDirectory"] })
        if(picked.canceled || picked.filePaths.length === 0) return { canceled:true }
        result = importNotesFromFolder(picked.filePaths[0])
    }else{
        const picked = await dialog.showOpenDialog({
            title:"选择要导入的文件",
            properties:["openFile","multiSelections"],
            filters:[{ name:"Markdown 与文本", extensions:["md","markdown","txt"] }]
        })
        if(picked.canceled || picked.filePaths.length === 0) return { canceled:true }
        result = importNotesFromFiles(picked.filePaths)
    }
    sendNoteUpdate({list:true})
    return Object.assign({ canceled:false }, result)
}
async function exportData(event,args){
    if(!args || typeof args.kind !== "string") throw new Error("invalid export payload")
    const defaultDir = app.getPath("documents")
    if(args.kind === "sticky") return exportSticky(args.tid,dialog,defaultDir)
    return exportNote(args.tid,dialog,defaultDir)
}
async function backupDataHandler(){
    const result = await backupData(dialog)
    return result
}
// 临时 HTML 只用来排版打印，超大内容会把渲染进程拖死，先挡一道
const HTML_EXPORT_LIMIT = 5 * 1024 * 1024
async function renderPdfFromHtml(html){
    if(typeof html !== "string" || html.length > HTML_EXPORT_LIMIT){
        throw new Error("导出内容过大，无法生成 PDF")
    }
    const temp = writeTempHtml(html)
    const win = new BrowserWindow({
        show:false,
        webPreferences:{ javascript:false, sandbox:true, contextIsolation:true }
    })
    try{
        // 打印窗口不跑脚本也不许导航，临时 HTML 里的链接按不出来
        win.webContents.setWindowOpenHandler(()=>({ action:'deny' }))
        win.webContents.on('will-navigate',event=>event.preventDefault())
        await win.loadFile(temp.file)
        return await win.webContents.printToPDF({
            printBackground:true,
            pageSize:"A4",
            margins:{ top:0.4, bottom:0.4, left:0.4, right:0.4 }
        })
    }finally{
        try{ win.destroy() }catch{}
        try{ rmSync(temp.dir,{ recursive:true, force:true }) }catch{}
    }
}
async function exportNoteDocData(event,args){
    if(!args || typeof args.format !== "string") throw new Error("invalid export payload")
    if(typeof args.html === "string" && args.html.length > HTML_EXPORT_LIMIT){
        throw new Error("导出内容过大")
    }
    const defaultDir = app.getPath("documents")
    return exportNoteDoc(args,args.format,dialog,defaultDir,renderPdfFromHtml)
}
function getStickyList(){
    return getStickies()
}
function getStickyData(event,tid){
    return readSticky(tid)
}
function saveStickyData(event,args){
    if(!args) throw new Error("invalid sticky payload")
    return saveSticky(args)
}
function createStickyData(event,title){
    return createSticky(title)
}
function deleteStickyData(event,tid){
    const result = deleteSticky(tid)
    sendNoteUpdate({stickyDeleted:true,tid:tid})
    return result
}
function openDataFolder(event,args){
    const key = args != null && typeof args === "object" ? args.key : args
    if(key !== "notes" && key !== "labels") throw new Error("invalid folder key")
    const dir = path.join(getRootDir(),key)
    if(!existsSync(dir)) mkdirSync(dir,{recursive:true})
    return shell.openPath(dir)
}
function getGraphData(){
    return getGraph()
}
function addGraphNoteNodeData(event,args){
    if(!args) throw new Error("invalid graph node payload")
    const node = addNoteNode({ tid:args.tid, x:args.x, y:args.y })
    sendGraphUpdate()
    return node
}
function addGraphTextNodeData(event,args){
    const node = addTextNode(args)
    sendGraphUpdate()
    return node
}
function updateGraphNodeData(event,args){
    if(!args) throw new Error("invalid graph node payload")
    const node = updateGraphNode({ id:args.id, x:args.x, y:args.y, text:args.text })
    sendGraphUpdate()
    return node
}
function removeGraphNodeData(event,args){
    if(!args) throw new Error("invalid graph node payload")
    const result = removeGraphNode({ id:args.id })
    sendGraphUpdate()
    return result
}
function addGraphEdgeData(event,args){
    if(!args) throw new Error("invalid graph edge payload")
    const result = addEdge({ from:args.from, to:args.to, fromSide:args.fromSide })
    sendGraphUpdate()
    return result
}
function removeGraphEdgeData(event,args){
    if(!args) throw new Error("invalid graph edge payload")
    const result = removeEdge({ id:args.id })
    sendGraphUpdate()
    return result
}
function addGraphGroupData(event,args){
    const group = addGroup(args != null && typeof args === "object" ? args : {})
    sendGraphUpdate()
    return group
}
function updateGraphGroupData(event,args){
    if(!args) throw new Error("invalid graph group payload")
    const group = updateGroup(args)
    sendGraphUpdate()
    return group
}
function removeGraphGroupData(event,args){
    if(!args) throw new Error("invalid graph group payload")
    const result = removeGroup({ id:args.id })
    sendGraphUpdate()
    return result
}
function sendGraphUpdate(){
    windows.forEach(win=>{
        if(!win.isDestroyed() && !win.webContents.isDestroyed()){
            win.webContents.send("graph-updated",{ time:Date.now() })
        }
    })
}
function sendNoteUpdate(note){
    windows.forEach(win=>{
        if(!win.isDestroyed() && !win.webContents.isDestroyed()){
            win.webContents.send("note-updated",note)
        }
    })
}
function sendSettingUpdate(setting){
    windows.forEach(win=>{
        if(!win.isDestroyed() && !win.webContents.isDestroyed()){
            win.webContents.send("setting-updated",setting)
        }
    })
}
function bindIpc(win){
    registerWindow(win)
    if(initialized) return
    initialized = true
    registerSettingIpc()
    registerNoteIpc()
    registerDataIpc()
    registerGraphIpc()
    registerStickyIpc()
    watchNotes(sendNoteUpdate)
    watchSticky(sendNoteUpdate)
    watchGraph(sendGraphUpdate)
}
function registerSettingIpc(){
    ipcMain.handle("get-userinfo",getUserInfo)
    ipcMain.handle("get-setting",getSetting)
    ipcMain.handle("set-setting",setSetting)
    ipcMain.handle("open-data-folder",openDataFolder)
}
function registerNoteIpc(){
    ipcMain.handle("get-notelist",getNoteList)
    ipcMain.handle("get-notecontent",getNoteContent)
    ipcMain.handle("save-content",saveNoteData)
    ipcMain.handle("save-note-image",saveNoteImageData)
    ipcMain.handle("get-note-history",getNoteHistoryData)
    ipcMain.handle("read-note-history",readNoteHistoryData)
    ipcMain.handle("restore-note-history",restoreNoteHistoryData)
    ipcMain.handle("export-note-doc",exportNoteDocData)
    ipcMain.handle("create-note",createNoteData)
    ipcMain.handle("delete-note",deleteNoteData)
    ipcMain.handle("rename-note",renameNoteData)
    ipcMain.handle("rename-tag",renameTagData)
    ipcMain.handle("remove-tag",removeTagData)
    ipcMain.handle("get-tags",getNoteTags)
    ipcMain.handle("set-note-tags",setNoteTagsData)
}
function registerDataIpc(){
    ipcMain.handle("search-content",searchData)
    ipcMain.handle("get-note-backlinks",noteBacklinksData)
    ipcMain.handle("get-trash",getTrashList)
    ipcMain.handle("restore-trash",restoreTrashItem)
    ipcMain.handle("purge-trash",purgeTrashItem)
    ipcMain.handle("empty-trash",emptyTrashData)
    ipcMain.handle("import-notes",importNotesData)
    ipcMain.handle("export-content",exportData)
    ipcMain.handle("backup-data",backupDataHandler)
}
function registerGraphIpc(){
    ipcMain.handle("get-graph",getGraphData)
    ipcMain.handle("add-graph-note-node",addGraphNoteNodeData)
    ipcMain.handle("add-graph-text-node",addGraphTextNodeData)
    ipcMain.handle("update-graph-node",updateGraphNodeData)
    ipcMain.handle("remove-graph-node",removeGraphNodeData)
    ipcMain.handle("add-graph-edge",addGraphEdgeData)
    ipcMain.handle("remove-graph-edge",removeGraphEdgeData)
    ipcMain.handle("add-graph-group",addGraphGroupData)
    ipcMain.handle("update-graph-group",updateGraphGroupData)
    ipcMain.handle("remove-graph-group",removeGraphGroupData)
}
function registerStickyIpc(){
    ipcMain.handle("get-stickylist",getStickyList)
    ipcMain.handle("get-sticky",getStickyData)
    ipcMain.handle("save-sticky",saveStickyData)
    ipcMain.handle("create-sticky",createStickyData)
    ipcMain.handle("delete-sticky",deleteStickyData)
}
function registerWindow(win){
    windows.add(win)
    win.once("closed",()=>windows.delete(win))
}
module.exports = {
    bindIpc:bindIpc,
    registerWindow:registerWindow,
    setSettingValidator:setSettingValidator
}