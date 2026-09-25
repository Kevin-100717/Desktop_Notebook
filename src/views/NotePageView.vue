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
import WelcomePage from '../components/WelcomePage.vue';

let tabId = 0;

function createWelcomeTab() {
    return { id: tabId++, title: 'Welcome', component: markRaw(WelcomePage), props: {}, closable: false };
}

export default {
    data() {
        return {
            tabs: [createWelcomeTab()],
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
        }
    },
    mounted() {
        emitter.on('add-tab', this.addTab);
    },
    beforeUnmount() {
        emitter.off('add-tab', this.addTab);
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
    overflow-x: auto;
    overflow-y: hidden;
    background: #1a1b1e;
    border-bottom: 1px solid #494949;
}

.tab-item {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 0 12px;
    height: 36px;
    font-size: 13px;
    color: #9ca3af;
    cursor: pointer;
    border-right: 1px solid #494949;
    user-select: none;
    transition: background 0.15s, color 0.15s;
}

.tab-item:hover {
    background: #2e303a;
    color: #f3f4f6;
}

.tab-item.active {
    background: #16171d;
    color: #f3f4f6;
    border-bottom: 2px solid var(--highlight-1, #c084fc);
}

.tab-title {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    font-size: 15px;
    line-height: 1;
    color: #9ca3af;
    transition: background 0.15s, color 0.15s;
}

.tab-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #f3f4f6;
}

#tab-content {
    flex: 1;
    overflow: auto;
}

.tab-page {
    height: 100%;
}

#tab-content::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

#tab-content::-webkit-scrollbar-track {
    background: #16171d;
}

#tab-content::-webkit-scrollbar-thumb {
    background: #3a3b3e;
    border-radius: 3px;
}

#tab-content::-webkit-scrollbar-thumb:hover {
    background: #4a4b4e;
}

#tab-content::-webkit-scrollbar-corner {
    background: #16171d;
}
</style>