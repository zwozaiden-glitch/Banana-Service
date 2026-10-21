import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getGuildSettings } from '../../database/db.js';
import { createBananaEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and publish a custom styled embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to post embed in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Embed description').setRequired(true))
    .addStringOption(opt => opt.setName('color').setDescription('Hex color code (e.g. #FFE135)'))
    .addStringOption(opt => opt.setName('image').setDescription('Image URL'))
    .addStringOption(opt => opt.setName('thumbnail').setDescription('Thumbnail URL'))
    .addStringOption(opt => opt.setName('footer').setDescription('Custom footer text')),

  async execute(interaction) {
    const guildSettings = getGuildSettings(interaction.guild?.id);
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description').replace(/\\n/g, '\n');
    const color = interaction.options.getString('color');
    const image = interaction.options.getString('image');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer');

    try {
      const embed = createBananaEmbed(guildSettings, {
        title,
        description,
        color: color || undefined,
        image: image || undefined,
        thumbnail: thumbnail || undefined,
        footerText: footer || undefined,
      });

      await channel.send({ embeds: [embed] });

      return interaction.reply({
        embeds: [createSuccessEmbed(guildSettings, 'Embed Published', `Embed sent to <#${channel.id}>!`)],
        ephemeral: true,
      });
    } catch (err) {
      return interaction.reply({
        embeds: [createErrorEmbed(guildSettings, 'Embed Error', err.message)],
        ephemeral: true,
      });
    }
  },
};
