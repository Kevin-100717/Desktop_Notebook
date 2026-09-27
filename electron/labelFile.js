const fs = require("fs")
const path = require("path")
let label_list = null
let dataDir = ""
let labelsDir = ""
let listPath = ""
let trashDir = ""
let watchCallback = null
let listWatched = false
let listTimer = null

function writeAtomic(file,content){
    const tempPath = file+".tmp-"+process.pid+"-"+Date.now()
    try{
        fs.writeFileSync(tempPath,content,"utf-8")
        fs.renameSync(tempPath,file)
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
        fs.writeFileSync(listPath,"{\"sticky\":[],\"trash\":[]}")
    }
    label_list = readLabelList()
}
function readLabelList(){
    if(!fs.existsSync(labelsDir)){
        fs.mkdirSync(labelsDir,{recursive:true})
    }
    if(!fs.existsSync(listPath)){
        fs.writeFileSync(listPath,"{\"sticky\":[],\"trash\":[]}")
    }
    let data = null
    try{
        data = JSON.parse(fs.readFileSync(listPath,"utf-8"))
    }catch(error){
        data = null
    }
    if(data == null || typeof data !== "object" || !Array.isArray(data.sticky)){
        try{
            if(fs.existsSync(listPath)){
                const backup = listPath + ".broken-" + Date.now()
                fs.copyFileSync(listPath,backup)
                console.warn("[labelFile] labels/list.json 解析失败，已备份为 " + path.basename(backup) + " 并重建空列表")
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
function createSticky(title){
    if(label_list == null){
        throw new Error("sticky list is not init")
    }
    const value = normalizeTitle(title)
    label_list = readLabelList()
    const t = new Date().getTime()
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
    }catch{
        content = ""
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
        fs.renameSync(from,to)
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
    const targetDir = path.join(trashDir,String(entry.time))
    fs.mkdirSync(targetDir,{recursive:true})
    moveFile(file,path.join(targetDir,path.basename(file)))
    label_list.sticky.splice(index,1)
    label_list.trash.push({
        time:entry.time,
        file:path.relative(dataDir,path.join(targetDir,path.basename(file))),
        det:entry.det,
        deletedAt:Date.now()
    })
    writeList()
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
    let fileName = path.basename(file)
    if(fs.existsSync(path.join(labelsDir,fileName))) fileName = String(entry.time)+"-"+randomSuffix()+".txt"
    const finalTarget = path.join(labelsDir,fileName)
    moveFile(file,finalTarget)
    label_list.sticky.push({
        time:entry.time,
        file:path.relative(dataDir,finalTarget),
        det:entry.det
    })
    label_list.trash.splice(index,1)
    writeList()
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
        file = getStickyFile(entry)
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
    watchCallback = callback
    if(listWatched) return
    fs.watchFile(listPath,{persistent:true,interval:200},()=>{
        clearTimeout(listTimer)
        listTimer = setTimeout(()=>{
            try{
                label_list = readLabelList()
                watchCallback({sticky:true})
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
