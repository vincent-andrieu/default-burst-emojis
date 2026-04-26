import { DiscordPickerIntention, DiscordPremiumType, LOG_PREFIX } from "./constants";
import { config, getSetting, SETTING_BURST_EMOJIS_PICKER, SETTING_BURST_SHORTCUT_REACTIONS, SETTING_CHECK_UPDATES } from "./settings";
import { LogLevel, SettingConfigElement, SettingItem, UserStore } from "./types";
import { UpdateManager } from "./updates";

export default class DefaultBurstEmojis {
    private _emojiPickerPatch: ReturnType<typeof BdApi.Patcher.before> | undefined = undefined;
    private _shortcutReactionsPatch: ReturnType<typeof BdApi.Patcher.before> | undefined = undefined;

    private _updateManager?: UpdateManager;

    start() {
        console.warn(LOG_PREFIX, "Started");
        const userStore = BdApi.Webpack.getStore<UserStore>("UserStore");
        const user = userStore?.getCurrentUser();

        this._updateManager = new UpdateManager(this._log.bind(this));
        if (getSetting<boolean>(SETTING_CHECK_UPDATES)) {
            this._updateManager.ask();
        }

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
        this._updateManager?.cancel();
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

        BdApi.UI.showToast(logMessage, { type: type === "warn" ? "warning" : type });
        if (type !== "success") {
            console[type](logMessage);
        } else {
            console.log(logMessage);
        }
    }

    private _burstEmojisPicker() {
        if (!getSetting<boolean>(SETTING_BURST_EMOJIS_PICKER)) return;

        const renderFilter = (subModule: unknown): boolean => {
            const candidate = subModule as { render?: unknown; type?: { render?: unknown } } | undefined;
            const renderFn = candidate?.render ?? (candidate?.type as { render?: unknown } | undefined)?.render;

            if (typeof renderFn !== "function") return false;
            const source = renderFn.toString();
            return source.includes("pickerIntention") && source.includes("onBurstReactionToggle");
        };
        const emojiPickerModule = BdApi.Webpack.getModule<Record<string, unknown>>((module) => Object.values(module).some(renderFilter), {
            defaultExport: false
        });
        const exportKey = emojiPickerModule
            ? Object.keys(emojiPickerModule).find((moduleKey) => renderFilter(emojiPickerModule[moduleKey]))
            : undefined;

        if (!exportKey || !emojiPickerModule) {
            return this._log("Fail to burst emojis picker");
        }
        const wrapper = emojiPickerModule[exportKey] as { render?: unknown; type?: { render?: unknown } };
        const renderHost = (wrapper.render ? wrapper : wrapper.type) as Record<string, unknown>;

        this._emojiPickerPatch = BdApi.Patcher.after(config.name, renderHost, "render", (_, args, returnValue) => {
            const [props] = args as [{ pickerIntention?: number } | undefined];

            if (props?.pickerIntention !== DiscordPickerIntention.REACTION) return;
            const [isFirstRender, setIsFirstRender] = BdApi.React.useState(true);

            if (!isFirstRender) return;
            const toggle = this._findBurstReactionToggle(returnValue);

            if (toggle) {
                setTimeout(() => toggle(), 200);
                setIsFirstRender(false);
            }
        });
    }

    private _findBurstReactionToggle(element: unknown): (() => void) | undefined {
        if (!element || typeof element !== "object") return undefined;
        const node = element as {
            props?: { isBurstReaction?: boolean; onBurstReactionToggle?: () => void; children?: unknown };
        };

        if (node.props?.onBurstReactionToggle && node.props.isBurstReaction === false) {
            return node.props.onBurstReactionToggle;
        }
        const children = Array.isArray(element) ? element : node.props?.children;

        if (!children) return undefined;
        const childArray = Array.isArray(children) ? children : [children];

        for (const child of childArray) {
            const found = this._findBurstReactionToggle(child);

            if (found) {
                return found;
            }
        }
        return undefined;
    }

    private _burstShortcutReactions() {
        if (!getSetting<boolean>(SETTING_BURST_SHORTCUT_REACTIONS)) return;
        const addReactionPatch = this._patchAddReaction("Message Hover Bar", "Fail to burst shortcut reaction");

        if (addReactionPatch) {
            this._shortcutReactionsPatch = addReactionPatch;
        }
    }

    private _patchAddReaction(targetLocation: string, errorMessage: string): ReturnType<typeof BdApi.Patcher.before> | undefined {
        const moduleFilter = BdApi.Webpack.Filters.byStrings("MESSAGE_REACTION_ADD", "burst");
        const addReactionModule = BdApi.Webpack.getModule<Record<string, unknown>>((module) =>
            Object.values(module).some((subModule) => moduleFilter(subModule))
        );
        const key = addReactionModule ? Object.keys(addReactionModule).find((moduleKey) => moduleFilter(addReactionModule[moduleKey])) : undefined;

        if (!key) {
            this._log(errorMessage);
            return undefined;
        }
        return BdApi.Patcher.before(config.name, addReactionModule, key, (_, [_channelId, _messageId, _emoji, location, options]) => {
            if (location === targetLocation && options && !options.burst) {
                options.burst = true;
            }
        });
    }
}
