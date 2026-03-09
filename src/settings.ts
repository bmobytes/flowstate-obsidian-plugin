export interface FlowStateSettings {
	apiUrl: string;
	apiKey: string;
	refreshInterval: number;
}

export const DEFAULT_SETTINGS: FlowStateSettings = {
	apiUrl: "http://localhost:8000",
	apiKey: "",
	refreshInterval: 60,
};
