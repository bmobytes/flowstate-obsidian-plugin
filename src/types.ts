export interface FlowStateTask {
	id: number;
	text: string;
	state: string;
	priority: number;
	is_important: boolean;
	energy_level: string | null;
	category: string | null;
	deadline: string | null;
	tags: string[];
}

export interface AgentContext {
	in_progress: FlowStateTask[];
	overdue: FlowStateTask[];
	today: FlowStateTask[];
	inbox: FlowStateTask[];
	summary: Record<string, unknown>;
}

export type SectionKey = "in_progress" | "overdue" | "today" | "inbox";

export interface SectionConfig {
	key: SectionKey;
	label: string;
	limit?: number;
}

export const SECTIONS: SectionConfig[] = [
	{ key: "in_progress", label: "In Progress" },
	{ key: "overdue", label: "Overdue" },
	{ key: "today", label: "Today" },
	{ key: "inbox", label: "Inbox", limit: 14 },
];
