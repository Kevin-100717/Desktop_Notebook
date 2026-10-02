const { app, BrowserWindow, Tray, dialog, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const { conf_init, getConfig, isValidAccelerator, DEFAULT_SHORTCUTS } = require("./configInit")
const { bindIpc, setSettingValidator } = require("./ipcHandler")
const { note_init, getNoteContentPath, createNote, watchNotes, getNotes } = require("./noteFile")
const { label_init, watchSticky } = require("./labelFile")
const { graph_init } = require("./graphFile")
const { registerStickyIpc, openStickyWindow } = require("./stickyWindow")
const trayExtra = require("./trayExtra")
const { getStickies, createSticky, saveSticky } = require("./labelFile")
const { registerImageScheme, setupImageProtocol } = require("./imgProtocol")

let mainWindow = null
let tray = null

// 索引文件是整份读改写，两个实例各写各的会互相覆盖，直接把后开的叫回前一个
const hasLock = app.requestSingleInstanceLock()
if(!hasLock){
    app.quit()
}
// 启动没完成前（索引还没读）不能建窗，攒到起来后再叫出来
let bootDone = false
let pendingSecond = false
app.on('second-instance',()=>{
    if(bootDone) showMainWindow()
    else pendingSecond = true
})

registerImageScheme()          // 必须在 app ready 之前声明，否则 <img> 不会按标准协议解析

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        show:false,
        webPreferences: {
            contextIsolation:true,
            nodeIntegration:false,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    mainWindow = win

    bindIpc(win)
    win.setMenuBarVisibility(false)
    if(app.isPackaged){
        win.loadFile(path.join(__dirname,'../dist/index.html'))
    }else{
        win.loadURL('http://localhost:5173')
    }
    // 阻止任何 window.open / target=_blank 弹出空白窗口，链接跳转统一走应用内标签页
    win.webContents.setWindowOpenHandler(()=>({ action:'deny' }))
    // 跳转目标只认本页面，防止页面里的链接把窗口带去外站或本地任意文件
    const entryFile = pathToFileURL(path.join(__dirname,'../dist/index.html')).toString()
    win.webContents.on('will-navigate',(event,url)=>{
        const target = String(url == null ? "" : url)
        const isAppPage = target.startsWith('http://localhost:5173')
            || target === entryFile
            || target.startsWith(entryFile + "#")
        if(!isAppPage) event.preventDefault()
    })
    win.on('ready-to-show',()=>win.show())
    win.on('close',event=>{
        if(app.isQuitting) return
        // 托盘没建起来时藏起来就没人能再叫出窗口了，直接退出
        const canHide = tray != null && !tray.isDestroyed()
        if(canHide && getConfig('closeToTray') !== false){
            event.preventDefault()
            win.hide()
            return
        }
        app.isQuitting = true
        event.preventDefault()
        app.quit()
    })
    win.on('closed',()=>{
        if(mainWindow === win) mainWindow = null
    })
    let retry = 0
    win.webContents.on('did-fail-load',(_event,errorCode)=>{
        if(errorCode === -3) return
        if(!app.isPackaged && retry < 10){
            retry++
            setTimeout(()=>win.loadURL('http://localhost:5173'),300)
        }else{
            win.show()
        }
    })
}

const showMainWindow = () => {
    if(!mainWindow || mainWindow.isDestroyed()){
        createWindow()
        return mainWindow
    }
    if(mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    return mainWindow
}

const sendTrayAction = (action,payload) => {
    const win = showMainWindow()
    if(!win || win.isDestroyed() || win.webContents.isDestroyed()) return
    const message = payload == null ? action : { action:action, tid:payload }
    // 窗口可能还在加载，等页面就绪再投，避免消息被吞；发送前重查引用，防止这 200ms 里窗口被关
    const deliver = ()=>{
        const target = mainWindow
        if(!target || target.isDestroyed() || target.webContents.isDestroyed()) return
        if(target.webContents.isLoading()){
            target.webContents.once('did-finish-load',()=>target.webContents.send('tray-action',message))
            return
        }
        target.webContents.send('tray-action',message)
    }
    setTimeout(deliver,200)
}

const currentShortcuts = () => {
    // 注册成功的那套才是托盘菜单该显示的，配置文件里的值可能还没生效（注册失败会回滚）
    const plan = activeShortcuts
    if(plan){
        const mapped = {}
        plan.forEach(([name,accelerator])=>{ mapped[name] = accelerator })
        return {
            newNote: mapped.newNote || DEFAULT_SHORTCUTS.newNote,
            newSticky: mapped.newSticky || DEFAULT_SHORTCUTS.newSticky
        }
    }
    const saved = getConfig('shortcuts')
    return {
        newNote: saved && saved.newNote ? saved.newNote : DEFAULT_SHORTCUTS.newNote,
        newSticky: saved && saved.newSticky ? saved.newSticky : DEFAULT_SHORTCUTS.newSticky
    }
}

// 托盘依赖都从这里拿，方便单独换掉某一项而不动菜单本身。
const trayDeps = () => {
    return {
        currentShortcuts:currentShortcuts,
        showMainWindow:showMainWindow,
        sendAction:sendTrayAction,
        clipText:trayExtra.readClipText,
        getNotes:getNotes,
        getStickies:getStickies,
        createSticky:createSticky,
        saveSticky:saveSticky,
        createNote:createNote,
        openNote:tid=>sendTrayAction('open-note',tid),
        openSticky:tid=>openStickyWindow(tid),
        captureClip:kind=>captureClip(kind),
        refresh:refreshTrayMenu
    }
}
const buildTrayMenuFull = () => trayExtra.buildTrayMenu(trayDeps())

// 剪贴板速记：先把剪贴板里的文字存成笔记或便签，再把窗口叫出来。
const captureClip = kind => {
    const result = trayExtra.captureFromClipboard(trayDeps(),kind)
    if(result.ok) refreshTrayMenu()
    return result
}

const refreshTrayMenu = () => {
    if(tray == null || tray.isDestroyed()) return
    tray.setContextMenu(buildTrayMenuFull())
}

const SHORTCUT_ACTIONS = {
    newNote:'new-note',
    newSticky:'new-sticky'
}

let activeShortcuts = null

const registerShortcutPlan = plan => {
    const failed = []
    plan.forEach(([name,accelerator])=>{
        let ok = false
        try{
            ok = globalShortcut.register(accelerator,()=>sendTrayAction(SHORTCUT_ACTIONS[name]))
        }catch{
            ok = false
        }
        if(!ok) failed.push(accelerator)
    })
    return failed
}

const applyShortcuts = shortcuts => {
    const source = shortcuts && typeof shortcuts === 'object' ? shortcuts : {}
    const plan = []
    Object.keys(SHORTCUT_ACTIONS).forEach(name=>{
        const accelerator = typeof source[name] === 'string' && source[name].length > 0 ? source[name] : DEFAULT_SHORTCUTS[name]
        if(!isValidAccelerator(accelerator)) throw new Error('快捷键格式无效：' + accelerator)
        plan.push([name,accelerator])
    })
    globalShortcut.unregisterAll()
    const failed = registerShortcutPlan(plan)
    if(failed.length > 0){
        globalShortcut.unregisterAll()
        if(activeShortcuts) registerShortcutPlan(activeShortcuts)
        return '快捷键注册失败，可能被其他程序占用：' + failed.join('、')
    }
    activeShortcuts = plan
    refreshTrayMenu()
    return null
}

const createTray = () => {
    try{
        const image = trayExtra.makeTrayIcon()
        if(image == null || image.isEmpty()){
            console.error('[tray] 图标生成失败，托盘不可用')
            return
        }
        tray = new Tray(image)
        tray.setToolTip('desktop-notebook')
        tray.setContextMenu(buildTrayMenuFull())
        tray.on('click',()=>showMainWindow())
        tray.on('double-click',()=>showMainWindow())
    }catch(error){
        tray = null
        console.error('[tray] 托盘创建失败：' + error.message)
    }
}

const isWritableDir = dir => {
    try{
        fs.mkdirSync(dir,{ recursive:true })
        const probe = path.join(dir,".write-test-" + process.pid)
        fs.writeFileSync(probe,"")
        fs.unlinkSync(probe)
        return true
    }catch{
        return false
    }
}

const resolveDataDir = () => {
    if(!app.isPackaged) return app.getAppPath()
    const exeDir = path.dirname(process.execPath)
    if(isWritableDir(exeDir)) return exeDir
    const fallback = app.getPath("userData")
    console.warn("[data] 安装目录不可写，数据改存到 " + fallback)
    return fallback
}

app.whenReady().then(async () => {
    try{
        const dataDir = resolveDataDir()
        const report = conf_init(dataDir)
        if(report.recovered) console.warn('[config] config.json 解析失败，已备份为 config.json.broken-* 并重置为默认配置')
        if(report.repaired.length > 0) console.log('[config] 已自动补全配置字段：' + report.repaired.join('、'))
        if(report.unknown.length > 0) console.log('[config] 保留未知字段：' + report.unknown.join('、'))
        note_init(dataDir)
        label_init(dataDir)
        graph_init(dataDir)
        setupImageProtocol(tid=>path.dirname(getNoteContentPath(tid)))
        registerStickyIpc(ipcMain)
        setSettingValidator(setting=>{
            if(setting.key !== 'shortcuts') return null
            return applyShortcuts(setting.value)
        })
        // 笔记或便签有变动时，托盘里的「最近」列表跟着更新一次（攒一下再刷，连着写时只刷最后一次）
        let refreshTimer = null
        const refreshIfChanged = ()=>{
            if(refreshTimer) clearTimeout(refreshTimer)
            refreshTimer = setTimeout(()=>{ refreshTimer = null; refreshTrayMenu() },120)
        }
        try{
            watchNotes(()=>refreshIfChanged())
            watchSticky(()=>refreshIfChanged())
        }catch(error){
            console.warn('[tray] 最近列表不会自动刷新：' + error.message)
        }
        createWindow()
        createTray()
        try{
            applyShortcuts(getConfig('shortcuts'))
        }catch(error){
            console.error('快捷键注册失败：' + error.message)
        }
    }catch(error){
        dialog.showErrorBox("启动失败",error.message)
        app.isQuitting = true
        app.quit()
        return
    }
    app.on('activate', () => {
        if (mainWindow == null || mainWindow.isDestroyed()) createWindow()
    })
    bootDone = true
    if(pendingSecond){
        pendingSecond = false
        showMainWindow()
    }
})
app.on('before-quit',()=>{
    app.isQuitting = true
    globalShortcut.unregisterAll()
})
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
