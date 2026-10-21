import { getDatabase, getGuildSettings } from '../database/db.js';
import { logAuditAction } from '../utils/auditLogger.js';
import { BananaPermissions } from '../utils/permissions.js';

export class ModerationService {
  /**
   * Warn a member
   */
  static async warnMember(client, guild, targetUser, moderatorMember, reason) {
    const db = getDatabase();
    const insert = db.prepare(`
      INSERT INTO moderation_warnings (guild_id, user_id, moderator_id, reason)
      VALUES (?, ?, ?, ?)
    `);

    insert.run(guild.id, targetUser.id, moderatorMember.id, reason);

    await logAuditAction(client, guild.id, {
      userId: moderatorMember.id,
      action: 'MEMBER_WARNED',
      targetType: 'User',
      targetId: targetUser.id,
      details: reason,
    });

    const totalWarnings = db.prepare(`
      SELECT COUNT(*) as c FROM moderation_warnings WHERE guild_id = ? AND user_id = ?
    `).get(guild.id, targetUser.id).c;

    return { totalWarnings, reason };
  }

  /**
   * Get warnings for a member
   */
  static getWarnings(guildId, userId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM moderation_warnings
      WHERE guild_id = ? AND user_id = ?
      ORDER BY id DESC
    `).all(guildId, userId);
  }

  /**
   * Timeout a member
   */
  static async timeoutMember(client, member, moderatorMember, durationMs, reason) {
    if (!BananaPermissions.canBotModerate(member)) {
      throw new Error('Bot does not have sufficient role hierarchy to timeout this user.');
    }
    if (!BananaPermissions.canMemberModerate(moderatorMember, member)) {
      throw new Error('You cannot timeout a user with a role equal to or higher than your own.');
    }

    await member.timeout(durationMs, `${moderatorMember.user.tag}: ${reason}`);

    await logAuditAction(client, member.guild.id, {
      userId: moderatorMember.id,
      action: 'MEMBER_TIMEOUT',
      targetType: 'User',
      targetId: member.id,
      details: { durationMinutes: Math.round(durationMs / 60000), reason },
    });
  }

  /**
   * Kick a member
   */
  static async kickMember(client, member, moderatorMember, reason) {
    if (!BananaPermissions.canBotModerate(member)) {
      throw new Error('Bot does not have sufficient role hierarchy to kick this user.');
    }
    if (!BananaPermissions.canMemberModerate(moderatorMember, member)) {
      throw new Error('You cannot kick a user with a role equal to or higher than your own.');
    }

    await member.kick(`${moderatorMember.user.tag}: ${reason}`);

    await logAuditAction(client, member.guild.id, {
      userId: moderatorMember.id,
      action: 'MEMBER_KICKED',
      targetType: 'User',
      targetId: member.id,
      details: reason,
    });
  }

  /**
   * Ban a member
   */
  static async banMember(client, guild, targetUser, moderatorMember, deleteMessageSeconds = 0, reason = 'No reason provided') {
    const targetMember = guild.members.cache.get(targetUser.id);
    if (targetMember) {
      if (!BananaPermissions.canBotModerate(targetMember)) {
        throw new Error('Bot does not have sufficient role hierarchy to ban this user.');
      }
      if (!BananaPermissions.canMemberModerate(moderatorMember, targetMember)) {
        throw new Error('You cannot ban a user with a role equal to or higher than your own.');
      }
    }

    await guild.bans.create(targetUser.id, {
      deleteMessageSeconds,
      reason: `${moderatorMember.user.tag}: ${reason}`,
    });

    await logAuditAction(client, guild.id, {
      userId: moderatorMember.id,
      action: 'MEMBER_BANNED',
      targetType: 'User',
      targetId: targetUser.id,
      details: reason,
    });
  }

  /**
   * Purge messages
   */
  static async purgeMessages(channel, moderatorMember, amount, filterUser = null) {
    const fetchLimit = Math.min(amount * 2, 100);
    const messages = await channel.messages.fetch({ limit: fetchLimit });

    let toDelete = Array.from(messages.values());
    if (filterUser) {
      toDelete = toDelete.filter(m => m.author.id === filterUser.id);
    }
    toDelete = toDelete.slice(0, amount);

    const deleted = await channel.bulkDelete(toDelete, true);

    await logAuditAction(moderatorMember.client, channel.guild.id, {
      userId: moderatorMember.id,
      action: 'MESSAGES_PURGED',
      targetType: 'Channel',
      targetId: channel.id,
      details: `Purged ${deleted.size} messages${filterUser ? ` from user ${filterUser.tag}` : ''}.`,
    });

    return deleted.size;
  }
}
