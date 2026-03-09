import { Plugin, PluginSettingTab, App, Setting, Notice } from "obsidian";
import { FlowStateView, VIEW_TYPE } from "./FlowStateView";
import { FlowStateApi } from "./FlowStateApi";
import { DEFAULT_SETTINGS, type FlowStateSettings } from "./settings";

export default class FlowStatePlugin extends Plugin {
	settings: FlowStateSettings = DEFAULT_SETTINGS;
	api: FlowStateApi = new FlowStateApi(this.settings);

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE, (leaf) => new FlowStateView(leaf, this));

		this.addRibbonIcon("check-circle", "Open FlowState", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-flowstate-panel",
			name: "Open FlowState panel",
			callback: () => this.activateView(),
		});

		this.addSettingTab(new FlowStateSettingTab(this.app, this));
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.api = new FlowStateApi(this.settings);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.api = new FlowStateApi(this.settings);
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}
}

class FlowStateSettingTab extends PluginSettingTab {
	plugin: FlowStatePlugin;

	constructor(app: App, plugin: FlowStatePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("FlowState API URL")
			.setDesc("Base URL of your FlowState server")
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:8000")
					.setValue(this.plugin.settings.apiUrl)
					.onChange(async (value) => {
						this.plugin.settings.apiUrl = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("Your FlowState API key")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("Enter API key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Auto-refresh interval")
			.setDesc("Seconds between automatic refreshes (0 to disable)")
			.addText((text) =>
				text
					.setPlaceholder("60")
					.setValue(String(this.plugin.settings.refreshInterval))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.refreshInterval = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Verify your API settings are correct")
			.addButton((btn) =>
				btn.setButtonText("Test").onClick(async () => {
					try {
						const data = await this.plugin.api.getContext();
						const total =
							data.in_progress.length +
							data.overdue.length +
							data.today.length +
							data.inbox.length;
						new Notice(`Connected! ${total} tasks found.`);
					} catch (e) {
						const msg = e instanceof Error ? e.message : "Unknown error";
						new Notice(`Connection failed: ${msg}`);
					}
				})
			);

		new Setting(containerEl)
			.setName("Open FlowState Web UI")
			.setDesc("Open the full web interface in your browser")
			.addButton((btn) =>
				btn.setButtonText("Open").onClick(() => {
					window.open(this.plugin.settings.apiUrl, "_blank");
				})
			);
	}
}
