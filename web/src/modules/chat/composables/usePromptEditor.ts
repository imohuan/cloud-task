import { ref, nextTick } from "vue";

export function usePromptEditor() {
  const prompt = ref("");
  const isFocused = ref(false);
  const textareaRef = ref<HTMLTextAreaElement | null>(null);

  function handleFocus() {
    isFocused.value = true;
  }
  function handleBlur() {
    isFocused.value = false;
  }

  function insertQuotes() {
    const textarea = textareaRef.value;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = prompt.value;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    prompt.value = before + '""' + selected + after;
    nextTick(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1);
    });
  }

  function setPrompt(newPrompt: string) {
    prompt.value = newPrompt;
    nextTick(() => textareaRef.value?.focus());
  }

  function createKeydownHandler(onSubmit?: () => void) {
    return (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (!prompt.value.trim()) return;
        onSubmit?.();
      }
    };
  }

  return {
    prompt,
    isFocused,
    textareaRef,
    handleFocus,
    handleBlur,
    insertQuotes,
    setPrompt,
    createKeydownHandler,
  };
}
