import { DiscordPickerIntention, DiscordPremiumType, LOG_PREFIX } from "./constants";
import { config, getSetting, SETTING_BURST_EMOJIS_PICKER, SETTING_BURST_SHORTCUT_REACTIONS } from "./settings";
import { LogLevel, SettingConfigElement, SettingItem, UserStore } from "./types";

export default class BDiscordAI {
    private _emojiPickerPatch: ReturnType<typeof BdApi.Patcher.before> | undefined = undefined;
    private _shortcutReactionsPatch: ReturnType<typeof BdApi.Patcher.before> | undefined = undefined;

    start() {
        console.warn(LOG_PREFIX, "Started");
        const userStore = BdApi.Webpack.getStore<UserStore>("UserStore");
        const user = userStore?.getCurrentUser();

        if (!user) {
            return this._log("Fail to get current user");
        }
        if (user.premiumType != DiscordPremiumType.NONE) {
            this._burstEmojisPicker();
            this._burstShortcutReactions();
        } else {
            this._log("This plugin only works for Nitro users", "warn");
            BdApi.Plugins.disable(config.name);
        }
    }

    stop() {
        BdApi.Patcher.unpatchAll(config.name);
        this._emojiPickerPatch = undefined;
        this._shortcutReactionsPatch = undefined;
        console.warn(LOG_PREFIX, "Stopped");
    }

    getSettingsPanel() {
        return BdApi.UI.buildSettingsPanel({
            settings: config.settings,
            onChange: (_category, id, value) => {
                const getSettingItem = (id: string, settingsList: Array<SettingConfigElement> = config.settings): SettingItem | undefined => {
                    for (const setting of settingsList) {
                        if (setting.type === "category") {
                            const result = getSettingItem(id, setting.settings);

                            if (result !== undefined) {
                                return result;
                            }
                        } else if (setting.id === id) {
                            return setting;
                        }
                    }
                    return undefined;
                };
                const setting = getSettingItem(id);

                if (setting) {
                    setting.value = value;
                }
                BdApi.Data.save(config.name, id, value);

                if (id === SETTING_BURST_EMOJIS_PICKER) {
                    if (value) {
                        this._burstEmojisPicker();
                    } else {
                        this._emojiPickerPatch?.();
                    }
                } else if (id === SETTING_BURST_SHORTCUT_REACTIONS) {
                    if (value) {
                        this._burstShortcutReactions();
                    } else {
                        this._shortcutReactionsPatch?.();
                    }
                }
            }
        });
    }

    private _log(message: string, type: LogLevel = "error"): void {
        const logMessage = `${LOG_PREFIX} ${message}`;

        BdApi.UI.showToast(logMessage, { type: type === "warn" ? "warning" : "error" });
        console[type](logMessage);
    }

    private _burstEmojisPicker() {
        if (!getSetting<boolean>(SETTING_BURST_EMOJIS_PICKER)) return;
        const moduleFilter = BdApi.Webpack.Filters.byStrings("pickerIntention", "onBurstReactionToggle");
        const emojiPickerHeaderModule = BdApi.Webpack.getModule<Record<string, unknown>>(
            (module) => Object.values(module).some((subModule) => moduleFilter(subModule)),
            { defaultExport: false }
        );
        const key = emojiPickerHeaderModule
            ? Object.keys(emojiPickerHeaderModule).find((key) => moduleFilter(emojiPickerHeaderModule[key]))
            : undefined;

        if (!key) {
            return this._log("Fail to burst emojis picker");
        }
        this._emojiPickerPatch = BdApi.Patcher.before(config.name, emojiPickerHeaderModule, key, (_, [props]) => {
            const [isFirstRender, setIsFirstRender] = BdApi.React.useState(true);

            if (props.pickerIntention === DiscordPickerIntention.REACTION && isFirstRender) {
                setTimeout(() => {
                    props.onBurstReactionToggle();
                }, 200);
                setIsFirstRender(false);
            }
        });
    }

    private _burstShortcutReactions() {
        if (!getSetting<boolean>(SETTING_BURST_SHORTCUT_REACTIONS)) return;
        const moduleFilter = BdApi.Webpack.Filters.byStrings("MESSAGE_REACTION_ADD", "burst", "Message Shortcut");
        const shortcutReactionsModule = BdApi.Webpack.getModule<Record<string, unknown>>((module) =>
            Object.values(module).some((subModule) => moduleFilter(subModule))
        );
        const key = shortcutReactionsModule
            ? Object.keys(shortcutReactionsModule).find((key) => moduleFilter(shortcutReactionsModule[key]))
            : undefined;

        if (!key) {
            return this._log("Fail to burst shortcut reaction");
        }
        this._shortcutReactionsPatch = BdApi.Patcher.before(
            config.name,
            shortcutReactionsModule,
            key,
            (_, [_channelId, _messageId, _emoji, location, options]) => {
                if (!options.burst && location === "Message Hover Bar") {
                    options.burst = true;
                }
            }
        );
    }
}
