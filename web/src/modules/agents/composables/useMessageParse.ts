import { ref } from "vue";
import { AIMessage } from "langchain";

export function useMessageParse(stream: any) {

    /**
     * 检查是否正在流式推理
     * @param msg 
     * @returns 是否正在流式推理 
     */
    function isStreamingReasoning(msg: AIMessage) {
        return (
            stream.isLoading.value &&
            stream.messages.value[stream.messages.value.length - 1]?.id === msg.id
        );
    }

    /**
     * 获取推理内容
     * @param msg 
     * @returns 推理内容 
     */
    const getReasoningContent = (msg: AIMessage) => {
        // Openai 的推理内容在 additional_kwargs 中
        const reasoning_content = msg.additional_kwargs?.reasoning_content
        // 其他模型的推理内容在 contentBlocks 中
        return reasoning_content ?? (
            msg.contentBlocks
                ?.filter(
                    (block) =>
                        block.type === "reasoning" &&
                        typeof block.reasoning === "string" &&
                        block.reasoning.trim().length > 0,
                )
                .map((block) => block.reasoning)
                .join("").trim() ?? "")
    }


    return {
        isStreamingReasoning,
        getReasoningContent
    }
}
