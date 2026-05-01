import { ref } from "vue";

const previewMessages = ref<any[] | null>(null);
const previewLabel = ref<string | null>(null);

export function usePreviewMessages() {
    function setPreview(messages: any[], label: string) {
        previewMessages.value = messages;
        previewLabel.value = label;
    }

    function clearPreview() {
        previewMessages.value = null;
        previewLabel.value = null;
    }

    return { previewMessages, previewLabel, setPreview, clearPreview };
}
