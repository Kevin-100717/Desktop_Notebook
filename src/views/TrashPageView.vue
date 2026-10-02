<template>
    <div id="trash-page">
        <div class="trash-head">
            <div class="trash-title">
                <h2>回收站</h2>
                <p class="trash-desc">删掉的东西都在这儿，想好了再还原</p>
            </div>
            <div class="trash-tools">
                <button class="trash-btn" :disabled="loading" @click="getTrash">
                    刷新
                </button>
                <button class="trash-btn trash-btn-danger" :disabled="busy || total === 0" @click="emptyTrash">
                    清空回收站
                </button>
            </div>
        </div>
        <div v-if="loading" class="trash-hint">加载中…</div>
        <div v-else-if="total === 0" class="trash-empty">
            <p class="trash-empty-title">回收站是空的</p>
            <p class="trash-empty-desc">在笔记上点「⋯」删掉，就会跑到这儿来</p>
        </div>
        <template v-else>
            <div v-for="group in groups" :key="group.label">
                <h4>{{ group.label }}<span class="group-count">{{ group.items.length }}</span></h4>
                <div class="divider-line"></div>
                <div
                    class="trash-box"
                    :class="{ 'trash-box-sticky': item.kind === 'sticky' }"
                    v-for="item in group.items"
                    :key="item.kind + '-' + item.time"
                >
                    <div class="trash-main">
                        <p class="trash-item-title">{{ item.title }}</p>
                        <span class="trash-item-time">{{ formatTime(item.time) }}</span>
                        <span class="trash-kind">{{ item.kind === 'sticky' ? "便签" : "笔记" }}</span>
                    </div>
                    <div class="trash-actions">
                        <button class="trash-btn" :disabled="busy" @click="restore(item)">还原</button>
                        <button class="trash-btn trash-btn-danger" :disabled="busy" @click="purge(item)">
                            彻底删除
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script>
import { ElMessage, ElMessageBox } from "element-plus"

function fmtDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default {
    data() {
        return {
            notes: [],
            sticky: [],
            loading: false,
            busy: false,
            hidden: false,
            unsubscribe: null,
            requestId: 0
        }
    },
    computed: {
        total() {
            return this.notes.length + this.sticky.length
        },
        groups() {
            const groups = []
            if (this.notes.length > 0) groups.push({ label: "笔记", items: this.notes })
            if (this.sticky.length > 0) groups.push({ label: "便签", items: this.sticky })
            return groups
        }
    },
    methods: {
        formatTime(time) {
            const date = new Date(Number(time))
            if (Number.isNaN(date.getTime())) return ""
            return fmtDate(date)
        },
        normalize(list, kind) {
            if (!Array.isArray(list)) return []
            return list
                .filter(item => item && item.time != null)
                .map(item => ({
                    kind,
                    time: item.time,
                    title: item.det && item.det.title ? item.det.title : (item.title || "未命名")
                }))
                .sort((a, b) => Number(b.time) - Number(a.time))
        },
        async getTrash() {
            const request = ++this.requestId
            this.loading = true
            try {
                const result = await window.electron.getTrash()
                if (request !== this.requestId) return
                this.notes = this.normalize(result?.notes, "note")
                this.sticky = this.normalize(result?.sticky, "sticky")
            } catch {
                if (request === this.requestId) {
                    this.notes = []
                    this.sticky = []
                    ElMessage.error("没打开成，稍后再试")
                }
            } finally {
                if (request === this.requestId) this.loading = false
            }
        },
        async restore(item) {
            if (this.busy) return
            this.busy = true
            try {
                await window.electron.restoreTrash(item.kind, item.time)
                await this.getTrash()
                ElMessage.success("已还原")
            } catch {
                ElMessage.error("没还原成，稍后再试")
            } finally {
                this.busy = false
            }
        },
        async purge(item) {
            if (this.busy) return
            try {
                await ElMessageBox.confirm(
                    `删掉「${item.title}」就找不回来了，确定吗？`,
                    "彻底删除",
                    {
                        type: "warning",
                        confirmButtonText: "彻底删除",
                        cancelButtonText: "取消",
                        confirmButtonClass: "el-button--danger"
                    }
                )
            } catch {
                return
            }
            this.busy = true
            try {
                await window.electron.purgeTrash(item.kind, item.time)
                await this.getTrash()
                ElMessage.success("彻底删掉了")
            } catch {
                ElMessage.error("没删掉，稍后再试")
            } finally {
                this.busy = false
            }
        },
        async emptyTrash() {
            if (this.busy || this.total === 0) return
            try {
                await ElMessageBox.confirm(
                    `清空后，这 ${this.total} 项内容就找不回来了。确定吗？`,
                    "清空回收站",
                    {
                        type: "warning",
                        confirmButtonText: "清空",
                        cancelButtonText: "取消",
                        confirmButtonClass: "el-button--danger"
                    }
                )
            } catch {
                return
            }
            this.busy = true
            try {
                const result = await window.electron.emptyTrash()
                await this.getTrash()
                const removed = (result?.notes || 0) + (result?.sticky || 0)
                ElMessage.success("已清空 " + removed + " 项")
            } catch {
                ElMessage.error("清空失败，请重试")
            } finally {
                this.busy = false
            }
        }
    },
    mounted() {
        this.unsubscribe = window.electron.onNoteUpdated(note => {
            if(this.hidden) return   // 切走后不再后台请求
            if (note && (note.list || note.sticky)) this.getTrash()
        })
        this.getTrash()
    },
    activated() {
        this.hidden = false
        this.getTrash()
    },
    deactivated() {
        this.hidden = true
    },
    beforeUnmount() {
        if (this.unsubscribe) this.unsubscribe()
    }
}
</script>

<style scoped>
#trash-page{
    width: min(760px, calc(100% - 32px));
    margin: clamp(24px, 6vh, 60px) auto;
    color: var(--text-1);
}
.trash-head{
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 18px;
}
.trash-head h2{
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.3px;
}
.trash-desc{
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
}
.trash-tools{
    display: flex;
    gap: 10px;
}
.trash-btn{
    height: 30px;
    padding: 0 14px;
    font-size: 13px;
    color: var(--text-2);
    background: var(--block-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s var(--ease), border-color 0.15s var(--ease), background 0.15s var(--ease);
}
.trash-btn:hover:not(:disabled){
    color: var(--text-1);
    border-color: var(--border-2);
}
.trash-btn:disabled{
    opacity: 0.5;
    cursor: default;
}
.trash-btn-danger{
    color: var(--danger);
    border-color: var(--danger-soft);
}
.trash-btn-danger:hover:not(:disabled){
    color: #ffffff;
    background: var(--danger);
    border-color: var(--danger);
}
#trash-page h4{
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 18px 0 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
    font-family: var(--font-en);
}
#trash-page h4::before{
    content: "";
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent-strong);
}
.group-count{
    font-size: 12px;
    color: var(--text-2);
}
.divider-line{
    height: 1px;
    width: 100%;
    margin: 8px 0 4px;
    background: linear-gradient(90deg, var(--border-2), transparent);
}
.trash-box{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    box-sizing: border-box;
    margin: 8px 0;
    padding: 12px 14px;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-1);
    background: var(--block-1);
    transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.trash-box:hover{
    background: var(--block-2);
    border-color: var(--border-2);
}
.trash-box-sticky{
    background: var(--sticky-soft);
    border-color: var(--sticky-border);
}
.trash-main{
    min-width: 0;
}
.trash-item-title{
    margin: 0 0 5px;
    font-size: 16px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.trash-item-time{
    font-size: 13px;
    color: var(--text-2);
    font-family: var(--font-en);
}
.trash-kind{
    display: inline-block;
    margin-left: 8px;
    padding: 1px 8px;
    font-size: 12px;
    color: var(--text-2);
    background: var(--block-2);
    border-radius: 999px;
}
.trash-actions{
    display: flex;
    flex-shrink: 0;
    gap: 10px;
}
.trash-hint{
    padding: 30px 0;
    font-size: 13px;
    color: var(--text-2);
}
.trash-empty{
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: clamp(24px, 8vh, 60px) 16px;
    border: 1px solid var(--border-1);
    border-radius: var(--radius-2);
    background: var(--block-1);
}
.trash-empty-title{
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
}
.trash-empty-desc{
    margin: 0;
    max-width: 360px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-2);
}
@media (max-width: 560px){
    .trash-box{
        flex-direction: column;
        align-items: flex-start;
    }
    .trash-actions{
        width: 100%;
    }
    .trash-actions .trash-btn{
        flex: 1;
    }
}
</style>
