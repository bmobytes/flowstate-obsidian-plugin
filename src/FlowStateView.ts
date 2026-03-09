import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import type FlowStatePlugin from "./main";
import type { FlowStateTask, SectionKey } from "./types";
import { SECTIONS } from "./types";

export const VIEW_TYPE = "flowstate-tasks-view";

export class FlowStateView extends ItemView {
	private plugin: FlowStatePlugin;
	private refreshTimer: number | null = null;
	private collapsedSections: Record<string, boolean> = {};
	private containerEl_content: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: FlowStatePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return "FlowState";
	}

	getIcon(): string {
		return "check-circle";
	}

	async onOpen(): Promise<void> {
		this.loadCollapsedState();
		this.render();
		this.startAutoRefresh();
	}

	async onClose(): Promise<void> {
		this.stopAutoRefresh();
	}

	private startAutoRefresh(): void {
		this.stopAutoRefresh();
		const interval = this.plugin.settings.refreshInterval * 1000;
		if (interval > 0) {
			this.refreshTimer = window.setInterval(() => {
				this.refreshData();
			}, interval);
			this.registerInterval(this.refreshTimer);
		}
	}

	private stopAutoRefresh(): void {
		if (this.refreshTimer !== null) {
			window.clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	private loadCollapsedState(): void {
		try {
			const saved = localStorage.getItem("flowstate-collapsed");
			if (saved) {
				this.collapsedSections = JSON.parse(saved);
			}
		} catch {
			this.collapsedSections = {};
		}
	}

	private saveCollapsedState(): void {
		localStorage.setItem("flowstate-collapsed", JSON.stringify(this.collapsedSections));
	}

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("flowstate-container");

		if (!this.plugin.settings.apiKey) {
			this.renderSetupPrompt(container);
			return;
		}

		this.renderHeader(container);
		this.containerEl_content = container.createDiv({ cls: "flowstate-content" });
		this.renderLoading(this.containerEl_content);
		this.refreshData();
	}

	private renderSetupPrompt(container: HTMLElement): void {
		const prompt = container.createDiv({ cls: "flowstate-setup" });
		prompt.createEl("h3", { text: "Welcome to FlowState" });
		prompt.createEl("p", {
			text: "Configure your API URL and key in settings to get started.",
			cls: "flowstate-setup-text",
		});
		const btn = prompt.createEl("button", {
			text: "Open Settings",
			cls: "mod-cta",
		});
		btn.addEventListener("click", () => {
			// @ts-expect-error — Obsidian internal API
			this.app.setting.open();
			// @ts-expect-error — Obsidian internal API
			this.app.setting.openTabById("flowstate-tasks");
		});
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: "flowstate-header" });

		// Quick-add row
		const addRow = header.createDiv({ cls: "flowstate-add-row" });
		const input = addRow.createEl("input", {
			type: "text",
			placeholder: "Add a task…",
			cls: "flowstate-add-input",
		});
		const addBtn = addRow.createEl("button", {
			text: "Add",
			cls: "flowstate-add-btn",
		});

		const submitTask = async () => {
			const text = input.value.trim();
			if (!text) return;
			try {
				await this.plugin.api.createTask(text);
				input.value = "";
				new Notice("Task added");
				this.refreshData();
			} catch {
				new Notice("Failed to add task");
			}
		};

		addBtn.addEventListener("click", submitTask);
		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") submitTask();
		});

		// Action buttons row
		const actions = header.createDiv({ cls: "flowstate-actions" });

		const refreshBtn = actions.createEl("button", {
			cls: "flowstate-icon-btn clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.addEventListener("click", () => this.refreshData());

		const openBtn = actions.createEl("button", {
			cls: "flowstate-icon-btn clickable-icon",
			attr: { "aria-label": "Open FlowState in browser" },
		});
		setIcon(openBtn, "external-link");
		openBtn.addEventListener("click", () => {
			window.open(this.plugin.settings.apiUrl, "_blank");
		});
	}

	async refreshData(): Promise<void> {
		if (!this.containerEl_content) return;

		try {
			const data = await this.plugin.api.getContext();
			this.containerEl_content.empty();

			let hasAnyTasks = false;
			for (const section of SECTIONS) {
				const tasks = data[section.key];
				if (tasks.length > 0) hasAnyTasks = true;
				this.renderSection(this.containerEl_content, section.key, section.label, tasks, section.limit);
			}

			if (!hasAnyTasks) {
				this.containerEl_content.createDiv({
					cls: "flowstate-empty",
					text: "No tasks — you're all clear!",
				});
			}
		} catch (e) {
			this.containerEl_content.empty();
			this.renderError(this.containerEl_content, e);
		}
	}

	private renderLoading(container: HTMLElement): void {
		container.createDiv({ cls: "flowstate-loading", text: "Loading tasks…" });
	}

	private renderError(container: HTMLElement, error: unknown): void {
		const el = container.createDiv({ cls: "flowstate-error" });
		const msg = error instanceof Error ? error.message : "Connection failed";
		el.createEl("p", { text: `Error: ${msg}` });
		const retryBtn = el.createEl("button", { text: "Retry", cls: "mod-cta" });
		retryBtn.addEventListener("click", () => this.refreshData());
	}

	private renderSection(
		container: HTMLElement,
		key: SectionKey,
		label: string,
		tasks: FlowStateTask[],
		limit?: number
	): void {
		if (tasks.length === 0) return;

		const section = container.createDiv({ cls: "flowstate-section" });
		const isCollapsed = this.collapsedSections[key] ?? false;

		// Section header
		const headerEl = section.createDiv({ cls: "flowstate-section-header" });
		const chevron = headerEl.createSpan({ cls: "flowstate-chevron" });
		setIcon(chevron, isCollapsed ? "chevron-right" : "chevron-down");

		const totalCount = tasks.length;
		const displayLimit = limit && limit < totalCount ? limit : undefined;
		const countText = displayLimit ? `${displayLimit} of ${totalCount}` : `${totalCount}`;

		headerEl.createSpan({
			text: `${label.toUpperCase()} (${countText})`,
			cls: "flowstate-section-title",
		});

		headerEl.addEventListener("click", () => {
			this.collapsedSections[key] = !this.collapsedSections[key];
			this.saveCollapsedState();
			this.refreshData();
		});

		// Task list
		if (!isCollapsed) {
			const list = section.createDiv({ cls: "flowstate-task-list" });
			const visibleTasks = displayLimit ? tasks.slice(0, displayLimit) : tasks;
			for (const task of visibleTasks) {
				this.renderTask(list, task);
			}
		}
	}

	private renderTask(container: HTMLElement, task: FlowStateTask): void {
		const row = container.createDiv({ cls: "flowstate-task" });

		// Checkbox
		const checkbox = row.createEl("input", {
			type: "checkbox",
			cls: "task-list-item-checkbox flowstate-checkbox",
		});
		checkbox.addEventListener("click", async (e) => {
			e.preventDefault();
			row.addClass("flowstate-task-completing");
			try {
				await this.plugin.api.completeTask(task.id);
				row.remove();
				new Notice("Task completed");
				this.refreshData();
			} catch {
				row.removeClass("flowstate-task-completing");
				new Notice("Failed to complete task");
			}
		});

		// Task body
		const body = row.createDiv({ cls: "flowstate-task-body" });

		// First line: text + importance
		const textLine = body.createDiv({ cls: "flowstate-task-text" });
		textLine.createSpan({ text: task.text });
		if (task.is_important) {
			textLine.createSpan({ text: " ⭐", cls: "flowstate-important" });
		}

		// Meta line
		const meta = body.createDiv({ cls: "flowstate-task-meta" });

		if (task.category) {
			meta.createSpan({
				text: task.category,
				cls: "flowstate-category",
			});
		}

		if (task.priority >= 3) {
			const priorityLabel = task.priority === 4 ? "Urgent" : "High";
			meta.createSpan({
				text: priorityLabel,
				cls: `flowstate-priority flowstate-priority-${task.priority}`,
			});
		}

		if (task.energy_level) {
			const icons: Record<string, string> = {
				low: "🔋",
				medium: "⚡",
				high: "🔥",
			};
			const icon = icons[task.energy_level] || "";
			if (icon) {
				meta.createSpan({ text: icon, cls: "flowstate-energy" });
			}
		}

		if (task.deadline) {
			const deadlineDate = new Date(task.deadline);
			const now = new Date();
			now.setHours(0, 0, 0, 0);
			const isOverdue = deadlineDate < now;
			const formatted = deadlineDate.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			});
			meta.createSpan({
				text: `${isOverdue ? "⚠️ " : ""}Due ${formatted}`,
				cls: `flowstate-deadline ${isOverdue ? "flowstate-overdue" : ""}`,
			});
		}
	}
}
