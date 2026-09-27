const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
const { conf_init, getConfig, isValidAccelerator, describeAccelerator, DEFAULT_SHORTCUTS } = require("./configInit")
const { bindIpc, setSettingValidator } = require("./ipcHandler")
const { note_init } = require("./noteFile")
const { label_init } = require("./labelFile")
const { graph_init } = require("./graphFile")
const { registerStickyIpc } = require("./stickyWindow")

let mainWindow = null
let tray = null

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
    win.on('ready-to-show',()=>win.show())
    win.on('close',event=>{
        if(app.isQuitting) return
        if(getConfig('closeToTray') !== false){
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
        return
    }
    if(mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
}

const sendTrayAction = action => {
    showMainWindow()
    if(!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    setTimeout(()=>{
        if(!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()){
            mainWindow.webContents.send('tray-action',action)
        }
    },200)
}

const currentShortcuts = () => {
    const saved = getConfig('shortcuts')
    return {
        newNote: saved && saved.newNote ? saved.newNote : DEFAULT_SHORTCUTS.newNote,
        newSticky: saved && saved.newSticky ? saved.newSticky : DEFAULT_SHORTCUTS.newSticky
    }
}

const buildTrayMenu = () => {
    const shortcuts = currentShortcuts()
    return Menu.buildFromTemplate([
    { label:'显示主窗口', click:showMainWindow },
    { type:'separator' },
    { label:'新建笔记\t' + describeAccelerator(shortcuts.newNote), click:()=>sendTrayAction('new-note') },
    { label:'新建便签\t' + describeAccelerator(shortcuts.newSticky), click:()=>sendTrayAction('new-sticky') },
    { type:'separator' },
    {
        label:'退出',
        click:()=>{
            app.isQuitting = true
            app.quit()
        }
    }
    ])
}

const refreshTrayMenu = () => {
    if(tray == null || tray.isDestroyed()) return
    tray.setContextMenu(buildTrayMenu())
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
    const image = nativeImage.createFromPath(path.join(__dirname,'tray.png'))
    if(image.isEmpty()) return
    tray = new Tray(image)
    tray.setToolTip('desktop-notebook')
    tray.setContextMenu(buildTrayMenu())
    tray.on('click',()=>showMainWindow())
    tray.on('double-click',()=>showMainWindow())
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
        registerStickyIpc(ipcMain)
        setSettingValidator(setting=>{
            if(setting.key !== 'shortcuts') return null
            return applyShortcuts(setting.value)
        })
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
})
app.on('before-quit',()=>{
    app.isQuitting = true
    globalShortcut.unregisterAll()
})
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
