/**
 * 字段定义协议
 * 用于描述输入、输出、认证字段，供前端渲染 UI 和未来转换为 MCP 工具
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'file';

export interface FieldDefinition {
  /** 字段名 */
  name: string;
  /** 字段类型 */
  type: FieldType;
  /** 是否必填 */
  required: boolean;
  /** 字段描述 */
  description?: string;
  /** 默认值 */
  defaultValue?: any;
  /** 枚举值（用于下拉选择） */
  enumValues?: Array<{ label: string; value: any }>;
  
  /** 最大图片数量限制（image-list 类型） */
  maxImageLength?: number;
  /** 是否仅允许本地上传图片，不接受外部 URL（image-list 类型） */
  localUploadOnly?: boolean;

  /** 最小值（number 类型） */
  minValue?: number;
  /** 最大值（number 类型） */
  maxValue?: number;
  /** 最小长度（string 类型） */
  minLength?: number;
  /** 最大长度（string 类型） */
  maxLength?: number;
  /** 正则校验（string 类型） */
  pattern?: string;
  /** 子字段定义（object 或 array 类型） */
  fields?: FieldDefinition[];
  /** 前端 UI 提示 */
  uiHint?: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'date' | 'datetime' | 'image-list';
  /** 该字段关联的能力项（供前端 GeneratorToolbar / 主面板渲染） */
  abilities?: AbilityItem[];
}

/**
 * 布局行配置
 */
export interface LayoutRow {
  /** 该行包含的字段名列表 */
  fields: string[];
  /** 自定义 CSS 类名 */
  className?: string;
}

/**
 * 字段布局配置
 */
export interface LayoutConfig {
  /** 快速模式：指定每行几列（1-12），会自动均分 */
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  /** 精确模式：自定义每行的字段排列 */
  rows?: LayoutRow[];
  /** 字段单独配置：覆盖全局设置 */
  fieldConfig?: Record<string, {
    /** 跨几列 */
    colSpan?: number;
    /** 自定义 CSS 类名 */
    className?: string;
  }>;
}

/**
 * 输入字段组
 */
export interface InputSchema {
  fields: FieldDefinition[];
  description?: string;
  /** 布局配置 */
  layout?: LayoutConfig;
}

/**
 * 输出字段组
 */
export interface OutputSchema {
  fields: FieldDefinition[];
  description?: string;
}

/**
 * 能力项（映射 UI 区域与字段）
 */
export interface AbilityItem {
  /** 对应 inputSchema.fields 中的字段名 */
  name: string;
  /** 分组名，同 group 的字段合并到同一个 Toolbar 组件 */
  group?: string;
}

/**
 * 能力配置
 * 描述前端 GeneratorToolbar + 主面板需要渲染哪些字段、如何分组
 */
export interface AbilityConfig {
  /** 能力项列表 */
  items: AbilityItem[];
}

/**
 * 认证字段组
 */
export interface AuthSchema {
  fields: FieldDefinition[];
  description?: string;
}
