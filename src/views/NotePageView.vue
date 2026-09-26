<template>
    <div id="note-page">
        <div id="tab-bar">
            <div
                v-for="(tab, i) in tabs"
                :key="tab.id"
                class="tab-item"
                :class="{ active: activeTab === i }"
                @click="selectTab(i)"
            >
                <span class="tab-title">{{ tab.title }}</span>
                <span v-if="tab.closable" class="tab-close" @click.stop="closeTab(i)">×</span>
            </div>
        </div>
        <div id="tab-content">
            <div
                v-for="(tab, i) in tabs"
                v-show="activeTab === i"
                :key="tab.id"
                class="tab-page"
            >
                <keep-alive>
                    <component
                        :is="tab.component"
                        :key="tab.id"
                        :ref="el => setTabRef(el, tab.id)"
                        v-bind="tab.props"
                    />
                </keep-alive>
            </div>
        </div>
    </div>
</template>

<script>
import { markRaw } from 'vue';
import { ElMessageBox } from 'element-plus';
import emitter from '../utils/emitter';
import NoteListPage from '../components/NoteListPage.vue';

let tabId = 0;

function createNoteListTab() {
    return { id: tabId++, title: '笔记列表', component: markRaw(NoteListPage), props: {}, closable: false };
}

export default {
    data() {
        return {
            tabs: [createNoteListTab()],
            activeTab: 0,
            tabRefs: markRaw(new Map())
        }
    },
    methods: {
        setTabRef(component,id) {
            if(component) this.tabRefs.set(id,component)
            else this.tabRefs.delete(id)
        },
        getTabComponent(id) {
            return this.tabRefs.get(id)
        },
        addTab({ title = 'New Tab', component = null, props = {}, closable = true } = {}) {
            const tid = props.noteData?.time
            const current = this.tabs.findIndex(tab=>tab.props.noteData?.time == tid)
            if(tid != null && current !== -1){
                this.activeTab = current
                return
            }
            this.tabs.push({
                id: tabId++,
                title,
                component: markRaw(component),
                props,
                closable
            });
            this.activeTab = this.tabs.length - 1;
        },
        selectTab(i){
            this.activeTab = i
            this.getTabComponent(this.tabs[i]?.id)?.refreshFromDisk?.()
        },
        async closeTab(i) {
            const tab = this.tabs[i]
            if(!tab?.closable) return
            const component = this.getTabComponent(tab.id)
            if(component?.isDirty){
                try{
                    await ElMessageBox.confirm("当前笔记有未保存修改。", "关闭笔记", {
                        confirmButtonText:"保存并关闭",
                        cancelButtonText:"放弃修改",
                        distinguishCancelAndClose:true,
                        type:"warning"
                    })
                    if(!(await component.save())) return
                }catch(action){
                    if(action !== "cancel") return
                }
            }
            if(this.tabs[i]?.id !== tab.id) return
            this.removeTab(i)
        },
        removeTab(i) {
            const activeId = this.tabs[this.activeTab]?.id
            this.tabs.splice(i, 1)
            const activeIndex = this.tabs.findIndex(tab=>tab.id == activeId)
            this.activeTab = activeIndex == -1 ? Math.min(i,this.tabs.length-1) : activeIndex
        },
        closeNoteTabs(tid) {
            let index = this.tabs.findIndex(tab=>tab.props.noteData != null && String(tab.props.noteData.time) === String(tid))
            while(index !== -1){
                this.removeTab(index)
                index = this.tabs.findIndex(tab=>tab.props.noteData != null && String(tab.props.noteData.time) === String(tid))
            }
        },
        onTrayAction(action) {
            if(action !== 'new-note' && action !== 'new-sticky') return
            const listIndex = this.tabs.findIndex(tab=>tab.component === NoteListPage)
            if(listIndex === -1) return
            this.activeTab = listIndex
            this.$nextTick(()=>{
                emitter.emit(action === 'new-note' ? 'request-create-note' : 'request-create-sticky')
            })
        }
    },
    mounted() {
        emitter.on('add-tab', this.addTab);
        emitter.on('note-deleted', this.closeNoteTabs);
        this.offTray = window.electron.onTrayAction(this.onTrayAction)
    },
    beforeUnmount() {
        emitter.off('add-tab', this.addTab);
        emitter.off('note-deleted', this.closeNoteTabs);
        if(this.offTray) this.offTray()
    }
}
</script>

<style scoped>
#note-page {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

#tab-bar {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    padding: 6px 6px 0;
    overflow-x: auto;
    overflow-y: hidden;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-1);
}

.tab-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 0 14px;
    height: 36px;
    font-size: 14px;
    color: var(--text-2);
    cursor: pointer;
    border-radius: var(--radius-1) var(--radius-1) 0 0;
    user-select: none;
    transition: background 0.15s, color 0.15s;
}

.tab-item:hover {
    background: var(--block-2);
    color: var(--text-1);
}

.tab-item.active {
    background: var(--bg-1);
    color: var(--text-1);
}

.tab-item.active::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: var(--accent-strong);
}

.tab-title {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 19px;
    height: 19px;
    border-radius: 50%;
    font-size: 16px;
    line-height: 1;
    color: var(--text-2);
    transition: background 0.15s, color 0.15s;
}

.tab-close:hover {
    background: var(--danger-soft);
    color: var(--danger);
}

#tab-content {
    flex: 1;
    overflow: auto;
    background: var(--bg-1);
}

.tab-page {
    height: 100%;
    animation: tab-fade-in 0.18s var(--ease, ease);
}

@keyframes tab-fade-in {
    from {
        opacity: 0.55;
    }
    to {
        opacity: 1;
    }
}

#tab-content::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

#tab-content::-webkit-scrollbar-track {
    background: var(--scroll-track);
}

#tab-content::-webkit-scrollbar-thumb {
    background: var(--scroll-thumb);
    border-radius: 3px;
}

#tab-content::-webkit-scrollbar-thumb:hover {
    background: var(--scroll-thumb-hover);
}

#tab-content::-webkit-scrollbar-corner {
    background: var(--scroll-track);
}
</style>