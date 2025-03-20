/**
 * @name DefaultBurstEmojis
 * @author gassastsina
 * @description Set shortcut emojis and emojis picker has burst by default.
 * @version 1.0.0
 * @authorId 292388871381975040
 * @source https://github.com/vincent-andrieu/default-burst-emojis
 * @updateUrl https://raw.githubusercontent.com/vincent-andrieu/default-burst-emojis/refs/heads/main/build/default-burst-emojis.plugin.js
 */
'use strict';

const name = "DefaultBurtEmojis";
const SETTING_BURST_SHORTCUT_REACTIONS = "burstShortcutReactions";
const SETTING_BURST_EMOJIS_PICKER = "burstEmojisPicker";
const config = {
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
function getSetting(id, settingsList = config.settings) {
    for (const setting of settingsList) {
        if (setting.type === "category") {
            const result = getSetting(id, setting.settings);
            if (result !== undefined) {
                return result;
            }
        }
        else if (setting.id === id) {
            return setting.value;
        }
    }
    return undefined;
}

const LOG_PREFIX = `[${config.name}]`;
var DiscordPickerIntention;
(function (DiscordPickerIntention) {
    DiscordPickerIntention[DiscordPickerIntention["REACTION"] = 0] = "REACTION";
    DiscordPickerIntention[DiscordPickerIntention["STATUS"] = 1] = "STATUS";
    DiscordPickerIntention[DiscordPickerIntention["COMMUNITY_CONTENT"] = 2] = "COMMUNITY_CONTENT";
    DiscordPickerIntention[DiscordPickerIntention["CHAT"] = 3] = "CHAT";
    DiscordPickerIntention[DiscordPickerIntention["GUILD_STICKER_RELATED_EMOJI"] = 4] = "GUILD_STICKER_RELATED_EMOJI";
    DiscordPickerIntention[DiscordPickerIntention["GUILD_ROLE_BENEFIT_EMOJI"] = 5] = "GUILD_ROLE_BENEFIT_EMOJI";
    DiscordPickerIntention[DiscordPickerIntention["SOUNDBOARD"] = 6] = "SOUNDBOARD";
    DiscordPickerIntention[DiscordPickerIntention["VOICE_CHANNEL_TOPIC"] = 7] = "VOICE_CHANNEL_TOPIC";
    DiscordPickerIntention[DiscordPickerIntention["GIFT"] = 8] = "GIFT";
    DiscordPickerIntention[DiscordPickerIntention["AUTO_SUGGESTION"] = 9] = "AUTO_SUGGESTION";
    DiscordPickerIntention[DiscordPickerIntention["POLLS"] = 10] = "POLLS";
    DiscordPickerIntention[DiscordPickerIntention["PROFILE"] = 11] = "PROFILE";
    DiscordPickerIntention[DiscordPickerIntention["MESSAGE_CONFETTI"] = 12] = "MESSAGE_CONFETTI";
    DiscordPickerIntention[DiscordPickerIntention["GUILD_PROFILE"] = 13] = "GUILD_PROFILE";
})(DiscordPickerIntention || (DiscordPickerIntention = {}));
var DiscordReactionType;
(function (DiscordReactionType) {
    DiscordReactionType[DiscordReactionType["NORMAL"] = 0] = "NORMAL";
    DiscordReactionType[DiscordReactionType["BURST"] = 1] = "BURST";
    DiscordReactionType[DiscordReactionType["VOTE"] = 2] = "VOTE";
})(DiscordReactionType || (DiscordReactionType = {}));
var DiscordPremiumType;
(function (DiscordPremiumType) {
    DiscordPremiumType[DiscordPremiumType["NONE"] = 0] = "NONE";
    DiscordPremiumType[DiscordPremiumType["TIER_1"] = 1] = "TIER_1";
    DiscordPremiumType[DiscordPremiumType["TIER_2"] = 2] = "TIER_2";
    DiscordPremiumType[DiscordPremiumType["TIER_3"] = 3] = "TIER_3";
})(DiscordPremiumType || (DiscordPremiumType = {}));

class DefaultBurstEmojis {
    _emojiPickerPatch = undefined;
    _shortcutReactionsPatch = undefined;
    start() {
        console.warn(LOG_PREFIX, "Started");
        const userStore = BdApi.Webpack.getStore("UserStore");
        const user = userStore?.getCurrentUser();
        if (!user) {
            return this._log("Fail to get current user");
        }
        if (user.premiumType != DiscordPremiumType.NONE) {
            this._burstEmojisPicker();
            this._burstShortcutReactions();
        }
        else {
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
                const getSettingItem = (id, settingsList = config.settings) => {
                    for (const setting of settingsList) {
                        if (setting.type === "category") {
                            const result = getSettingItem(id, setting.settings);
                            if (result !== undefined) {
                                return result;
                            }
                        }
                        else if (setting.id === id) {
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
                    }
                    else {
                        this._emojiPickerPatch?.();
                    }
                }
                else if (id === SETTING_BURST_SHORTCUT_REACTIONS) {
                    if (value) {
                        this._burstShortcutReactions();
                    }
                    else {
                        this._shortcutReactionsPatch?.();
                    }
                }
            }
        });
    }
    _log(message, type = "error") {
        const logMessage = `${LOG_PREFIX} ${message}`;
        BdApi.UI.showToast(logMessage, { type: type === "warn" ? "warning" : "error" });
        console[type](logMessage);
    }
    _burstEmojisPicker() {
        if (!getSetting(SETTING_BURST_EMOJIS_PICKER))
            return;
        const moduleFilter = BdApi.Webpack.Filters.byStrings("pickerIntention", "onBurstReactionToggle");
        const emojiPickerHeaderModule = BdApi.Webpack.getModule((module) => Object.values(module).some((subModule) => moduleFilter(subModule)), { defaultExport: false });
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
    _burstShortcutReactions() {
        if (!getSetting(SETTING_BURST_SHORTCUT_REACTIONS))
            return;
        const moduleFilter = BdApi.Webpack.Filters.byStrings("MESSAGE_REACTION_ADD", "burst", "Message Shortcut");
        const shortcutReactionsModule = BdApi.Webpack.getModule((module) => Object.values(module).some((subModule) => moduleFilter(subModule)));
        const key = shortcutReactionsModule
            ? Object.keys(shortcutReactionsModule).find((key) => moduleFilter(shortcutReactionsModule[key]))
            : undefined;
        if (!key) {
            return this._log("Fail to burst shortcut reaction");
        }
        this._shortcutReactionsPatch = BdApi.Patcher.before(config.name, shortcutReactionsModule, key, (_, [_channelId, _messageId, _emoji, location, options]) => {
            if (!options.burst && location === "Message Hover Bar") {
                options.burst = true;
            }
        });
    }
}

module.exports = DefaultBurstEmojis;
