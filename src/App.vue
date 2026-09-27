<script setup>
import SideBar from './components/SideBar.vue';
import { watchTheme } from './utils/theme.js';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import uiState from './utils/uiState.js';

const route = useRoute();
const isSticky = computed(() => route.path.startsWith('/sticky/'));

</script>

<template>
  <router-view v-if="isSticky"></router-view>
  <template v-else>
    <SideBar v-show="!uiState.focus"></SideBar>
    <div id="content" :class="{ focus: uiState.focus }">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
    <button v-if="uiState.focus" class="focus-exit" title="退出专注模式" @click="uiState.focus = false">
      退出专注
    </button>
  </template>
</template>

<script>
import emitter from './utils/emitter.js';

export default {
  methods:{
    goRouter(route){
      this.$router.push(route)
    }
  },
  mounted(){
    emitter.on("push-router",this.goRouter)
    this.offSetting = watchTheme()
  },
  beforeUnmount(){
    emitter.off("push-router",this.goRouter)
    if(this.offSetting) this.offSetting()
  }
}
</script>

<style scoped>
#content{
  position: absolute;
  top: 0px;
  left: 60px;
  height: 100%;
  width: calc( 100% - 60px );
}
#content.focus{
  left: 0px;
  width: 100%;
}
.focus-exit{
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 40;
  height: 30px;
  padding: 0 14px;
  font-size: 12px;
  color: var(--text-2);
  background: var(--surface-1);
  border: 1px solid var(--border-1);
  border-radius: var(--radius-1);
  cursor: pointer;
  transition: color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.focus-exit:hover{
  color: var(--text-1);
  border-color: var(--border-2);
}
</style>