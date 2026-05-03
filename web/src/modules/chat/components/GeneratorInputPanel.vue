<template>
  <div class="flex justify-center transition-all duration-300">
    <div
      :class="[
        'w-full border border-slate-200 bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] transition-all duration-300 hover:shadow-xl',
        isPreviewMode && !isFocused ? 'rounded-xl p-4' : 'rounded-2xl p-6',
      ]"
    >
      <div :class="['mb-1 flex gap-4', isPreviewMode && !isFocused ? 'items-center' : 'items-start']">
        <ImageUploadPreview
          v-if="hasImageUpload"
          ref="imageUploadRef"
          :images="images"
          :is-expanded="isExpanded"
          :hovered-index="hoveredIndex"
          :preview-mode="isPreviewMode && !isFocused"
          :max-images="imageFieldConfig.maxImageLength"
          @add-image="addImage"
          @remove-image="removeImage"
          @mouse-enter="handleMouseEnter"
          @mouse-leave="handleMouseLeave"
          @card-hover="handleCardHover"
          @card-leave="handleCardLeave"
          @dragging-change="handleDraggingChange"
          @image-uploaded="handleImageUploaded"
          @upload-state-change="imageUploading = $event"
        />
        <div
          :class="[
            'flex-1 py-2 transition-all duration-300',
            isPreviewMode && !isFocused ? 'h-10 max-h-20' : 'h-32 max-h-48',
          ]"
        >
          <textarea
            ref="textareaRef"
            v-model="prompt"
            placeholder="描述想要生成的图片"
            class="h-full w-full resize-none border-none bg-transparent text-lg text-slate-900 placeholder-slate-500 outline-none focus:ring-0"
            :class="[isPreviewMode && !isFocused ? 'overflow-hidden' : '']"
            @paste="handlePaste"
            @focus="onFocus"
            @blur="handleBlur"
            @keydown="handleKeydown"
          ></textarea>
        </div>

        <button
          v-if="isPreviewMode && !isFocused"
          :disabled="isLoading || !prompt.trim()"
          class="flex size-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-900"
          @click="handleSubmit()"
        >
          <svg
            v-if="isLoading"
            xmlns="http://www.w3.org/2000/svg"
            class="size-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>
      <GeneratorToolbar
        v-show="!isPreviewMode || isFocused"
        :disabled="isLoading || !prompt.trim()"
        :loading="isLoading"
        :current-type="currentType"
        :model-options="modelOptions"
        :current-model-value="currentModelValue"
        :ratio-options="ratioOptions"
        :current-ratio="currentRatio"
        :resolution-options="resolutionOptions"
        :current-res="currentRes"
        :has-dimension="hasDimension"
        :custom-width="customWidth"
        :custom-height="customHeight"
        :show-dimension="showDimension"
        :n-options="nOptions"
        :current-n="currentN"
        :custom-parameter-fields="customParameterFields"
        :field-values="fieldValues"
        @submit="handleSubmit()"
        @insert-quotes="insertQuotes"
        @select-type="selectType"
        @select-model="selectModel"
        @select-ratio="selectRatio"
        @select-resolution="selectResolution"
        @update-width="updateWidth"
        @update-height="updateHeight"
        @select-n="selectN"
        @select-custom-field="selectCustomField"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useImageStack } from "../composables/useImageStack";
import { usePromptEditor } from "../composables/usePromptEditor";
import { useGeneratorConfig } from "../composables/useGeneratorConfig";
import ImageUploadPreview from "./ImageUploadPreview.vue";
import GeneratorToolbar from "./GeneratorToolbar.vue";

const props = defineProps<{
  previewMode?: boolean;
}>();

const loading = defineModel<boolean>("loading", { default: false });
const imageUploading = ref(false);
const isLoading = computed(() => loading.value || imageUploading.value);

const emit = defineEmits<{
  (e: "generate", prompt: string, refs: string[], config: any): void;
  (e: "focus"): void;
  (e: "dragging", v: boolean): void;
}>();

const isPreviewMode = computed(() => props.previewMode ?? false);
const hasImageUpload = ref(false);
const imageUploadRef = ref<InstanceType<typeof ImageUploadPreview> | null>(null);

const {
  currentType,
  selectType,
  modelOptions,
  currentModelValue,
  selectModel,
  ratioOptions,
  resolutionOptions,
  hasDimension,
  showDimension,
  currentRatio,
  currentRes,
  customWidth,
  customHeight,
  selectRatio,
  selectResolution,
  updateWidth,
  updateHeight,
  nOptions,
  currentN,
  selectN,
  customParameterFields,
  fieldValues,
  selectCustomField,
  hasImageAbility,
  imageFieldConfig,
  getConfig,
  setConfig,
} = useGeneratorConfig();

watch(
  hasImageAbility,
  (val) => {
    hasImageUpload.value = val;
  },
  { immediate: true },
);

const {
  images,
  isExpanded,
  hoveredIndex,
  addImage,
  removeImage,
  updateImageUrl,
  clearImages,
  handleMouseEnter,
  handleMouseLeave,
  handleCardHover,
  handleCardLeave,
  setDragging,
} = useImageStack();

const { prompt, isFocused, handleBlur, insertQuotes, setPrompt, createKeydownHandler } = usePromptEditor();

function handleImageUploaded(localUrl: string, remoteUrl: string) {
  const img = images.value.find((i) => i.url === localUrl);
  if (img) {
    updateImageUrl(img.id, remoteUrl);
  }
}

async function handlePaste(event: ClipboardEvent) {
  if (!hasImageUpload.value || !imageUploadRef.value) return;
  const items = event.clipboardData?.items;
  if (!items) return;
  const imageFiles: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    if (item.type.indexOf("image") !== -1) {
      event.preventDefault();
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }
  if (imageFiles.length > 0) {
    await imageUploadRef.value.processFiles(imageFiles);
  }
}

async function handleSubmit() {
  if (!prompt.value.trim() || isLoading.value) return;
  const finalConfig = getConfig();
  const referenceImages = images.value.map((img) => img.url);
  const currentPrompt = prompt.value;
  prompt.value = "";
  emit("generate", currentPrompt, referenceImages, finalConfig);
}

const handleKeydown = createKeydownHandler(handleSubmit);

function handleDraggingChange(isDragging: boolean) {
  setDragging(isDragging);
  emit("dragging", isDragging);
}

function onFocus() {
  isFocused.value = true;
  emit("focus");
}

function addReferenceImages(imageUrls: string[]) {
  imageUrls.forEach((url) => addImage(url));
}
function setReferenceImages(imageUrls: string[]) {
  clearImages();
  imageUrls.forEach((url) => addImage(url));
}

defineExpose({
  setPrompt,
  addReferenceImages,
  setReferenceImages,
  isFocused,
  setConfig,
});
</script>
