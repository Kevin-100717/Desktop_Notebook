const fs = require("fs")
var note_list = null
function note_init(){
    if (!fs.existsSync("./notes")){
        fs.mkdirSync("./notes")
        fs.writeFileSync("./notes/list.json","{\"notes\":[]}")
        note_list = readNoteList()
        createNewNote()
    }else{
        note_list = readNoteList()
    }
    
}
function readNoteList(){
    return JSON.parse(fs.readFileSync("./notes/list.json"))
}
function updateFileList(data){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    note_list.notes.push(data)
    writeList()

}
function writeList(){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    fs.writeFileSync("./notes/list.json",JSON.stringify(note_list))
}
function createNewNote(tit="笔记样例"){
    var t = new Date().getTime()
    var fp = "./notes/"+ t
    fs.mkdirSync(fp)
    var f = fp+"/note"+t+"-"+Math.round(Math.random()*100000)
    fs.writeFileSync(f+".md","# New Note "+new Date().toLocaleString())
    const det = {
        title:tit,
        createAt:new Date().toLocaleString()
    }
    fs.writeFileSync(f+".json",JSON.stringify(det))
    updateFileList({
        time:t,
        file:f,
        det:det
    })
}
function getNotes(){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    return note_list
}
function readNote(t){
    if(note_list == null){
        throw new Error("list is not inited")
    }
    return fs.readFileSync(
        note_list.notes.filter(item=>item.time == t)[0].file+".md", 
        { encoding: 'utf-8' }
    )
}
module.exports = {
    note_init:note_init,
    getNotes:getNotes,
    readNote:readNote
}