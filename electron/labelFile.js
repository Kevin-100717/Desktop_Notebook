const fs = require("fs")
const path = require("path")
let label_list = null
let dataDir = ""
let labelsDir = ""
let listPath = ""
let trashDir = ""
const watchCallbacks = new Set()   // 托盘与 IPC 各注册一份，单槽会被后注册的覆盖掉
let listWatched = false
let listTimer = null

const LOCK_CODES = new Set(["EPERM","EBUSY","EACCES"])
function retryRename(from,to){
    // Windows 上刚被读取/显示的文件 renameSync 会瞬时 EPERM/EBUSY，稍等重试
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
    const tempPath = file+".tmp-"+process.pid+"-"+Date.now()
    try{
        fs.writeFileSync(tempPath,content,"utf-8")
        retryRename(tempPath,file)
    }catch(error){
        try{fs.unlinkSync(tempPath)}catch{}
        throw error
    }
}
function label_init(root=process.cwd()){
    dataDir = path.resolve(root)
    labelsDir = path.join(dataDir,"labels")
    if(!fs.existsSync(labelsDir)){
        fs.mkdirSync(labelsDir,{recursive:true})
    }
    listPath = path.join(labelsDir,"list.json")
    trashDir = path.join(labelsDir,".trash")
    if(!fs.existsSync(listPath)){
        // 索引不见了但便签文件还在时绝不能播种空列表：下一次保存会把条目全冲掉
        if(labelsDirHasData()) throw new Error("labels/list.json 不见了，但 labels/ 里还有便签文件；先别启动，把索引找回来再用")
        fs.writeFileSync(listPath,"{\"sticky\":[],\"trash\":[]}")
    }
    label_list = readLabelList()
}
// labels/ 里除索引自己以外还有东西，就说明索引本该存在
function labelsDirHasData(){
    try{
        return fs.readdirSync(labelsDir).some(name=>name !== ".trash" && name !== "list.json" && !name.startsWith("list.json."))
    }catch{
        return false
    }
}
function readLabelList(){
    if(!fs.existsSync(labelsDir)){
        fs.mkdirSync(labelsDir,{recursive:true})
    }
    // 读的时候不建索引文件：只是暂时没读到就写一份空的，下一次保存会把所有便签条目冲掉
    let raw = null
    try{
        raw = fs.readFileSync(listPath,"utf-8")
    }catch(error){
        // 只有「文件不存在且没有别的便签」才算空列表；读失败或索引丢了都要报出去，
        // 当成空的下一次保存就把整份索引冲掉了
        if(!error || error.code !== "ENOENT") throw error
        if(labelsDirHasData()) throw new Error("labels/list.json 不见了，但 labels/ 里还有便签文件；把索引找回来再用")
    }
    let data = null
    try{
        data = raw != null ? JSON.parse(raw) : null
    }catch(error){
        // 可能是外部程序正在写，读到半截字节：再读一次，字节变了就抛出去让调用方重试，
        // 不能当成损坏重建空列表（那会把真实索引顶掉）
        let again = null
        try{
            again = fs.readFileSync(listPath,"utf-8")
        }catch{}
        if(again !== raw) throw new Error("labels/list.json 正在被写入，稍后再试")
        data = null
    }
    if(data == null || typeof data !== "object" || !Array.isArray(data.sticky)){
        try{
            if(fs.existsSync(listPath)){
                const dir = path.dirname(listPath), base = path.basename(listPath)
                // 一直读不出来时只备一次，别每次读都复制一份堆满目录
                if(!fs.readdirSync(dir).some(name=>name.startsWith(base+".broken-"))){
                    const backup = listPath + ".broken-" + Date.now()
                    fs.copyFileSync(listPath,backup)
                    console.warn("[labelFile] labels/list.json 解析失败，已备份为 " + path.basename(backup) + " 并重建空列表")
                }
            }
        }catch(error){}
        data = { sticky:[], trash:[] }
    }
    data.sticky = data.sticky.filter(item=>item && item.time != null && typeof item.file === "string" && item.file.length > 0)
    if(!Array.isArray(data.trash)) data.trash = []
    data.trash = data.trash.filter(item=>item && item.time != null && typeof item.file === "string" && item.file.length > 0)
    data.sticky.forEach(item=>{ item.det = normalizeDet(item.det) })
    data.trash.forEach(item=>{
        item.det = normalizeDet(item.det)
        if(!Number.isFinite(item.deletedAt)) item.deletedAt = 0
    })
    return data
}
function normalizeDet(det){
    const base = det != null && typeof det === "object" ? det : {}
    if(typeof base.title !== "string" || base.title.length === 0) base.title = "未命名便签"
    if(typeof base.createAt !== "string") base.createAt = ""
    return base
}
function writeList(){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    writeAtomic(listPath,JSON.stringify(label_list))
}
function getStickyEntry(t){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    const entry = label_list.sticky.find(item=>String(item.time) === String(t))
    if(!entry) throw new Error("sticky is not found")
    return entry
}
function getStickyFile(entry){
    if(!entry || typeof entry.file !== "string" || entry.file.length === 0){
        throw new Error("invalid sticky path")
    }
    let candidate = entry.file
    if(path.isAbsolute(candidate)){
        candidate = path.join(labelsDir,path.basename(candidate))   // 老版本存的绝对路径
    }else{
        candidate = path.resolve(dataDir,candidate)
    }
    const file = path.resolve(candidate)
    const relative = path.relative(labelsDir,file)
    if(relative.startsWith("..") || path.isAbsolute(relative)){
        throw new Error("invalid sticky path")
    }
    return file
}
function normalizeTitle(title){
    if(typeof title !== "string") throw new Error("invalid sticky title")
    const value = title.trim()
    if(!value) throw new Error("empty sticky title")
    if(value.length > 60) throw new Error("sticky title is too long")
    return value
}
function randomSuffix(){
    return Math.random().toString(36).slice(2,8)
}
// time 会拼进回收站目录名，索引被改坏时 ".." 能把删除操作带出数据目录
function timeKey(t){
    const key = String(t)
    if(!/^[0-9A-Za-z_-]+$/.test(key)) throw new Error("invalid sticky id")
    return key
}
function createSticky(title){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    const value = normalizeTitle(title)
    label_list = readLabelList()
    // 同一毫秒建两张会撞同一个 time，存的时候会互相覆盖
    const taken = time=>label_list.sticky.some(item=>String(item.time)===String(time))
        || label_list.trash.some(item=>String(item.time)===String(time))
    let t = new Date().getTime()
    while(taken(t)) t++
    const file = path.join(labelsDir,String(t)+"-"+randomSuffix()+".txt")
    writeAtomic(file,"")
    const det = {
        title:value,
        createAt:new Date().toLocaleString()
    }
    const entry = {
        time:t,
        file:path.relative(dataDir,file),
        det:det
    }
    label_list.sticky.push(entry)
    writeList()
    return entry
}
function getStickies(){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    return { sticky:label_list.sticky }
}
function getStickyContentPath(t){
    return getStickyFile(getStickyEntry(t))
}
function getStickyContentPathByEntry(entry){
    return getStickyFile(entry)
}
function readSticky(t){
    const entry = getStickyEntry(t)
    let content = ""
    try{
        content = fs.readFileSync(getStickyFile(entry),{ encoding:'utf-8' })
    }catch(error){
        // 文件被删掉才算空的；读失败不能假装没内容，免得又存一次把原文冲掉
        if(!error || error.code !== "ENOENT") throw error
    }
    return { time:entry.time, title:entry.det?.title || "便签", content:content }
}
function saveSticky(data){
    if(!data || typeof data.content !== "string") throw new Error("invalid sticky content")
    if(data.content.length > 200000) throw new Error("sticky content is too long")
    const entry = getStickyEntry(data.tid)
    writeAtomic(getStickyFile(entry),data.content)
    return "success"
}
function moveFile(from,to){
    try{
        retryRename(from,to)
    }catch(error){
        if(error && error.code === "EXDEV"){
            fs.copyFileSync(from,to)
            fs.unlinkSync(from)
            return
        }
        throw error
    }
}
function deleteSticky(t){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    const index = label_list.sticky.findIndex(item=>String(item.time) === String(t))
    if(index === -1) throw new Error("sticky is not found")
    const entry = label_list.sticky[index]
    const file = getStickyFile(entry)
    if(!fs.existsSync(file)) throw new Error("sticky files are missing")
    const targetDir = path.join(trashDir,timeKey(entry.time))
    fs.mkdirSync(targetDir,{recursive:true})
    moveFile(file,path.join(targetDir,path.basename(file)))
    label_list.sticky.splice(index,1)
    label_list.trash.push({
        time:entry.time,
        file:path.relative(dataDir,path.join(targetDir,path.basename(file))),
        det:entry.det,
        deletedAt:Date.now()
    })
    try{
        writeList()
    }catch(error){
        // 索引没写成要搬回去，不然文件躺在回收站、索引还当它在用
        try{
            moveFile(path.join(targetDir,path.basename(file)),file)
            label_list.trash.pop()
            label_list.sticky.splice(index,0,entry)
        }catch{}
        throw error
    }
    return "success"
}
function getTrash(){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    label_list.trash = label_list.trash.filter(item=>{
        try{
            return fs.existsSync(getStickyFile(item))
        }catch{
            return false
        }
    })
    return label_list.trash.slice().sort((a,b)=>b.deletedAt-a.deletedAt)
}
function getTrashEntry(t){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    const entry = label_list.trash.find(item=>String(item.time) === String(t))
    if(!entry) throw new Error("trash item is not found")
    return entry
}
function restoreSticky(t){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    const index = label_list.trash.findIndex(item=>String(item.time) === String(t))
    if(index === -1) throw new Error("trash item is not found")
    const entry = label_list.trash[index]
    const file = getStickyFile(entry)
    if(!fs.existsSync(file)) throw new Error("trash item files are missing")
    let fileName = path.basename(file)
    if(fs.existsSync(path.join(labelsDir,fileName))) fileName = timeKey(entry.time)+"-"+randomSuffix()+".txt"
    const finalTarget = path.join(labelsDir,fileName)
    moveFile(file,finalTarget)
    label_list.sticky.push({
        time:entry.time,
        file:path.relative(dataDir,finalTarget),
        det:entry.det
    })
    label_list.trash.splice(index,1)
    try{
        writeList()
    }catch(error){
        // 索引没写成要搬回回收站，不然文件在 labels/ 里、索引还当它在回收站
        try{
            moveFile(finalTarget,file)
            label_list.sticky.pop()
            label_list.trash.splice(index,0,entry)
        }catch{}
        throw error
    }
    return { time:entry.time, title:entry.det && entry.det.title }
}
function purgeSticky(t){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    const index = label_list.trash.findIndex(item=>String(item.time) === String(t))
    if(index === -1) throw new Error("trash item is not found")
    const entry = label_list.trash[index]
    let file = ""
    try{
        const found = getStickyFile(entry)
        // 只删这条回收站条目自己的目录（.trash/<时间>/）：路径异常时宁可不删
        const dir = path.dirname(found)
        const rel = path.relative(labelsDir,dir)
        if(rel.split(path.sep).length >= 2 && !rel.startsWith("..") && !path.isAbsolute(rel)) file = found
    }catch{}
    label_list.trash.splice(index,1)
    writeList()
    if(file){
        try{fs.rmSync(path.dirname(file),{recursive:true,force:true})}catch{}
    }
    try{
        if(fs.existsSync(trashDir) && fs.readdirSync(trashDir).length === 0) fs.rmdirSync(trashDir)
    }catch{}
    return "success"
}
function emptyTrash(){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    label_list = readLabelList()
    const count = label_list.trash.length
    label_list.trash = []
    writeList()
    try{fs.rmSync(trashDir,{recursive:true,force:true})}catch{}
    return { removed:count }
}
function watchSticky(callback){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    watchCallbacks.add(callback)
    if(listWatched) return
    fs.watchFile(listPath,{persistent:true,interval:200},()=>{
        clearTimeout(listTimer)
        listTimer = setTimeout(()=>{
            try{
                label_list = readLabelList()
                watchCallbacks.forEach(notify=>{
                    try{ notify({sticky:true}) }catch{}
                })
            }catch{}
        },100)
    })
    listWatched = true
}
module.exports = {
    label_init:label_init,
    getStickies:getStickies,
    readSticky:readSticky,
    getStickyContentPath:getStickyContentPath,
    getStickyContentPathByEntry:getStickyContentPathByEntry,
    saveSticky:saveSticky,
    createSticky:createSticky,
    deleteSticky:deleteSticky,
    getTrash:getTrash,
    restoreSticky:restoreSticky,
    purgeSticky:purgeSticky,
    emptyTrash:emptyTrash,
    watchSticky:watchSticky
}
