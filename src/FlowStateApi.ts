import { requestUrl } from "obsidian";
import type { AgentContext } from "./types";
import type { FlowStateSettings } from "./settings";

export class FlowStateApi {
	constructor(private settings: FlowStateSettings) {}

	private get headers(): Record<string, string> {
		return {
			"X-API-Key": this.settings.apiKey,
			"Content-Type": "application/json",
		};
	}

	private url(path: string): string {
		return `${this.settings.apiUrl.replace(/\/+$/, "")}${path}`;
	}

	async getContext(): Promise<AgentContext> {
		const response = await requestUrl({
			url: this.url("/agent/context"),
			headers: this.headers,
		});
		return response.json;
	}

	async createTask(text: string): Promise<void> {
		await requestUrl({
			url: this.url("/tasks"),
			method: "POST",
			headers: this.headers,
			body: JSON.stringify({ text }),
		});
	}

	async completeTask(id: number): Promise<void> {
		await requestUrl({
			url: this.url(`/tasks/${id}/complete`),
			method: "PATCH",
			headers: this.headers,
		});
	}
}
