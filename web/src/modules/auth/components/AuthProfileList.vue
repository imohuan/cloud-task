<template>
  <div class="w-full space-y-4 lg:w-1/2">
    <div class="grid grid-cols-3 gap-3">
      <div class="card-compact rounded-xl bg-white p-3">
        <p class="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">总配置数</p>
        <p class="text-xl font-bold text-slate-700">{{ profiles?.length ?? 0 }}</p>
      </div>
      <div class="card-compact rounded-xl bg-white p-3">
        <p class="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">平台数</p>
        <p class="text-xl font-bold text-blue-600">{{ uniquePlatformCount }}</p>
      </div>
      <div class="card-compact rounded-xl bg-white p-3">
        <p class="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">活跃配置</p>
        <p class="text-xl font-bold text-emerald-600">{{ profiles?.length ?? 0 }}</p>
      </div>
    </div>

    <button
      :class="{ 'border-blue-200 bg-blue-50': isAdding }"
      class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
      @click="$emit('add')"
    >
      <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
        <AddFilled class="h-3 w-3 text-blue-600" />
      </div>
      <span class="text-xs font-bold">添加新认证配置</span>
    </button>

    <div class="card-compact relative min-h-[200px] overflow-hidden rounded-2xl bg-white">
      <div class="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <h3 class="text-[11px] font-bold tracking-wider text-slate-600 uppercase">已保存的认证配置</h3>
      </div>

      <div v-if="loading" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90">
        <RefreshFilled class="mb-3 h-8 w-8 animate-spin text-blue-500" />
        <p class="text-sm text-slate-500">加载中...</p>
      </div>

      <div v-else-if="(profiles?.length ?? 0) === 0" class="py-12 text-center text-slate-300">
        <VpnKeyFilled class="mx-auto mb-2 h-8 w-8" />
        <p class="text-xs font-bold tracking-widest uppercase">暂无认证配置</p>
        <p class="mt-1 text-[10px]">点击上方按钮添加第一个配置</p>
      </div>

      <div v-else class="divide-y divide-slate-50">
        <div
          v-for="profile in profiles"
          :key="profile.id"
          :class="{
            'relative bg-blue-50/80 shadow-sm': selectedProfileId === profile.id,
            'hover:bg-slate-50': selectedProfileId !== profile.id,
          }"
          class="group cursor-pointer p-4 transition-all"
          @click="$emit('select', profile)"
        >
          <div
            v-if="selectedProfileId === profile.id"
            class="absolute top-0 bottom-0 left-0 w-1 rounded-r-full bg-blue-500"
          />
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div
                :class="
                  selectedProfileId === profile.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600'
                "
                class="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
              >
                <VpnKeyFilled class="h-4 w-4" />
              </div>
              <div>
                <h4
                  :class="selectedProfileId === profile.id ? 'text-blue-700' : 'text-slate-700'"
                  class="text-xs font-bold transition-colors"
                >
                  {{ profile.name }}
                </h4>
                <p
                  :class="selectedProfileId === profile.id ? 'text-blue-500/70' : 'text-slate-400'"
                  class="mt-0.5 text-[10px] transition-colors"
                >
                  <CloudFilled class="mr-1 inline h-3 w-3" />{{ getPlatformName(profile.platformId) }}
                </p>
              </div>
            </div>
            <div class="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
              <button
                class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="删除"
                @click.stop="$emit('delete', profile)"
              >
                <DeleteFilled class="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RefreshFilled, AddFilled, VpnKeyFilled, CloudFilled, DeleteFilled } from "@vicons/material";

interface Platform {
  id: string;
  name: string;
}

interface AuthProfile {
  id: string;
  platformId: string;
  name: string;
}

const props = defineProps<{
  profiles?: AuthProfile[];
  platforms?: Platform[];
  loading?: boolean;
  isAdding?: boolean;
  selectedProfileId?: string | null;
}>();

defineEmits<{
  (e: "add"): void;
  (e: "select", profile: AuthProfile): void;
  (e: "delete", profile: AuthProfile): void;
}>();

const uniquePlatformCount = computed(() => {
  const ids = (props.profiles || []).map((p) => p.platformId).filter(Boolean);
  return new Set(ids).size;
});

const getPlatformName = (platformId: string) => {
  const platform = (props.platforms || []).find((p) => p.id === platformId);
  return platform?.name || "未知平台";
};
</script>
