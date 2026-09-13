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
function createNewNote(){
    var t = new Date().getTime()
    var fp = "./notes/"+ t
    fs.mkdirSync(fp)
    var f = fp+"/note"+t+"-"+Math.round(Math.random()*100000)+".md"
    fs.writeFileSync(f,"# New Note "+new Date().toTimeString())
    updateFileList({
        time:t,
        file:f
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
    return fs.readFileSync(note_list.notes.filter(item=>item.time == t)[0].file, { encoding: 'utf-8' })
}
module.exports = {
    note_init:note_init,
    getNotes:getNotes,
    readNote:readNote
}