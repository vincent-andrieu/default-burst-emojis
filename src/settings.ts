import { SettingConfigElement } from "./types/settings";

const name = "DefaultBurtEmojis";

export const SETTING_BURST_SHORTCUT_REACTIONS = "burstShortcutReactions";
export const SETTING_BURST_EMOJIS_PICKER = "burstEmojisPicker";

export const config: {
    name: string;
    settings: Array<SettingConfigElement>;
} = {
    name,
    settings: [
        {
            type: "switch",
            id: SETTING_BURST_EMOJIS_PICKER,
            name: "Burst emojis picker",
            value: BdApi.Data.load(name, SETTING_BURST_EMOJIS_PICKER) ?? true,
            defaultValue: true,
            note: "Burst emojis when opening the emojis picker"
        },
        {
            type: "switch",
            id: SETTING_BURST_SHORTCUT_REACTIONS,
            name: "Burst shortcut reactions",
            value: BdApi.Data.load(name, SETTING_BURST_SHORTCUT_REACTIONS) ?? true,
            defaultValue: true,
            note: "Burst emojis when hovering a message"
        }
    ]
};

export function getSetting<T>(id: string, settingsList: Array<SettingConfigElement> = config.settings): T | undefined {
    for (const setting of settingsList) {
        if (setting.type === "category") {
            const result = getSetting<T>(id, setting.settings);

            if (result !== undefined) {
                return result;
            }
        } else if (setting.id === id) {
            return setting.value as T;
        }
    }
    return undefined;
}
