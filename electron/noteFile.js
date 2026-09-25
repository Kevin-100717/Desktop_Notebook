const fs = require("fs")
var note_list = null
const first_new_template = `
# 我的开源项目

一个简洁高效的 **Web 组件库**，帮助开发者快速构建现代化界面。

## 功能特性

- 🎨 丰富的主题定制
- 📦 支持 tree-shaking
- ✅ 完整的 TypeScript 类型定义
- 🧪 测试覆盖率 > 95%

## 快速开始

\`\`bash npm install my-components \`\`

\`\`\`JavaScript
import { Button } from \'my-components\';
const app = () => {
  return <Button type=\"primary\">点击我</Button>;
};
\`\`\`

## API 参考

| 属性     | 类型    |  默认值  | 说明     |
| :------- | :------ | :-------: | :------- |
| type     | string  | 'default' | 按钮类型 |
| size     | string  | 'medium' | 按钮尺寸 |
| disabled | boolean |   false   | 是否禁用 |

> **注意：** 本组件库需要 React >= 18.0。

## 开发计划

- [X] 基础组件开发
- [X] 文档站点搭建
- [ ] 国际化支持
- [ ] 暗色主题

## 贡献

欢迎提交 PR！请先阅读 [贡献指南](https://github.com/example/contributing)。

---

© 2024 我的开源项目

`
function note_init(){
    if (!fs.existsSync("./notes")){
        fs.mkdirSync("./notes")
        fs.writeFileSync("./notes/list.json","{\"notes\":[]}")
        note_list = readNoteList()
        createNewNote(true)
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
function createNewNote(first=false,tit="笔记样例"){
    var t = new Date().getTime()
    var fp = "./notes/"+ t
    fs.mkdirSync(fp)
    var f = fp+"/note"+t+"-"+Math.round(Math.random()*100000)
    fs.writeFileSync(f+".md",first?
        first_new_template:
        "# New Note "+new Date().toLocaleString()
    )
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