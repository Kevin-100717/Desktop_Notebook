const { existsSync,readFileSync,writeFileSync,copyFileSync,renameSync,unlinkSync,mkdirSync } = require("fs")
const path = require("path")

const DEFAULT_SHORTCUTS = {
    "newNote":"CommandOrControl+Shift+N",
    "newSticky":"CommandOrControl+Shift+S"
}
const MODIFIERS = ["CommandOrControl","CmdOrCtrl","Command","Ctrl","Control","Alt","Option","AltGr","Shift","Super","Meta"]
const MODIFIER_ALIAS = {
    "commandorcontrol":"ctrl","cmdorctrl":"ctrl","command":"cmd","ctrl":"ctrl","control":"ctrl",
    "alt":"alt","option":"alt","altgr":"altgr","shift":"shift","super":"win","meta":"win"
}

function isValidAccelerator(value){
    if(typeof value !== "string") return false
    const parts = value.split("+").map(part=>part.trim()).filter(Boolean)
    if(parts.length < 2) return false
    const key = parts[parts.length-1]
    if(MODIFIERS.some(mod=>mod.toLowerCase() === key.toLowerCase())) return false
    if(!/^(F\d{1,2}|[A-Z0-9]|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|Plus|VolumeUp|VolumeDown|VolumeMute|MediaNextTrack|MediaPreviousTrack|MediaStop|MediaPlayPause|PrintScreen)$/i.test(key)) return false
    return parts.slice(0,-1).every(part=>MODIFIERS.some(mod=>mod.toLowerCase() === part.toLowerCase()))
}
function normalizeShortcuts(value){
    const result = Object.assign({},DEFAULT_SHORTCUTS)
    if(value && typeof value === "object"){
        ;["newNote","newSticky"].forEach(key=>{
            if(isValidAccelerator(value[key])) result[key] = value[key]
        })
    }
    return result
}
function describeAccelerator(accelerator){
    if(!isValidAccelerator(accelerator)) return ""
    return accelerator.split("+").map(part=>{
        const lower = part.toLowerCase()
        if(MODIFIER_ALIAS[lower]) return MODIFIER_ALIAS[lower]
        if(/^F\d{1,2}$/i.test(part)) return part.toUpperCase()
        if(part.length === 1) return part.toUpperCase()
        return part
    }).join("+")
}

let config = {}
let configPath = ""
let rootDir = ""
let initReport = { created:false, recovered:false, repaired:[], unknown:[] }

const CONFIG_VERSION = 1
const CONFIG_SCHEMA = [
    { key:"configVersion", normalize:value=>{
        const num = typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
        return num > CONFIG_VERSION ? num : CONFIG_VERSION
    } },
    { key:"userKey", normalize:value=>typeof value === "string" ? value : "" },
    { key:"createTime", normalize:value=>Number.isFinite(value) && value > 0 ? value : Date.now() },
    { key:"theme", normalize:value=>value === "light" || value === "dark" ? value : "dark" },
    { key:"accentColor", normalize:value=>normalizeAccent(value) },
    { key:"customCss", normalize:value=>normalizeCustomCss(value) },
    { key:"customColors", normalize:value=>normalizeCustomColors(value) },
    { key:"closeToTray", normalize:value=>typeof value === "boolean" ? value : true },
    { key:"shortcuts", normalize:value=>normalizeShortcuts(value) },
    { key:"tagColors", normalize:value=>normalizeTagColors(value) },
    { key:"pinnedTags", normalize:value=>normalizePinnedTags(value) }
]
const SCHEMA_KEYS = CONFIG_SCHEMA.map(field=>field.key)
const COLOR_POOL = ["#e5484d","#f76808","#ffb224","#46a758","#12a594","#0090ff","#8e4ec6","#e93d82"]
const CUSTOM_CSS_LIMIT = 20000

// 主题色只收 3 位或 6 位十六进制，写错了就退回默认色。
function normalizeAccent(value){
    if(typeof value !== "string") return ""
    const hex = value.trim()
    if(!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return ""
    return hex.toLowerCase()
}
// 自己写的样式只做纯文本限制和长度限制，不解析语法，出错也不至于影响别的设置。
function normalizeCustomCss(value){
    if(typeof value !== "string") return ""
    let text = value
    // 去掉 <style> 包裹，省得有人直接把整段标签贴进来
    text = text.replace(/<\/?style[^>]*>/gi,"")
    if(text.length > CUSTOM_CSS_LIMIT) text = text.slice(0,CUSTOM_CSS_LIMIT)
    return text.replace(/\r\n/g,"\n")
}

// 配色只认这几个部位，用户挑颜色就行，不用自己写代码。
const COLOR_PARTS = ["page","panel","card","text","textSoft","line","accent","danger","sticky"]
function normalizeCustomColors(value){
    const result = {}
    if(!value || typeof value !== "object" || Array.isArray(value)) return result
    COLOR_PARTS.forEach(part=>{
        const color = value[part]
        if(typeof color !== "string") return
        const hex = color.trim()
        if(!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return
        result[part] = hex.toLowerCase()
    })
    return result
}
function normalizeTagColors(value){
    const result = {}
    if(!value || typeof value !== "object" || Array.isArray(value)) return result
    Object.keys(value).forEach(tag=>{
        const color = value[tag]
        const name = typeof tag === "string" ? tag.trim() : ""
        if(!name || name.length > 24) return
        if(typeof color !== "string") return
        const hex = color.trim()
        if(!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return
        result[name] = hex.toLowerCase()
    })
    return result
}
function normalizePinnedTags(value){
    if(!Array.isArray(value)) return []
    const result = []
    const seen = new Set()
    value.forEach(item=>{
        if(typeof item !== "string") return
        const tag = item.trim()
        if(!tag || tag.length > 24) return
        const key = tag.toLowerCase()
        if(seen.has(key)) return
        seen.add(key)
        result.push(tag)
    })
    return result
}

function isSameValue(a,b){
    if(a === b) return true
    if(a == null || b == null) return false
    if(typeof a === "object" && typeof b === "object") return JSON.stringify(a) === JSON.stringify(b)
    return false
}
function normalizeConfig(source){
    const base = source && typeof source === "object" && !Array.isArray(source) ? source : {}
    const result = Object.assign({},base)
    const repaired = []
    CONFIG_SCHEMA.forEach(field=>{
        const next = field.normalize(base[field.key])
        if(isSameValue(base[field.key],next)) return
        result[field.key] = next
        repaired.push(base[field.key] === undefined ? field.key + "（缺失）" : field.key + "（非法值）")
    })
    return { config:result, repaired:repaired }
}
function createDefaultConfig(){
    return normalizeConfig({ createTime:Date.now() }).config
}
function parseConfig(raw){
    try{
        const parsed = JSON.parse(raw)
        if(parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed
    }catch{}
    return null
}

function conf_init(dataDir=process.cwd()){
    const root = path.resolve(dataDir)
    rootDir = root
    mkdirSync(root,{recursive:true})
    configPath = path.join(root,"config.json")
    const legacyPath = path.resolve(process.cwd(),"config.json")
    if(!existsSync(configPath) && legacyPath !== configPath && existsSync(legacyPath)){
        copyFileSync(legacyPath,configPath)
    }
    if(!existsSync(configPath)){
        config = createDefaultConfig()
        writeConfig(config)
        initReport = { created:true, recovered:false, repaired:[], unknown:[] }
        return initReport
    }
    const parsed = parseConfig(readFileSync(configPath,"utf-8"))
    if(parsed == null){
        try{
            copyFileSync(configPath,configPath+".broken-"+Date.now())
        }catch{}
        config = createDefaultConfig()
        writeConfig(config)
        initReport = { created:false, recovered:true, repaired:[], unknown:[] }
        return initReport
    }
    const normalized = normalizeConfig(parsed)
    config = normalized.config
    if(normalized.repaired.length > 0) writeConfig(config)
    initReport = {
        created:false,
        recovered:false,
        repaired:normalized.repaired,
        unknown:Object.keys(parsed).filter(key=>!SCHEMA_KEYS.includes(key))
    }
    return initReport
}
function setSetting(setting){
    if(!setting || typeof setting.key !== "string") throw new Error("invalid setting")
    const { key,value } = setting
    if(key === "shortcuts"){
        if(!value || typeof value !== "object") throw new Error("快捷键格式无效")
        const shortcuts = {}
        ;["newNote","newSticky"].forEach(name=>{
            if(!isValidAccelerator(value[name])) throw new Error("快捷键格式无效：" + String(value[name]))
            shortcuts[name] = value[name]
        })
        setConfig("shortcuts",shortcuts)
        return
    }
    if(key === "customColors") setConfig("customColors",normalizeCustomColors(value))
    else if(key === "tagColors") setConfig("tagColors",normalizeTagColors(value))
    else if(key === "pinnedTags") setConfig("pinnedTags",normalizePinnedTags(value))
    else{
        // 其余设置也走 schema 校验归一化，非法值（比如主题写成 "blue"）退回默认而不是原样落盘
        const field = CONFIG_SCHEMA.find(item=>item.key === key)
        if(field == null) throw new Error("invalid setting")
        setConfig(key,field.normalize(value))
    }
}
function setConfig(key,value){
    if(config == null){
        throw new Error("config not init")
    }
    config[key] = value
    writeConfig(config)
}
function getConfig(key){
    if(config == null){
        throw new Error("config not init")
    }
    return config[key]
}
function getRootDir(){
    if(!rootDir){
        throw new Error("config not init")
    }
    return rootDir
}
function writeConfig(conf){
    const tempPath = configPath+".tmp-"+process.pid+"-"+Date.now()
    try{
        writeFileSync(tempPath,JSON.stringify(conf),"utf-8")
        renameSync(tempPath,configPath)
    }catch(error){
        try{unlinkSync(tempPath)}catch{}
        throw error
    }
}

module.exports = {
    conf_init:conf_init,
    setConfig:setConfig,
    setSetting:setSetting,
    getConfig:getConfig,
    getConfigAll:()=>Object.assign({},config),
    getRootDir:getRootDir,
    getInitReport:()=>Object.assign({},initReport),
    hasSettingKey:key=>SCHEMA_KEYS.includes(key),
    isValidAccelerator:isValidAccelerator,
    describeAccelerator:describeAccelerator,
    normalizeTagColors:normalizeTagColors,
    normalizePinnedTags:normalizePinnedTags,
    normalizeCustomColors:normalizeCustomColors,
    COLOR_PARTS:COLOR_PARTS,
    COLOR_POOL:COLOR_POOL,
    DEFAULT_SHORTCUTS:DEFAULT_SHORTCUTS,
    CONFIG_VERSION:CONFIG_VERSION
}