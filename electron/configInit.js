const { existsSync,readFileSync,writeFileSync } = require("fs")

var config = {
    "userKey":"",
    "createTime":0,
}
function conf_init(){
    if(!existsSync("./config.json")){
        config.createTime = new Date().getTime()
        writeConfig(config)
    }
    config = JSON.parse(readFileSync("./config.json"))
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
    writeFileSync("./config.json",JSON.stringify(conf))
}

module.exports = {
    conf_init:conf_init,
    setConfig:setConfig,
    getConfig:getConfig
}