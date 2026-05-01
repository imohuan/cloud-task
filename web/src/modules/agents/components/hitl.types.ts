export type HITLDecision = "approve" | "reject" | "edit" | "respond";

export interface ActionRequest {
  action: string;
  description?: string;
  args: Record<string, any>;
}

export interface ReviewConfig {
  allowedDecisions: HITLDecision[];
}

export interface HITLRequest {
  actionRequests: ActionRequest[];
  reviewConfigs: ReviewConfig[];
}

export type HITLResponse =
  | { decision: "approve" }
  | { decision: "reject"; reason?: string }
  | { decision: "edit"; args: Record<string, any> }
  | { decision: "respond"; message: string };
