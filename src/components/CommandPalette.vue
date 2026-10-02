<template>
    <div v-if="visible" class="cmd-mask" @mousedown="close">
        <div class="cmd-panel" @mousedown.stop>
            <div class="cmd-input">
                <span class="cmd-caret">⌘</span>
                <input
                    ref="input"
                    v-model="query"
                    placeholder="想做点什么"
                    @keydown.down.prevent="move(1)"
                    @keydown.up.prevent="move(-1)"
                    @keydown.enter.prevent="runActive"
                    @keydown.esc.prevent="close"
                >
                <span class="cmd-count">{{ filtered.length }}</span>
            </div>
            <div class="cmd-group" v-for="group in groups" :key="group.name">
                <p v-if="group.commands.length > 0" class="cmd-group-name">{{ group.name }}</p>
                <button
                    v-for="(command,index) in group.commands"
                    :key="command.id"
                    class="cmd-item"
                    :class="{ active: index + group.offset === activeIndex }"
                    @mouseenter="activeIndex = index + group.offset"
                    @click="run(command)"
                >
                    <span class="cmd-name">{{ command.label }}</span>
                    <span v-if="command.hint" class="cmd-hint">{{ command.hint }}</span>
                </button>
            </div>
            <div v-if="filtered.length === 0" class="cmd-empty">没有「{{ query.trim() }}」这个命令</div>
            <div class="cmd-foot">↑↓ 选一选 · Enter 执行 · Esc 关上 · Ctrl + Shift + P</div>
        </div>
    </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import emitter from '../utils/emitter.js';
import uiState from '../utils/uiState.js';

const GROUPS = ['常用','换个样子','数据与备份']
const GROUP_ORDER = { '常用':0, '换个样子':1, '数据与备份':2 }

export default {
    data(){
        return {
            visible:false,
            query:"",
            activeIndex:0,
            commands:[
                { id:"new-note",  group:"常用", label:"写一篇新笔记", keywords:"创建 新建 笔记 note", run:()=>this.createNote() },
                { id:"new-sticky",group:"常用", label:"写一张新便签", keywords:"创建 新建 便签 sticky", run:()=>this.createSticky() },
                { id:"quick-open",group:"常用", label:"秒开一篇笔记", hint:"Ctrl + P", keywords:"open 搜索 查找 快速", run:()=>{ emitter.emit("open-quick-open") } },
                { id:"toggle-theme", group:"换个样子", label:"换个深浅底色", hint:"深色 / 浅色", keywords:"dark light theme 主题 黑 白 夜间 日间", run:()=>this.toggleTheme() },
                { id:"toggle-focus", group:"换个样子", label:"进入专注写作", hint:"只留正文", keywords:"focus 专注 沉浸 阅读", run:()=>{ uiState.focus = !uiState.focus } },
                { id:"go-list",  group:"换个样子", label:"回到笔记列表", keywords:"notes all 所有 笔记", run:()=>this.$router.push("/") },
                { id:"go-trash", group:"换个样子", label:"打开回收站", keywords:"trash 删除 还原", run:()=>this.$router.push("/trash") },
                { id:"go-graph", group:"换个样子", label:"打开知识网", keywords:"graph 图谱 节点 关系", run:()=>this.$router.push("/graph") },
                { id:"go-settings", group:"换个样子", label:"打开设置", keywords:"settings 配置 偏好", run:()=>this.$router.push("/settings") },
                { id:"import-files", group:"数据与备份", label:"把文件导入进来", keywords:"import 导入 md", run:()=>this.importNotes("files") },
                { id:"import-folder", group:"数据与备份", label:"把整个文件夹导入", keywords:"import 导入 文件夹", run:()=>this.importNotes("folder") },
                { id:"open-notes-folder", group:"数据与备份", label:"在文件夹里查看笔记", keywords:"folder 目录 data 文件", run:()=>window.electron.openDataFolder("notes").catch(()=>{}) },
                { id:"backup", group:"数据与备份", label:"备份全部数据", keywords:"backup 备份 复制", run:()=>this.backup() }
            ]
        }
    },
    computed:{
        filtered(){
            const query = this.query.trim().toLowerCase()
            if(query === "") return this.commands
            return this.commands.filter(command=>{
                return (command.label + " " + command.keywords + " " + command.id).toLowerCase().includes(query)
            })
        },
        groups(){
            const filtered = this.filtered
            const grouped = []
            let offset = 0
            for(const name of GROUPS){
                const commands = filtered.filter(c=>c.group === name)
                grouped.push({ name, offset, commands })
                offset += commands.length
            }
            return grouped
        }
    },
    watch:{
        // 过滤后列表变短，旧的选中项可能越界，Enter 会执行到不存在的命令
        filtered(){
            if(this.activeIndex >= this.filtered.length) this.activeIndex = 0
        }
    },
    methods:{
        onKeydown(event){
            const modifier = event.ctrlKey || event.metaKey
            if(!modifier || !event.shiftKey || event.altKey) return
            const key = String(event.key || "").toLowerCase()
            if(key !== "p") return
            event.preventDefault()
            event.stopPropagation()
            if(this.visible) this.close()
            else this.open()
        },
        open(){
            this.visible = true
            this.query = ""
            this.activeIndex = 0
            this.$nextTick(()=>{
                const input = this.$refs.input
                if(input) input.focus()
            })
        },
        close(){
            this.visible = false
            this.query = ""
            this.activeIndex = 0
        },
        move(step){
            const total = this.filtered.length
            if(total === 0) return
            this.activeIndex = (this.activeIndex + step + total) % total
        },
        runActive(){
            const command = this.filtered[this.activeIndex]
            if(!command) return
            this.run(command)
        },
        async run(command){
            if(!command) return
            this.close()
            try{
                await command.run()
            }catch(error){
                ElMessage.error(typeof error === "string" ? error : "命令执行失败")
            }
        },
        async createNote(){
            if(this.$route.path !== "/") await this.$router.push("/")
            setTimeout(()=>emitter.emit("request-create-note"),60)
        },
        async createSticky(){
            if(this.$route.path !== "/") await this.$router.push("/")
            setTimeout(()=>emitter.emit("request-create-sticky"),60)
        },
        async toggleTheme(){
            let theme = "dark"
            try{
                theme = await window.electron.getSetting("theme")
            }catch{}
            const next = theme === "light" ? "dark" : "light"
            await window.electron.setSetting("theme",next)
        },
        async importNotes(mode){
            const result = await window.electron.importNotes(mode)
            if(result?.canceled) return
            const created = Array.isArray(result?.created) ? result.created.length : 0
            const failed = Array.isArray(result?.failed) ? result.failed.length : 0
            if(created > 0) ElMessage.success("已导入 " + created + " 篇笔记")
            if(failed > 0) ElMessage.warning("有 " + failed + " 个文件没能导入")
            if(created === 0 && failed === 0) ElMessage.info("没找到可以导入的内容")
        },
        async backup(){
            const result = await window.electron.backupData()
            if(result?.canceled) return
            ElMessage.success("备份完成")
        }
    },
    mounted(){
        window.addEventListener("keydown",this.onKeydown,true)
    },
    beforeUnmount(){
        window.removeEventListener("keydown",this.onKeydown,true)
    }
}
</script>

<style scoped>
.cmd-mask{
    position: fixed;
    inset: 0;
    z-index: 61;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 14vh;
    background: rgba(0,0,0,0.30);
}
.cmd-panel{
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: min(460px, 92vw);
    max-height: 66vh;
    background: var(--surface-1);
    border: 1px solid var(--border-2);
    border-radius: var(--radius-2);
    box-shadow: 0 18px 48px rgba(0,0,0,0.24);
    overflow: hidden;
}
.cmd-input{
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-1);
}
.cmd-caret{
    flex-shrink: 0;
    font-size: 15px;
    color: var(--accent-strong);
}
.cmd-input input{
    flex: 1 1 auto;
    height: 24px;
    font-size: 14px;
    color: var(--text-1);
    background: transparent;
    border: 0;
    outline: none;
}
.cmd-input input::placeholder{
    color: var(--text-2);
}
.cmd-count{
    flex-shrink: 0;
    font-size: 12px;
    font-family: var(--font-en);
    color: var(--text-2);
}
.cmd-empty{
    padding: 18px 14px;
    font-size: 13px;
    color: var(--text-2);
}
.cmd-group{
    flex-shrink: 0;
    padding: 6px;
}
.cmd-group-name{
    margin: 0;
    padding: 4px 10px 2px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.4px;
    color: var(--text-2);
}
.cmd-item{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-1);
    cursor: pointer;
}
.cmd-item.active{
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.cmd-name{
    font-size: 13px;
    color: var(--text-1);
}
.cmd-hint{
    flex-shrink: 0;
    font-size: 11px;
    font-family: var(--font-en);
    color: var(--text-2);
}
.cmd-foot{
    flex-shrink: 0;
    padding: 8px 14px;
    font-size: 11px;
    color: var(--text-2);
    border-top: 1px solid var(--border-1);
}
</style>