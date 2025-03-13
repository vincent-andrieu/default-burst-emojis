import { config } from "./settings";

export const LOG_PREFIX = `[${config.name}]`;

export enum DiscordPickerIntention {
    REACTION = 0,
    STATUS = 1,
    COMMUNITY_CONTENT = 2,
    CHAT = 3,
    GUILD_STICKER_RELATED_EMOJI = 4,
    GUILD_ROLE_BENEFIT_EMOJI = 5,
    SOUNDBOARD = 6,
    VOICE_CHANNEL_TOPIC = 7,
    GIFT = 8,
    AUTO_SUGGESTION = 9,
    POLLS = 10,
    PROFILE = 11,
    MESSAGE_CONFETTI = 12,
    GUILD_PROFILE = 13
}

export enum DiscordReactionType {
    NORMAL = 0,
    BURST = 1,
    VOTE = 2
}
