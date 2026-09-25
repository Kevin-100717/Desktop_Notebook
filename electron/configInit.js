const { existsSync,readFileSync,writeFileSync,copyFileSync,renameSync,unlinkSync,mkdirSync } = require("fs")
const path = require("path")

let config = {
    "userKey":"",
    "createTime":0,
}
let configPath = ""

function conf_init(dataDir=process.cwd()){
    const root = path.resolve(dataDir)
    mkdirSync(root,{recursive:true})
    configPath = path.join(root,"config.json")
    const legacyPath = path.resolve(process.cwd(),"config.json")
    if(!existsSync(configPath) && legacyPath !== configPath && existsSync(legacyPath)){
        copyFileSync(legacyPath,configPath)
    }
    if(!existsSync(configPath)){
        config.createTime = new Date().getTime()
        writeConfig(config)
    }
    config = JSON.parse(readFileSync(configPath,"utf-8"))
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
    getConfig:getConfig
}