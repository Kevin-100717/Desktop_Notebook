const { app, Menu, clipboard, nativeImage } = require("electron")
const path = require("path")

const RECENT_LIMIT = 6
const CLIP_TITLE_LIMIT = 18

// 托盘上要用的动作都在这里收着，主进程只管把回调传进来。
// 新增功能只要往 buildTrayMenu 里加一项，菜单自动就跟着长。
function clipTitle(text){
    const flat = String(text == null ? "" : text).replace(/\s+/g," ").trim()
    if(flat === "") return "剪贴板速记"
    return flat.length > CLIP_TITLE_LIMIT ? flat.slice(0,CLIP_TITLE_LIMIT) + "…" : flat
}
function clipBody(text){
    const flat = String(text == null ? "" : text).replace(/\r\n/g,"\n").trim()
    return flat.length > 4000 ? flat.slice(0,4000) : flat
}
function readClipText(){
    try{
        const formats = clipboard.availableFormats()
        if(Array.isArray(formats) && formats.length > 0 && formats.indexOf("text/plain") === -1) return ""
        const image = clipboard.readImage()
        if(image != null && !image.isEmpty()){
            return ""
        }
    }catch{
        return ""
    }
    return clipBody(clipboard.readText())
}
function recentEntries(getNotes,getStickies){
    const notes = []
    const stickies = []
    try{
        const all = getNotes()
        const list = Array.isArray(all && all.notes) ? all.notes : []
        list.forEach(item=>{
            if(item == null || item.time == null) return
            notes.push({ time:item.time, title:item.det && item.det.title ? item.det.title : "没标题" })
        })
    }catch{}
    try{
        const all = getStickies()
        const list = Array.isArray(all && all.sticky) ? all.sticky : []
        list.forEach(item=>{
            if(item == null || item.time == null) return
            stickies.push({ time:item.time, title:item.det && item.det.title ? item.det.title : "便签" })
        })
    }catch{}
    notes.sort((a,b)=>Number(b.time) - Number(a.time))
    stickies.sort((a,b)=>Number(b.time) - Number(a.time))
    return { notes:notes.slice(0,RECENT_LIMIT), stickies:stickies.slice(0,RECENT_LIMIT) }
}

function buildTrayMenu(deps){
    const shortcuts = deps.currentShortcuts()
    // 剪贴板只读一次：里面有图时会去取位图，重复读会拖慢菜单弹出。
    const clipReady = clipBody(deps.clipText()) !== ""
    const items = []
    items.push({ label:"回到主界面", click:deps.showMainWindow })
    items.push({ type:"separator" })
    items.push({
        label:"随手记一条",
        submenu:[
            {
                label:"记成一篇笔记",
                enabled:clipReady,
                click:()=>deps.captureClip('note')
            },
            {
                label:"记成一张便签",
                enabled:clipReady,
                click:()=>deps.captureClip('sticky')
            }
        ]
    })
    const recent = recentEntries(deps.getNotes,deps.getStickies)
    if(recent.notes.length > 0){
        items.push({
            label:"最近写过的笔记",
            submenu:recent.notes.map(entry=>({
                label:entry.title,
                click:()=>deps.openNote(entry.time)
            }))
        })
    }
    if(recent.stickies.length > 0){
        items.push({
            label:"最近用过的便签",
            submenu:recent.stickies.map(entry=>({
                label:entry.title,
                click:()=>deps.openSticky(entry.time)
            }))
        })
    }
    items.push({ type:"separator" })
    items.push({ label:"新写一篇", accelerator:shortcuts.newNote, click:()=>deps.sendAction('new-note') })
    items.push({ label:"新贴一张便签", accelerator:shortcuts.newSticky, click:()=>deps.sendAction('new-sticky') })
    items.push({ type:"separator" })
    items.push({
        label:"退出",
        click:()=>{
            app.isQuitting = true
            app.quit()
        }
    })
    return Menu.buildFromTemplate(items)
}

// 剪贴板速记：文字留在剪贴板里也可以，先读出来存成笔记，再把原文放回去。
function captureFromClipboard(deps,kind){
    const text = clipBody(deps.clipText())
    if(text === "") return { ok:false, reason:"empty" }
    const title = clipTitle(text)
    const body = text
    try{
        if(kind === 'sticky'){
            const created = deps.createSticky(title)
            const tid = created && created.time != null ? created.time : created
            if(tid == null) return { ok:false, reason:"create-failed" }
            deps.saveSticky({ tid:tid, content:body })
            deps.openSticky(tid)
            deps.refresh()
            return { ok:true, kind:"sticky", tid:tid, title:title }
        }
        const created = deps.createNote(title,body)
        const tid = created && created.time != null ? created.time : created
        if(tid == null) return { ok:false, reason:"create-failed" }
        deps.openNote(tid)
        deps.refresh()
        return { ok:true, kind:"note", tid:tid, title:title }
    }catch(error){
        return { ok:false, reason:error && error.message ? error.message : "failed" }
    }
}

function trayIconPath(){
    return path.join(__dirname,"tray.png")
}
function makeTrayIcon(){
    const image = nativeImage.createFromPath(trayIconPath())
    if(image != null && !image.isEmpty()){
        if(typeof image.resize === "function"){
            const small = image.resize({ width:16, height:16 })
            if(small != null && !small.isEmpty()) return small
        }
        return image
    }
    return nativeImage.createEmpty()
}

module.exports = {
    buildTrayMenu:buildTrayMenu,
    captureFromClipboard:captureFromClipboard,
    readClipText:readClipText,
    clipTitle:clipTitle,
    clipBody:clipBody,
    recentEntries:recentEntries,
    makeTrayIcon:makeTrayIcon,
    RECENT_LIMIT:RECENT_LIMIT
}