import type { ApiMetadata } from '@core/contracts/api.types';
import type { AuthStrategyMetadata } from '@core/contracts/auth.types';
import type { FieldDefinition } from '@core/contracts/field-definition';

/**
 * MCP 工具定义
 * 参考 Model Context Protocol 规范
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * 将 FieldDefinition 转换为 MCP JSON Schema
 */
function fieldToMCPProperty(field: FieldDefinition): any {
  const property: any = {
    type: field.type,
    description: field.description,
  };

  if (field.enumValues) {
    property.enum = field.enumValues.map(v => v.value);
  }

  if (field.defaultValue !== undefined) {
    property.default = field.defaultValue;
  }

  if (field.type === 'number') {
    if (field.minValue !== undefined) property.minimum = field.minValue;
    if (field.maxValue !== undefined) property.maximum = field.maxValue;
  }

  if (field.type === 'string') {
    if (field.minLength !== undefined) property.minLength = field.minLength;
    if (field.maxLength !== undefined) property.maxLength = field.maxLength;
    if (field.pattern !== undefined) property.pattern = field.pattern;
  }

  if (field.type === 'object' && field.fields) {
    property.properties = {};
    field.fields.forEach(subField => {
      property.properties[subField.name] = fieldToMCPProperty(subField);
    });
  }

  if (field.type === 'array' && field.fields && field.fields.length > 0) {
    property.items = fieldToMCPProperty(field.fields[0]);
  }

  return property;
}

/**
 * 将 API 元数据转换为 MCP 工具定义
 */
export function apiToMCPTool(apiMetadata: ApiMetadata): MCPTool {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  // 添加认证配置 ID
  properties['authProfileId'] = {
    type: 'string',
    description: '认证配置 ID',
  };
  required.push('authProfileId');

  // 转换输入字段
  apiMetadata.inputSchema.fields.forEach(field => {
    properties[field.name] = fieldToMCPProperty(field);
    if (field.required) {
      required.push(field.name);
    }
  });

  return {
    name: apiMetadata.id.replace(/\./g, '_'),
    description: apiMetadata.description || apiMetadata.name,
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}

/**
 * 将认证策略转换为 MCP 工具定义（用于创建认证配置）
 */
export function authStrategyToMCPTool(authMetadata: AuthStrategyMetadata): MCPTool {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  // 添加名称字段
  properties['name'] = {
    type: 'string',
    description: '认证配置名称',
  };
  required.push('name');

  // 转换认证字段
  authMetadata.authSchema.fields.forEach(field => {
    properties[field.name] = fieldToMCPProperty(field);
    if (field.required) {
      required.push(field.name);
    }
  });

  return {
    name: `create_${authMetadata.platformId}_${authMetadata.id}_profile`.replace(/\./g, '_'),
    description: `创建 ${authMetadata.name} 认证配置`,
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}

/**
 * 批量转换 API 为 MCP 工具
 */
export function apisToMCPTools(apis: ApiMetadata[]): MCPTool[] {
  return apis.map(apiToMCPTool);
}
