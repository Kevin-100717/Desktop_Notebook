<script setup>
import SideBar from './components/SideBar.vue';
import { watchTheme } from './utils/theme.js';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const isSticky = computed(() => route.path.startsWith('/sticky/'));

</script>

<template>
  <router-view v-if="isSticky"></router-view>
  <template v-else>
    <SideBar></SideBar>
    <div id="content">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
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
</style>