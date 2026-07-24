const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

console.log("==================================================");
console.log("VGP Balkan System starting...");
console.log("==================================================");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// CONFIGURATION - PASS DEINE CHANNEL- & ROLLEN-IDs HIER AN:
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : '',
   
    // Channels
    REGISTRATION_PANEL_CHANNEL_ID: 'DEINE_PANEL_KANAL_ID',      // Kanal für das Anmelde-Panel (#register-here)
    ADMIN_LOG_CHANNEL_ID: 'DEINE_ADMIN_KANAL_ID',               // Privater Admin-Kanal (#registration-requests)
    TICKET_CATEGORY_ID: 'DEINE_TICKET_KATEGORIE_ID',            // Kategorie für die Team-Tickets
   
    // Roles
    ADMIN_ROLE_NAME: 'Admin',                                  // Name der Admin-Rolle
    HEAD_ADMIN_ROLE_NAME: 'Head Admin',                        // Name der Head Admin-Rolle
    MANAGER_ROLE_NAME: 'Pro League'                            // Rolle, die der Manager nach Akzeptieren bekommt
};

// Express Webserver for Render Keep-Alive
const http = require('http');
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('VGP Balkan Bot is running online!\n');
}).listen(port, () => {
    console.log(`[WEBSERVER] Active on port ${port}`);
});

client.once('ready', async () => {
    console.log(`🎉 VGP Balkan Bot LOGGED IN as ${client.user.tag}`);

    // Post Registration Panel
    try {
        const regChannel = await client.channels.fetch(CONFIG.REGISTRATION_PANEL_CHANNEL_ID).catch(() => null);
        if (regChannel) {
            const messages = await regChannel.messages.fetch({ limit: 10 }).catch(() => null);
            const hasPanel = messages && messages.some(msg => msg.embeds.length > 0 && msg.components.length > 0);

            if (!hasPanel) {
                const embed = new EmbedBuilder()
                    .setTitle('🏆 VGP Balkan — Team Registration')
                    .setDescription(
                        'Welcome to the official **VGP Balkan** league registration!\n\n' +
                        'To register your team for the upcoming EA SPORTS FC 26 season, click the button below and fill out the form.\n\n' +
                        '📋 **Requirements:**\n' +
                        '• Official League Team Name & Exact In-Game Club Name\n' +
                        '• Active Team Manager on Discord\n' +
                        '• Min. 7 Active Squad Members\n\n' +
                        'Click **"Register Team"** below to submit your application!'
                    )
                    .setColor('#FFD700')
                    .setThumbnail(client.user.displayAvatarURL())
                    .setFooter({ text: 'VGP Balkan • Official Premier League' });

                const registerBtn = new ButtonBuilder()
                    .setCustomId('btn_open_team_modal')
                    .setLabel('⚽ Register Team')
                    .setStyle(ButtonStyle.Success);

                const row = new ActionRowBuilder().addComponents(registerBtn);
                await regChannel.send({ embeds: [embed], components: [row] });
                console.log('Registration Panel posted successfully!');
            }
        }
    } catch (err) {
        console.error('Error sending registration panel:', err);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        const guild = interaction.guild;
        if (!guild) return;

        // 1. OPEN FORM MODAL
        if (interaction.isButton() && interaction.customId === 'btn_open_team_modal') {
            const modal = new ModalBuilder()
                .setCustomId('modal_team_registration')
                .setTitle('VGP Balkan — Team Registration');

            const teamNameInput = new TextInputBuilder()
                .setCustomId('reg_team_name')
                .setLabel('1. Official League Team Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. Red Star Balkan FC')
                .setRequired(true);

            const inGameNameInput = new TextInputBuilder()
                .setCustomId('reg_ingame_name')
                .setLabel('2. Exact In-Game Club Name (FC 26)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. RedStarBalkan (Must match in FC 26 Pro Clubs)')
                .setRequired(true);

            const managerInfoInput = new TextInputBuilder()
                .setCustomId('reg_manager_info')
                .setLabel('3. Manager Discord & EA ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. Discord: @Manager / EA ID: Balkan_King99')
                .setRequired(true);

            const squadInfoInput = new TextInputBuilder()
                .setCustomId('reg_squad_info')
                .setLabel('4. Squad Size (Number of Players)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 11 Players')
                .setRequired(true);

            const experienceInput = new TextInputBuilder()
                .setCustomId('reg_experience_info')
                .setLabel('5. Previous League Experience')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('e.g. Have you played in other leagues before? Which ones?')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(teamNameInput),
                new ActionRowBuilder().addComponents(inGameNameInput),
                new ActionRowBuilder().addComponents(managerInfoInput),
                new ActionRowBuilder().addComponents(squadInfoInput),
                new ActionRowBuilder().addComponents(experienceInput)
            );

            await interaction.showModal(modal);
            return;
        }

        // 2. FORM SUBMISSION -> CREATE TICKET WITH ADMIN & HEAD ADMIN ACCESS
        if (interaction.isModalSubmit() && interaction.customId === 'modal_team_registration') {
            await interaction.deferReply({ ephemeral: true });

            const teamName = interaction.fields.getTextInputValue('reg_team_name');
            const inGameName = interaction.fields.getTextInputValue('reg_ingame_name');
            const managerInfo = interaction.fields.getTextInputValue('reg_manager_info');
            const squadInfo = interaction.fields.getTextInputValue('reg_squad_info');
            const experienceInfo = interaction.fields.getTextInputValue('reg_experience_info') || 'No previous experience provided';
            const member = interaction.member;

            const adminRole = guild.roles.cache.find(r => r.name.toLowerCase() === CONFIG.ADMIN_ROLE_NAME.toLowerCase());
            const headAdminRole = guild.roles.cache.find(r => r.name.toLowerCase() === CONFIG.HEAD_ADMIN_ROLE_NAME.toLowerCase());

            // Permissions
            const permissionOverwrites = [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                {
                    id: member.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks]
                }
            ];

            if (adminRole) {
                permissionOverwrites.push({
                    id: adminRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks]
                });
            }

            if (headAdminRole) {
                permissionOverwrites.push({
                    id: headAdminRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks]
                });
            }

            let ticketChannel;
            try {
                ticketChannel = await guild.channels.create({
                    name: `reg-${teamName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                    type: ChannelType.GuildText,
                    parent: CONFIG.TICKET_CATEGORY_ID,
                    permissionOverwrites: permissionOverwrites
                });
            } catch (err) {
                console.error("Failed to create ticket channel:", err);
                await interaction.editReply({ content: "❌ Failed to create ticket channel. Please contact an admin." });
                return;
            }

            await interaction.editReply({ content: `✅ Application submitted! Your private ticket channel was created: ${ticketChannel}` });

            // Send Ticket Welcome Embed
            const ticketEmbed = new EmbedBuilder()
                .setTitle(`📝 Registration Ticket — ${teamName}`)
                .setDescription(
                    `Hello ${member}!\n\n` +
                    `Thank you for submitting your application for **VGP Balkan**.\n` +
                    `Our League Administration is currently reviewing your registration.\n\n` +
                    `**Submitted Details:**\n` +
                    `• **League Team Name:** ${teamName}\n` +
                    `• **In-Game Club Name:** \`${inGameName}\`\n` +
                    `• **Manager Info:** ${managerInfo}\n` +
                    `• **Squad Size:** ${squadInfo}\n` +
                    `• **League Experience:** ${experienceInfo}\n\n` +
                    `*You will be notified right here as soon as your team is accepted!*`
                )
                .setColor('#0099FF')
                .setTimestamp();

            const closeBtn = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket 🔒')
                .setStyle(ButtonStyle.Danger);

            await ticketChannel.send({ content: `${member}`, embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(closeBtn)] });

            // Send to Admin Log Channel
            const adminLogChannel = await client.channels.fetch(CONFIG.ADMIN_LOG_CHANNEL_ID).catch(() => null);
            if (adminLogChannel) {
                const adminEmbed = new EmbedBuilder()
                    .setTitle(`📥 New Team Registration: ${teamName}`)
                    .setColor('#FFAA00')
                    .addFields(
                        { name: '⚽ League Team Name', value: teamName, inline: true },
                        { name: '🎮 In-Game Club Name', value: `\`${inGameName}\``, inline: true },
                        { name: '👤 Manager Mention', value: `${member} (${member.user.tag})`, inline: false },
                        { name: '📇 Manager & EA ID', value: managerInfo, inline: false },
                        { name: '👥 Squad Size', value: squadInfo, inline: true },
                        { name: '📜 Previous League Experience', value: experienceInfo, inline: false },
                        { name: '📌 Private Ticket Channel', value: `${ticketChannel}`, inline: false }
                    )
                    .setFooter({ text: `Applicant ID: ${member.id} | Channel ID: ${ticketChannel.id}` })
                    .setTimestamp();

                const acceptBtn = new ButtonBuilder()
                    .setCustomId(`accept_team_${member.id}_${ticketChannel.id}`)
                    .setLabel('Accept Team ✅')
                    .setStyle(ButtonStyle.Success);

                const rejectBtn = new ButtonBuilder()
                    .setCustomId(`reject_team_${member.id}_${ticketChannel.id}`)
                    .setLabel('Reject Application ❌')
                    .setStyle(ButtonStyle.Danger);

                const adminRow = new ActionRowBuilder().addComponents(acceptBtn, rejectBtn);
                await adminLogChannel.send({ embeds: [adminEmbed], components: [adminRow] });
            }
            return;
        }

        // 3. ADMIN ACCEPTS TEAM (FEIER NUR EXKLUSIV IM TICKET)
        if (interaction.isButton() && interaction.customId.startsWith('accept_team_')) {
            await interaction.deferUpdate();

            const parts = interaction.customId.replace('accept_team_', '').split('_');
            const managerId = parts[0];
            const ticketChannelId = parts[1];

            const originalEmbed = interaction.message.embeds[0];
            const teamNameField = originalEmbed.fields.find(f => f.name.includes('League Team Name'))?.value || 'Team';
            const inGameNameField = originalEmbed.fields.find(f => f.name.includes('In-Game Club Name'))?.value || 'In-Game Name';

            // Disable buttons in Admin Channel
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('accepted_done').setLabel(`Accepted by ${interaction.user.username} ✅`).setStyle(ButtonStyle.Success).setDisabled(true)
            );
            await interaction.editReply({ components: [disabledRow] });

            // Assign "Pro League" Role
            const managerMember = await guild.members.fetch(managerId).catch(() => null);
            const managerRole = guild.roles.cache.find(r => r.name.toLowerCase() === CONFIG.MANAGER_ROLE_NAME.toLowerCase());
            if (managerMember && managerRole) {
                await managerMember.roles.add(managerRole).catch(() => null);
            }

            // POST BEAUTIFUL CELEBRATION EMBED ONLY INSIDE TICKET CHANNEL
            const ticketChannel = await guild.channels.fetch(ticketChannelId).catch(() => null);
            if (ticketChannel) {
                const beautifulEmbed = new EmbedBuilder()
                    .setTitle(`✨ CONGRATULATIONS! TEAM ACCEPTED ✨`)
                    .setDescription(
                        `🎉 **WELCOME TO VGP BALKAN PREMIER LEAGUE!** 🎉\n\n` +
                        `Great news! Your application for **${teamNameField}** was approved by <@${interaction.user.id}>.\n\n` +
                        `⚽ **League Team:** ${teamNameField}\n` +
                        `🎮 **In-Game Club Name:** ${inGameNameField}\n` +
                        `👑 **Manager:** ${managerMember ? managerMember : `<@${managerId}>`}\n\n` +
                        `✅ You have officially been assigned the **${CONFIG.MANAGER_ROLE_NAME}** role!\n\n` +
                        `--------------------------------------------------\n` +
                        `🔥 *Get ready for epic league matches! Good luck in the upcoming season!* 🏆⚽`
                    )
                    .setColor('#00FF7F')
                    .setImage('https://media.giphy.com/media/26tP3mh35VTzGGsGQ/giphy.gif')
                    .setFooter({ text: 'VGP Balkan • Official Team Confirmation', iconURL: guild.iconURL() })
                    .setTimestamp();

                await ticketChannel.send({ content: `${managerMember ? managerMember : `<@${managerId}>`}`, embeds: [beautifulEmbed] });
            }
            return;
        }

        // 4. ADMIN REJECTS TEAM
        if (interaction.isButton() && interaction.customId.startsWith('reject_team_')) {
            await interaction.deferUpdate();

            const parts = interaction.customId.replace('reject_team_', '').split('_');
            const managerId = parts[0];
            const ticketChannelId = parts[1];

            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rejected_done').setLabel(`Rejected by ${interaction.user.username} ❌`).setStyle(ButtonStyle.Danger).setDisabled(true)
            );
            await interaction.editReply({ components: [disabledRow] });

            const ticketChannel = await guild.channels.fetch(ticketChannelId).catch(() => null);
            if (ticketChannel) {
                const rejectEmbed = new EmbedBuilder()
                    .setTitle('❌ Registration Status Update')
                    .setDescription(
                        `Hello <@${managerId}>,\n\n` +
                        `Unfortunately, your team application could not be approved at this time.\n` +
                        `An administrator will contact you shortly with more details.`
                    )
                    .setColor('#FF0000');

                await ticketChannel.send({ content: `<@${managerId}>`, embeds: [rejectEmbed] });
            }
            return;
        }

        // 5. CLOSE TICKET
        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 Ticket will be deleted in 5 seconds...' });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            return;
        }

    } catch (err) {
        console.error("Interaction error:", err);
    }
});

client.login(CONFIG.TOKEN);
