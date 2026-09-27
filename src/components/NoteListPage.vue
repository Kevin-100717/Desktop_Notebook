<template>
    <div id="note-list-page">
        <div id="note-panel">
            <div id="control-panel">
                <div class="main-btn" @click="createNoteDialog">
                    <i class="icon-plus main-btn-icon"></i>
                    <p>新建笔记</p>
                </div>
                <div class="main-btn" @click="createStickyDialog">
                    <i class="icon-plus main-btn-icon"></i>
                    <p>新建便签</p>
                </div>
                <el-input
                    v-model="searchKeyword"
                    class="search-input"
                    placeholder="搜索标题与正文"
                    clearable
                    :maxlength="60"
                    @input="onSearchInput"
                    @clear="clearSearch"
                ></el-input>
                <div class="import-row">
                    <button class="mini-btn" :disabled="importing" @click="importNotes('files')">导入文件</button>
                    <button class="mini-btn" :disabled="importing" @click="importNotes('folder')">导入文件夹</button>
                </div>
            </div>
            <div id="note-list">
                <template v-if="isSearching">
                    <h2>搜索结果 <span class="result-count">{{ searchRows.length }}</span></h2><br>
                    <div class="tag-filter">
                        <button
                            class="tag-filter-item"
                            :class="{ active: searchKind === 'all' }"
                            @click="searchKind = 'all'"
                        >全部</button>
                        <button
                            class="tag-filter-item"
                            :class="{ active: searchKind === 'note' }"
                            @click="searchKind = 'note'"
                        >笔记</button>
                        <button
                            class="tag-filter-item"
                            :class="{ active: searchKind === 'sticky' }"
                            @click="searchKind = 'sticky'"
                        >便签</button>
                    </div>
                    <div v-if="searchLoading" class="search-hint">搜索中…</div>
                    <div v-else-if="searchRows.length === 0" class="note-empty">
                        <p class="note-empty-title">没有找到「{{ searchKeyword.trim() }}」</p>
                        <p class="note-empty-desc">换个关键词试试，标题和正文都会被搜索</p>
                    </div>
                    <div
                        v-for="row in searchRows"
                        :key="row.kind + '-' + row.time"
                        class="note-box"
                        :class="{ 'note-box-sticky': row.kind === 'sticky' }"
                        @click="onResultClicked(row)"
                    >
                        <p class="note-title">
                            <template v-for="(part,index) in highlightParts(row.title, searchKeyword)" :key="'t'+index">
                                <mark v-if="part.hit" class="hit">{{ part.text }}</mark>
                                <template v-else>{{ part.text }}</template>
                            </template>
                        </p>
                        <span class="note-time">{{ formatTime(row.time) }}</span>
                        <span v-if="row.kind === 'sticky'" class="note-kind">便签</span>
                        <span v-else class="note-kind note-kind-plain">{{ row.field === 'title' ? "标题命中" : "正文命中" }}</span>
                        <p v-if="row.field === 'content'" class="note-snippet">
                            <span v-if="row.snippet.prefix" class="snippet-edge">…</span>
                            <template v-for="(part,index) in highlightParts(row.snippet.text, searchKeyword)" :key="'s'+index">
                                <mark v-if="part.hit" class="hit">{{ part.text }}</mark>
                                <template v-else>{{ part.text }}</template>
                            </template>
                            <span v-if="row.snippet.suffix" class="snippet-edge">…</span>
                        </p>
                    </div>
                </template>
                <template v-else>
                <h2>所有笔记</h2><br>
                <div class="tag-filter" v-if="tagOptions.length > 0">
                    <button
                        class="tag-filter-item"
                        :class="{ active: activeTag === '' }"
                        @click="activeTag = ''"
                    >全部 {{ noteCount }}</button>
                    <button
                        v-for="tag in tagOptions"
                        :key="tag"
                        class="tag-filter-item"
                        :class="{ active: activeTag === tag }"
                        @click="activeTag = activeTag === tag ? '' : tag"
                    >
                        <i v-if="colorOf(tag)" class="tag-dot" :style="{ background: colorOf(tag) }"></i>
                        {{ tag }} {{ tagCount(tag) }}
                    </button>
                </div>
                <div v-if="notesData.length === 0" class="note-empty">
                    <div class="note-empty-icon">
                        <i class="icon-plus note-empty-img"></i>
                    </div>
                    <p class="note-empty-title">还没有任何笔记</p>
                    <p class="note-empty-desc">点击「新建笔记」开始记录点滴</p>
                    <button class="note-empty-btn" @click="createNoteDialog">新建笔记</button>
                </div>
                <div v-else-if="filteredNotesData.length === 0" class="note-empty">
                    <p class="note-empty-title">没有匹配「{{ activeTag }}」的笔记</p>
                    <p class="note-empty-desc">换个标签看看，或取消筛选</p>
                    <button class="note-empty-btn" @click="activeTag = ''">查看全部</button>
                </div>
                <template v-else>
                <div v-for="dateBlock in filteredNotesData" :key="dateBlock.dat">
                    <h4>{{ dateBlock.dat }}</h4>
                    <div class="divider-line"></div>
                    <div
                        class="note-box"
                        :class="{ 'note-box-sticky': item.kind === 'sticky' }"
                        v-for="item in dateBlock.notes"
                        :key="item.kind + '-' + item.time"
                        @click="onItemClicked(item)"
                    >
                        <p class="note-title">{{ item.det.title }}</p>
                        <span class="note-time">{{ item.det.createAt }}</span>
                        <span v-if="item.kind === 'sticky'" class="note-kind">便签</span>
                        <el-dropdown
                            trigger="click"
                            popper-class="card-dropdown"
                            @click.stop
                            @command="onCardCommand($event,item)"
                        >
                            <button class="more-btn" title="更多操作" @click.stop>⋯</button>
                            <template #dropdown>
                                <el-dropdown-menu>
                                    <el-dropdown-item v-if="item.kind === 'note'" command="rename">重命名</el-dropdown-item>
                                    <el-dropdown-item command="export">导出为文件</el-dropdown-item>
                                    <el-dropdown-item command="delete" divided class="menu-danger">删除</el-dropdown-item>
                                </el-dropdown-menu>
                            </template>
                        </el-dropdown>
                        <div class="note-tags" v-if="noteTags(item).length > 0">
                            <span class="note-tag" v-for="tag in noteTags(item)" :key="tag">{{ tag }}</span>
                        </div>
                    </div>
                </div>
                </template>
                </template>
            </div>
        </div>
        <el-dialog
            v-model="dialogVisible"
            title="新建笔记"
            width="min(420px, 90vw)"
            @closed="resetCreateDialog"
        >
            <span>创建一篇笔记</span>
            <br><br>
            <el-input
                v-model="newNoteTitle"
                placeholder="请输入笔记标题"
                @input="createError = ''"
                @keyup.enter="submitCreateNote"
            ></el-input>
            <p v-if="createError" class="dialog-error">{{ createError }}</p>
            <template #footer>
            <div class="dialog-footer">
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="creating" @click="submitCreateNote">
                创建
                </el-button>
            </div>
            </template>
        </el-dialog>
        <el-dialog
            v-model="stickyDialogVisible"            title="新建便签"
            width="min(420px, 90vw)"
            @closed="resetStickyDialog"
        >
            <span>创建一张便签</span>
            <br><br>
            <el-input
                v-model="newStickyTitle"
                placeholder="请输入便签标题"
                @input="stickyError = ''"
                @keyup.enter="submitCreateSticky"
            ></el-input>
            <p v-if="stickyError" class="dialog-error">{{ stickyError }}</p>
            <template #footer>
            <div class="dialog-footer">
                <el-button @click="stickyDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="creatingSticky" @click="submitCreateSticky">
                创建
                </el-button>
            </div>
            </template>
        </el-dialog>
        <el-dialog
            v-model="renameDialogVisible"
            title="重命名笔记"
            width="min(420px, 90vw)"
            @closed="resetRenameDialog"
        >
            <span>修改笔记标题</span>
            <br><br>
            <el-input
                v-model="renameTitle"
                placeholder="请输入笔记标题"
                @input="renameError = ''"
                @keyup.enter="submitRename"
            ></el-input>
            <p v-if="renameError" class="dialog-error">{{ renameError }}</p>
            <template #footer>
            <div class="dialog-footer">
                <el-button @click="renameDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="renaming" @click="submitRename">
                保存
                </el-button>
            </div>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import { ElButton, ElDialog, ElDropdown, ElDropdownItem, ElDropdownMenu, ElInput, ElMessage, ElMessageBox } from "element-plus"
import emitter from "../utils/emitter"
import NoteEditPage from "./NoteEditPage.vue"

function fmtDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default {
    components:{ ElButton, ElDialog, ElDropdown, ElDropdownItem, ElDropdownMenu, ElInput },
    data() {
        return {
            notesData: [],
            allTags: [],
            activeTag: "",
            unsubscribe: null,
            listRequestId: 0,
            dialogVisible:false,
            newNoteTitle:"",
            createError:"",
            creating:false,
            stickyDialogVisible:false,
            newStickyTitle:"",
            stickyError:"",
            creatingSticky:false,
            renameDialogVisible:false,
            renameTarget:null,
            renameTitle:"",
            renameError:"",
            renaming:false,
            deletingNoteTime:null,
            searchKeyword:"",
            searchResults:[],
            searchKind:"all",
            searchLoading:false,
            searchTimer:null,
            searchId:0,
            importing:false,
            pinnedTags:[],
            tagColors:{}
        }
    },
    computed:{
        noteCount(){
            return this.notesData.reduce((total,block)=>total + block.notes.length,0)
        },
        isSearching(){
            return this.searchKeyword.trim().length > 0
        },
        searchRows(){
            if(!this.isSearching) return []
            return this.searchResults
                .filter(row=>this.searchKind === "all" || row.kind === this.searchKind)
                .map(row=>Object.assign({},row,{ item:this.findItem(row.kind,row.time) }))
        },
        tagOptions(){
            const pinned = this.pinnedTags.map(item=>String(item).toLowerCase())
            return [...this.allTags].sort((a,b)=>{
                const pa = pinned.includes(a.toLowerCase()) ? 0 : 1
                const pb = pinned.includes(b.toLowerCase()) ? 0 : 1
                if(pa !== pb) return pa - pb
                return 0
            })
        },
        filteredNotesData(){
            if(this.activeTag === "") return this.notesData
            const key = this.activeTag.toLowerCase()
            return this.notesData
                .map(block=>({dat:block.dat,notes:block.notes.filter(note=>note.kind === 'note' && this.noteTags(note).some(tag=>tag.toLowerCase() === key))}))
                .filter(block=>block.notes.length > 0)
        }
    },
    methods: {
        colorOf(tag){
            const colors = this.tagColors || {}
            if(colors[tag]) return colors[tag]
            const key = String(tag || "").toLowerCase()
            const found = Object.keys(colors).find(item=>item.toLowerCase() === key)
            return found ? colors[found] : ""
        },
        async loadTagMeta(){
            try{
                const colors = await window.electron.getSetting("tagColors")
                this.tagColors = colors && typeof colors === "object" && !Array.isArray(colors) ? colors : {}
            }catch{
                this.tagColors = {}
            }
            try{
                const pinned = await window.electron.getSetting("pinnedTags")
                this.pinnedTags = Array.isArray(pinned) ? pinned : []
            }catch{
                this.pinnedTags = []
            }
        },
        noteTags(note){
            if(!Array.isArray(note?.tags)) return []
            return note.tags.filter(item=>typeof item === "string" && item.trim().length > 0)
        },
        findItem(kind,time){
            const target = String(time)
            for(const block of this.notesData){
                const found = block.notes.find(item=>item.kind === kind && String(item.time) === target)
                if(found) return found
            }
            return null
        },
        formatTime(time){
            const date = new Date(Number(time))
            if(Number.isNaN(date.getTime())) return ""
            return date.toLocaleString()
        },
        highlightParts(text,keyword){
            const source = String(text == null ? "" : text)
            const needle = String(keyword == null ? "" : keyword).trim()
            if(!needle) return [{ text:source, hit:false }]
            const lowerSource = source.toLowerCase()
            const lowerNeedle = needle.toLowerCase()
            const parts = []
            let cursor = 0
            let index = lowerSource.indexOf(lowerNeedle)
            while(index !== -1){
                if(index > cursor) parts.push({ text:source.slice(cursor,index), hit:false })
                parts.push({ text:source.slice(index,index + needle.length), hit:true })
                cursor = index + needle.length
                index = lowerSource.indexOf(lowerNeedle,cursor)
            }
            if(cursor < source.length) parts.push({ text:source.slice(cursor), hit:false })
            if(parts.length === 0) parts.push({ text:source, hit:false })
            return parts
        },
        onSearchInput(){
            if(this.searchTimer) clearTimeout(this.searchTimer)
            const keyword = this.searchKeyword.trim()
            if(keyword.length === 0){
                this.clearSearch()
                return
            }
            this.searchLoading = true
            this.searchTimer = setTimeout(()=>this.runSearch(keyword),220)
        },
        async runSearch(keyword){
            const request = ++this.searchId
            if(this.searchTimer) clearTimeout(this.searchTimer)
            this.searchTimer = null
            try{
                const result = await window.electron.searchContent(keyword)
                if(request !== this.searchId) return
                this.searchResults = Array.isArray(result?.results) ? result.results : []
            }catch{
                if(request === this.searchId) this.searchResults = []
            }finally{
                if(request === this.searchId) this.searchLoading = false
            }
        },
        clearSearch(){
            if(this.searchTimer) clearTimeout(this.searchTimer)
            this.searchTimer = null
            this.searchId++
            this.searchKeyword = ""
            this.searchResults = []
            this.searchKind = "all"
            this.searchLoading = false
        },
        async onResultClicked(row){
            if(row.kind === 'sticky'){
                window.electron.openSticky(row.time).catch(()=>ElMessage.error("便签窗口打开失败"))
                return
            }
            if(row.item){
                this.onNoteClicked(row.item)
                return
            }
            await this.getNoteList()
            const found = this.findItem('note',row.time)
            if(found) this.onNoteClicked(found)
            else ElMessage.error("该笔记已不存在")
        },
        async importNotes(mode){
            if(this.importing) return
            this.importing = true
            try{
                const result = await window.electron.importNotes(mode)
                if(result?.canceled) return
                const created = Array.isArray(result?.created) ? result.created.length : 0
                const failed = Array.isArray(result?.failed) ? result.failed.length : 0
                await this.getNoteList()
                if(created > 0) ElMessage.success("成功导入 " + created + " 篇笔记")
                if(failed > 0) ElMessage.warning(failed + " 个文件无法导入")
                if(created === 0 && failed === 0) ElMessage.info("没有可导入的内容")
            }catch(error){
                ElMessage.error(typeof error === "string" ? error : "导入失败，请重试")
            }finally{
                this.importing = false
            }
        },
        async exportItem(item){
            try{
                const result = await window.electron.exportContent(item.kind,item.time)
                if(result?.canceled) return
                ElMessage.success("已导出到 " + result.filePath)
            }catch{
                ElMessage.error("导出失败，请重试")
            }
        },
        tagCount(tag){
            const key = tag.toLowerCase()
            return this.notesData.reduce((total,block)=>total + block.notes.filter(note=>note.kind === 'note' && this.noteTags(note).some(item=>item.toLowerCase() === key)).length,0)
        },
        async getNoteList() {
            const request = ++this.listRequestId
            try {
                const notesList = await window.electron.getNoteList()
                let stickyList = null
                try {
                    stickyList = await window.electron.getStickyList()
                } catch {
                    stickyList = null
                }
                if(request !== this.listRequestId) return false
                const groups = new Map()
                const notes = [
                    ...notesList.notes.map(item => ({...item,kind:'note'})),
                    ...(Array.isArray(stickyList?.sticky) ? stickyList.sticky : []).map(item => ({...item,kind:'sticky'}))
                ]
                    .filter(item => item?.det && item.time != null)
                    .sort((a,b) => Number(b.time) - Number(a.time))
                notes.forEach(item => {
                    const date = fmtDate(new Date(item.time))
                    if(!groups.has(date)) groups.set(date, [])
                    groups.get(date).push(item)
                })
                this.notesData = [...groups.entries()]
                    .sort((a,b) => b[0].localeCompare(a[0]))
                    .map(([dat,notes]) => ({dat,notes}))
                const tags = Array.isArray(notesList.tags)
                    ? notesList.tags.filter(item=>typeof item === "string" && item.trim().length > 0)
                    : []
                this.allTags = tags
                if(this.activeTag !== "" && !tags.some(item=>item.toLowerCase() === this.activeTag.toLowerCase())){
                    this.activeTag = ""
                }
                emitter.emit('notes-list-updated', this.notesData)
                return true
            } catch {
                if(request === this.listRequestId) {
                    this.notesData = []
                    this.allTags = []
                    this.activeTag = ""
                    emitter.emit('notes-list-updated', this.notesData)
                }
                return request === this.listRequestId
            }
        },
        onNoteClicked(note) {
            emitter.emit('add-tab', {
                title: note.det.title,
                component: NoteEditPage,
                props: { noteData: note },
                closable: true
            })
        },
        onItemClicked(item) {
            if(item.kind === 'sticky'){
                window.electron.openSticky(item.time).catch(()=>{
                    ElMessage.error("便签窗口打开失败")
                })
                return
            }
            this.onNoteClicked(item)
        },
        createNoteDialog(){
            this.newNoteTitle = ""
            this.createError = ""
            this.dialogVisible = true
        },
        resetCreateDialog(){
            this.newNoteTitle = ""
            this.createError = ""
        },
        async submitCreateNote(){
            if(this.creating) return
            const title = typeof this.newNoteTitle === "string" ? this.newNoteTitle.trim() : ""
            if(!title){
                this.createError = "笔记标题不能为空"
                return
            }
            this.creating = true
            try{
                const note = await window.electron.createNote(title)
                this.dialogVisible = false
                this.resetCreateDialog()
                await this.getNoteList()
                if(note?.det) this.onNoteClicked(note)
            }catch{
                this.createError = "创建失败，请重试"
            }finally{
                this.creating = false
            }
        },
        async confirmDeleteItem(item){
            if(this.deletingNoteTime != null) return
            const isSticky = item.kind === 'sticky'
            this.deletingNoteTime = item.time
            try{
                await ElMessageBox.confirm(
                    `确定删除“${item.det.title}”吗？删除后会移入回收站，可以随时还原。`,
                    isSticky ? "删除便签" : "删除笔记",
                    {
                        type:"warning",
                        confirmButtonText:"移入回收站",
                        cancelButtonText:"取消",
                        confirmButtonClass:"el-button--danger"
                    }
                )
            }catch{
                this.deletingNoteTime = null
                return
            }
            try{
                if(isSticky){
                    await window.electron.deleteSticky(item.time)
                }else{
                    await window.electron.deleteNote(item.time)
                    emitter.emit("note-deleted", item.time)
                }
                await this.getNoteList()
                ElMessage.success(isSticky ? "便签已移入回收站" : "笔记已移入回收站")
            }catch{
                ElMessage.error("删除失败，请重试")
            }finally{
                this.deletingNoteTime = null
            }
        },
        onCardCommand(command,item){
            if(command === 'rename'){
                this.startRename(item)
                return
            }
            if(command === 'export'){
                this.exportItem(item)
                return
            }
            if(command === 'delete') this.confirmDeleteItem(item)
        },
        startRename(item){
            this.renameTarget = item
            this.renameTitle = item.det.title
            this.renameError = ""
            this.renameDialogVisible = true
        },
        resetRenameDialog(){
            this.renameTarget = null
            this.renameTitle = ""
            this.renameError = ""
        },
        async submitRename(){
            if(this.renaming || !this.renameTarget) return
            const title = typeof this.renameTitle === "string" ? this.renameTitle.trim() : ""
            if(!title){
                this.renameError = "笔记标题不能为空"
                return
            }
            this.renaming = true
            try{
                const result = await window.electron.renameNote(this.renameTarget.time, title)
                this.renameDialogVisible = false
                this.resetRenameDialog()
                await this.getNoteList()
                if(result?.time != null) emitter.emit("note-renamed",{tid:result.time,title:result.title})
                ElMessage.success("重命名成功")
            }catch{
                this.renameError = "重命名失败，请重试"
            }finally{
                this.renaming = false
            }
        },
        createStickyDialog(){
            this.newStickyTitle = ""
            this.stickyError = ""
            this.stickyDialogVisible = true
        },
        resetStickyDialog(){
            this.newStickyTitle = ""
            this.stickyError = ""
        },
        async submitCreateSticky(){
            if(this.creatingSticky) return
            const title = typeof this.newStickyTitle === "string" ? this.newStickyTitle.trim() : ""
            if(!title){
                this.stickyError = "便签标题不能为空"
                return
            }
            this.creatingSticky = true
            try{
                const sticky = await window.electron.createSticky(title)
                this.stickyDialogVisible = false
                this.resetStickyDialog()
                await this.getNoteList()
                if(sticky?.time != null) window.electron.openSticky(sticky.time)
            }catch{
                this.stickyError = "创建失败，请重试"
            }finally{
                this.creatingSticky = false
            }
        }
    },
    mounted() {
        this.unsubscribe = window.electron.onNoteUpdated(note => {
            if(note.deleted) emitter.emit("note-deleted", note.tid)
            if(note.stickyDeleted) window.electron.closeSticky(note.tid)
            if(note.list || note.sticky) this.getNoteList()
        })
        this.onCreateNote = ()=>this.createNoteDialog()
        this.onCreateSticky = ()=>this.createStickyDialog()
        emitter.on('request-create-note', this.onCreateNote)
        emitter.on('request-create-sticky', this.onCreateSticky)
        this.offSetting = window.electron.onSettingUpdated(setting=>{
            if(!setting || typeof setting.key !== "string") return
            if(setting.key === "tagColors" || setting.key === "pinnedTags") this.loadTagMeta()
        })
        this.getNoteList()
        this.loadTagMeta()
    },
    activated() {
        this.getNoteList()
        this.loadTagMeta()
    },
    beforeUnmount() {
        if(this.unsubscribe) this.unsubscribe()
        if(this.offSetting) this.offSetting()
        if(this.searchTimer) clearTimeout(this.searchTimer)
        if(this.onCreateNote) emitter.off('request-create-note', this.onCreateNote)
        if(this.onCreateSticky) emitter.off('request-create-sticky', this.onCreateSticky)
    }
}
</script>

<style scoped>
#note-list-page{
    width: 100%;
    height: 100%;
    overflow: auto;
    color: var(--text-1);
}
#note-panel{
    width: min(650px, calc(100% - 32px));
    margin: clamp(24px, 6vh, 60px) auto;
    position: relative;
    display: grid;
    grid-template-columns: minmax(120px, 30%) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
}
.icon-plus{
    display: block;
    flex-shrink: 0;
    background-color: currentColor;
    -webkit-mask-image: var(--icon-plus);
    mask-image: var(--icon-plus);
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
}
.main-btn-icon{
    width: 21px;
    height: 21px;
    color: var(--text-1);
    transition: color 0.15s var(--ease);
}
#control-panel{
    width: auto;
    padding-right: 20px;
    border-right: 1px solid var(--border-1);
}
.main-btn{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-sizing: border-box;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    padding: 14px 10px;
    text-align: center;
    width: 80%;
    user-select: none;
    cursor: pointer;
    margin: 10px 0;
    background: var(--block-1);
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.main-btn p{
    margin: 0;
    font-size: 14px;
}
.main-btn:hover{
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.main-btn:hover .main-btn-icon{
    color: var(--accent-strong);
}
#note-list{
    position: static;
    width: auto;
    min-width: 0;
}
.search-input{
    margin: 14px 0 0;
}
:deep(.search-input .el-input__wrapper){
    padding: 1px 10px;
    background: var(--block-1);
    box-shadow: none;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    transition: border-color 0.15s var(--ease);
}
:deep(.search-input .el-input__wrapper:hover){
    border-color: var(--border-2);
}
:deep(.search-input .el-input__wrapper.is-focus){
    border-color: var(--accent-border);
}
:deep(.search-input .el-input__inner){
    font-size: 13px;
    color: var(--text-1);
}
.import-row{
    display: flex;
    gap: 8px;
    margin-top: 10px;
}
.mini-btn{
    flex: 1;
    height: 28px;
    padding: 0 6px;
    font-size: 12px;
    color: var(--text-2);
    background: transparent;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s var(--ease), border-color 0.15s var(--ease), background 0.15s var(--ease);
}
.mini-btn:hover:not(:disabled){
    color: var(--accent-strong);
    border-color: var(--accent-border);
    background: var(--accent-soft);
}
.mini-btn:disabled{
    opacity: 0.5;
    cursor: default;
}
.result-count{
    font-size: 14px;
    font-weight: 400;
    color: var(--text-2);
    font-family: var(--font-en);
}
.search-hint{
    padding: 14px 0;
    font-size: 13px;
    color: var(--text-2);
}
.note-snippet{
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-2);
    word-break: break-word;
}
.snippet-edge{
    color: var(--text-2);
}
.note-kind-plain{
    color: var(--text-2);
    background: var(--block-2);
}
.hit{
    padding: 0 1px;
    color: var(--on-accent);
    background: var(--highlight-1);
    border-radius: 3px;
}
#note-list h2{
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.3px;
}
.tag-filter{
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 14px;
}
.tag-filter-item{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--text-2);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s var(--ease), color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.tag-filter-item:hover{
    color: var(--accent-strong);
    border-color: var(--accent-border);
    background: var(--accent-soft);
}
.tag-filter-item.active{
    color: var(--on-accent);
    background: var(--accent-strong);
    border-color: var(--accent-strong);
}
.tag-dot{
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
}
.note-tags{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    padding-right: 4px;
}
.note-tag{
    padding: 2px 9px;
    font-size: 12px;
    line-height: 18px;
    color: var(--accent-strong);
    background: var(--accent-soft);
    border: 1px solid var(--accent-border);
    border-radius: 999px;
    white-space: nowrap;
}
#note-list h4{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
    font-family: var(--font-en);
}
#note-list h4::before{
    content: "";
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent-strong);
}
.divider-line{
    height: 1px;
    width: 100%;
    margin: 8px 0 4px;
    background: linear-gradient(90deg, var(--border-2), transparent);
}
.note-box{
    box-sizing: border-box;
    position: relative;
    margin: 8px 0;
    padding: 12px 78px 12px 18px;
    width: 100%;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    background: var(--block-1);
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
    user-select: none;
    cursor: pointer;
}
.note-box::before{
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: var(--radius-1) 0 0 var(--radius-1);
    background: var(--accent-strong);
    opacity: 0;
    transition: opacity 0.15s var(--ease);
}
.note-box:hover{
    background: var(--block-2);
    border-color: var(--border-2);
}
.note-box:hover::before{
    opacity: 1;
}
.note-box-sticky{
    background: var(--sticky-soft);
    border-color: var(--sticky-border);
}
.note-box-sticky::before{
    background: var(--sticky-strong);
    opacity: 1;
}
.note-box-sticky:hover{
    background: var(--sticky-soft-hover);
    border-color: var(--sticky-border);
}
.note-kind{
    display: inline-block;
    margin-top: 8px;
    padding: 2px 9px;
    font-size: 12px;
    line-height: 18px;
    color: var(--on-accent);
    background: var(--sticky-strong);
    border-radius: 999px;
}
.note-title{
    font-size: 18px;
    font-weight: 500;
    margin: 0 0 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.note-time{
    display: block;
    font-size: 13px;
    color: var(--text-2);
    font-family: var(--font-en);
}
.note-box .el-dropdown{
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: block;
}
.more-btn{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    font-size: 18px;
    line-height: 1;
    color: var(--text-2);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-1);
    cursor: pointer;
    opacity: 0.6;
    transition: background 0.15s var(--ease), color 0.15s var(--ease), border-color 0.15s var(--ease), opacity 0.15s var(--ease);
}
.note-box:hover .more-btn{
    opacity: 1;
}
.more-btn:hover{
    color: var(--accent-strong);
    background: var(--accent-soft);
    border-color: var(--accent-border);
}
.dialog-error{
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--danger);
}
.note-empty{
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: clamp(24px, 8vh, 60px) 16px;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-2);
    background: var(--block-1);
}
.note-empty-icon{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 66px;
    height: 66px;
    margin-bottom: 18px;
    border-radius: var(--radius-1);
    background: var(--highlight-1);
}
.note-empty-img{
    width: 26px;
    height: 26px;
    color: var(--on-accent);
}
.note-empty-title{
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 600;
}
.note-empty-desc{
    margin: 0 0 20px;
    max-width: 340px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-2);
}
.note-empty-btn{
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 500;
    color: var(--on-accent);
    background: var(--highlight-1);
    border: none;
    border-radius: var(--radius-1);
    cursor: pointer;
    transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
.note-empty-btn:hover{
    background: var(--accent-strong);
}
.dialog-footer{
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
@media (max-width: 560px){
    #note-panel{
        grid-template-columns: 1fr;
        margin: 24px auto;
    }
    #control-panel{
        display: flex;
        gap: 12px;
        width: 100%;
        padding: 0 0 16px;
        border-right: none;
        border-bottom: 1px solid var(--border-1);
    }
    .main-btn{
        flex: 1;
        width: auto;
        margin: 0;
    }
    #note-list{
        width: 100%;
    }
}
</style>
