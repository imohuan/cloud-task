import { MultiServerMCPClient } from "@langchain/mcp-adapters";

export async function createLoadMcpTool() {
    const client = new MultiServerMCPClient({
        "fetch-service": {
            "transport": "stdio",
            "command": "bunx",
            "args": ["mcp-fetch-server"]
        }
    })

    return await client.getTools();
}