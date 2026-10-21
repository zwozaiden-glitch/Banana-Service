import { PermissionFlagsBits } from 'discord.js';

export const BananaPermissions = {
  // Check if member is Administrator or Guild Owner
  isAdmin(member) {
    if (!member) return false;
    if (member.id === member.guild?.ownerId) return true;
    return member.permissions?.has(PermissionFlagsBits.Administrator) ?? false;
  },

  // Check if member has staff privileges (Admin, ManageGuild, or designated staff role)
  isStaff(member, guildSettings = null) {
    if (!member) return false;
    if (this.isAdmin(member)) return true;
    if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;

    if (guildSettings?.staff_role_id) {
      if (member.roles?.cache?.has(guildSettings.staff_role_id)) return true;
    }
    return false;
  },

  // Check if member can manage scripts (upload, update, delete, setscript)
  canManageScripts(member, guildSettings = null) {
    if (!member) return false;
    if (this.isAdmin(member)) return true;
    if (this.isStaff(member, guildSettings)) return true;

    if (guildSettings?.script_roles) {
      try {
        const roles = JSON.parse(guildSettings.script_roles);
        if (Array.isArray(roles) && roles.some(roleId => member.roles?.cache?.has(roleId))) {
          return true;
        }
      } catch {
        // fallback
      }
    }
    return false;
  },

  // Check if member can download or view a private script
  canAccessScript(member, script, guildSettings = null) {
    if (!member) return false;
    if (!script.is_private) return true;
    if (this.canManageScripts(member, guildSettings)) return true;
    if (script.uploader_id === member.id) return true;

    if (script.access_role_id && member.roles?.cache?.has(script.access_role_id)) {
      return true;
    }
    return false;
  },

  // Check if member can manage tickets
  isTicketStaff(member, category = null, guildSettings = null) {
    if (!member) return false;
    if (this.isAdmin(member) || this.isStaff(member, guildSettings)) return true;

    if (category?.support_role_id && member.roles?.cache?.has(category.support_role_id)) {
      return true;
    }
    return false;
  },

  // Role hierarchy checks
  canBotManageRole(guild, role) {
    const botMember = guild.members.me;
    if (!botMember) return false;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) return false;
    return botMember.roles.highest.position > role.position && !role.managed;
  },

  canMemberModerate(moderatorMember, targetMember) {
    if (moderatorMember.id === targetMember.guild.ownerId) return true;
    if (targetMember.id === targetMember.guild.ownerId) return false;
    return moderatorMember.roles.highest.position > targetMember.roles.highest.position;
  },

  canBotModerate(targetMember) {
    const botMember = targetMember.guild.members.me;
    if (!botMember) return false;
    if (targetMember.id === targetMember.guild.ownerId) return false;
    return botMember.roles.highest.position > targetMember.roles.highest.position;
  }
};
