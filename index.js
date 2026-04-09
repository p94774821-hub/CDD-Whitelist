// ============================================
// BOT WHITELIST C.D.D - Cidade de Deus RP
// Sistema completo de whitelist automatizado
// discord.js v14 - Versão Avançada
// ============================================

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  Collection,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Events,
  AttachmentBuilder
} = require('discord.js');

// ============================================
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
// ============================================
const requiredEnvVars = [
  'TOKEN', 'CLIENT_ID', 'OWNER_ID', 'CATEGORY_ID',
  'WHITELIST_CHANNEL', 'WHITELIST_LOG', 'WHITELIST_APPROVED_ROLE',
  'WHITELIST_PENDING_ROLE', 'STAFF_ROLE_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ ERRO: Variável de ambiente ${envVar} não definida!`);
    process.exit(1);
  }
}

// ============================================
// CONFIGURAÇÕES DO BOT
// ============================================
const config = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  ownerId: process.env.OWNER_ID,
  categoryId: process.env.CATEGORY_ID,
  whitelistChannel: process.env.WHITELIST_CHANNEL,
  whitelistLog: process.env.WHITELIST_LOG,
  approvedRole: process.env.WHITELIST_APPROVED_ROLE,
  pendingRole: process.env.WHITELIST_PENDING_ROLE,
  staffRole: process.env.STAFF_ROLE_ID
};

// ============================================
// CLIENTE DO DISCORD
// ============================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// ============================================
// COLETORES E CACHE
// ============================================
const activeTickets = new Collection(); // userId -> channelId
const whitelistSessions = new Collection(); // userId -> sessionData
const cooldowns = new Collection(); // userId -> timestamp
const ticketMessageId = new Collection(); // guildId -> messageId

// ============================================
// SISTEMA DE ESTATÍSTICAS
// ============================================
const statistics = {
  totalWhitelists: 0,
  approved: 0,
  rejected: 0,
  pending: 0,
  dailyApplications: new Collection(),
  averageResponseTime: new Collection()
};

// ============================================
// EVENTO: BOT PRONTO
// ============================================
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.tag} está online!`);
  console.log(`📊 Servindo ${client.guilds.cache.size} servidores`);
  
  // Status dinâmico
  updateBotStatus();
  setInterval(updateBotStatus, 300000); // Atualiza a cada 5 minutos
  
  // Enviar mensagem no canal de logs
  try {
    const logChannel = await client.channels.fetch(config.whitelistLog);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🟢 Bot Online - Cidade de Deus RP')
        .setDescription('**Sistema de Whitelist ativo e operacional**')
        .addFields(
          { name: '🤖 Bot', value: client.user.tag, inline: true },
          { name: '🌐 Servidores', value: `${client.guilds.cache.size}`, inline: true },
          { name: '📊 Status', value: '✅ Operacional', inline: true },
          { name: '🏙️ Cidade', value: 'Cidade de Deus', inline: true },
          { name: '⏰ Inicializado', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'C.D.D Roleplay - Sistema Profissional de Whitelist' });
      
      await logChannel.send({ embeds: [embed] });
      
      // Criar painel de controle
      await createControlPanel(logChannel);
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem de inicialização:', error);
  }
  
  // Registrar comandos slash
  await registerSlashCommands();
  
  // Criar embed de whitelist em todos os servidores
  await setupWhitelistEmbeds();
});

// ============================================
// PAINEL DE CONTROLE (APENAS STAFF)
// ============================================
async function createControlPanel(channel) {
  const controlEmbed = new EmbedBuilder()
    .setColor('#4169E1')
    .setTitle('🎮 Painel de Controle - Whitelist')
    .setDescription('**Controles administrativos do sistema de whitelist**')
    .addFields(
      { name: '📊 Estatísticas', value: 'Visualize estatísticas detalhadas', inline: true },
      { name: '🔧 Configurações', value: 'Configure o sistema', inline: true },
      { name: '📋 Relatórios', value: 'Gere relatórios', inline: true }
    )
    .setFooter({ text: 'Apenas STAFF pode usar estes controles' });
  
  const statsButton = new ButtonBuilder()
    .setCustomId('control_stats')
    .setLabel('📊 Estatísticas')
    .setStyle(ButtonStyle.Primary);
  
  const configButton = new ButtonBuilder()
    .setCustomId('control_config')
    .setLabel('⚙️ Configurações')
    .setStyle(ButtonStyle.Secondary);
  
  const reportButton = new ButtonBuilder()
    .setCustomId('control_report')
    .setLabel('📋 Relatório')
    .setStyle(ButtonStyle.Success);
  
  const row = new ActionRowBuilder().addComponents(statsButton, configButton, reportButton);
  
  await channel.send({
    embeds: [controlEmbed],
    components: [row]
  });
}

// ============================================
// ATUALIZAR STATUS DO BOT
// ============================================
function updateBotStatus() {
  const activities = [
    { name: '🌆 Cidade de Deus RP', type: 3 }, // Watching
    { name: `${activeTickets.size} whitelists ativas`, type: 3 },
    { name: '/whitelist para começar', type: 2 }, // Listening
    { name: 'Sistema de Whitelist', type: 0 } // Playing
  ];
  
  const activity = activities[Math.floor(Math.random() * activities.length)];
  client.user.setActivity(activity.name, { type: activity.type });
}

// ============================================
// CONFIGURAR EMBEDS DE WHITELIST
// ============================================
async function setupWhitelistEmbeds() {
  for (const guild of client.guilds.cache.values()) {
    try {
      const channel = await guild.channels.fetch(config.whitelistChannel).catch(() => null);
      if (!channel) continue;
      
      // Verificar se já existe embed
      const messages = await channel.messages.fetch({ limit: 10 });
      const existingEmbed = messages.find(m => 
        m.author.id === client.user.id && 
        m.embeds.length > 0 && 
        m.embeds[0].title?.includes('Whitelist')
      );
      
      if (!existingEmbed) {
        await createWhitelistEmbed(channel);
      } else {
        ticketMessageId.set(guild.id, existingEmbed.id);
      }
    } catch (error) {
      console.error(`Erro ao configurar embed em ${guild.name}:`, error);
    }
  }
}

// ============================================
// CRIAR EMBED DE WHITELIST
// ============================================
async function createWhitelistEmbed(channel) {
  const mainEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🌟 SISTEMA DE WHITELIST - CIDADE DE DEUS RP 🌟')
    .setDescription(`  
**🌆 Bem-vindo ao processo seletivo da Cidade de Deus!**

Para fazer parte da nossa comunidade, você precisa passar pelo nosso sistema de whitelist. 
Este processo garante que todos os membros estejam alinhados com nossas regras e filosofia de Roleplay.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📋 COMO FUNCIONA:**

📌 **1.** Clique no botão abaixo para iniciar
📌 **2.** Responda o formulário completo
📌 **3.** Aguarde a análise da nossa equipe
📌 **4.** Se aprovado, seja bem-vindo à cidade!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**⚠️ REQUISITOS IMPORTANTES:**

✅ Ter mais de 16 anos
✅ Ler e concordar com todas as regras
✅ Responder o formulário com sinceridade
✅ Ter maturidade para o Roleplay

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📚 REGRAS PRINCIPAIS:**

🔹 **RDM** (Random Deathmatch) - PROIBIDO
🔹 **VDM** (Vehicle Deathmatch) - PROIBIDO
🔹 **Metagaming** - PROIBIDO
🔹 **Powergaming** - PROIBIDO
🔹 Respeito acima de tudo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**🎯 O QUE AVALIAMOS:**

💡 Conhecimento das regras
💡 Maturidade para RP
💡 Criatividade na lore
💡 Capacidade de interpretação

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**⏰ TEMPO DE RESPOSTA:**

🕐 Análise em até **48 horas**
📢 Você será notificado no privado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    .setImage('https://i.imgur.com/your-city-image.png') // Adicione uma imagem da sua cidade
    .setThumbnail(channel.guild.iconURL())
    .setFooter({ 
      text: 'Cidade de Deus Roleplay • Sistema de Whitelist • v2.0',
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();

  const infoEmbed = new EmbedBuilder()
    .setColor('#4169E1')
    .setTitle('📊 INFORMAÇÕES DO SERVIDOR')
    .addFields(
      { name: '👥 Membros', value: `${channel.guild.memberCount}`, inline: true },
      { name: '✅ Aprovados Hoje', value: `${statistics.approved || 0}`, inline: true },
      { name: '⏳ Em Análise', value: `${activeTickets.size}`, inline: true },
      { name: '🏆 Taxa de Aprovação', value: `${calculateApprovalRate()}%`, inline: true }
    )
    .setFooter({ text: 'Atualizado a cada 5 minutos' });

  const startButton = new ButtonBuilder()
    .setCustomId('start_whitelist_ticket')
    .setLabel('📝 INICIAR WHITELIST')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🌟');

  const rulesButton = new ButtonBuilder()
    .setCustomId('show_rules')
    .setLabel('📜 REGRAS COMPLETAS')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('📋');

  const statusButton = new ButtonBuilder()
    .setCustomId('check_status')
    .setLabel('🔍 VERIFICAR STATUS')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📊');

  const helpButton = new ButtonBuilder()
    .setCustomId('whitelist_help')
    .setLabel('❓ AJUDA')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('💡');

  const row1 = new ActionRowBuilder().addComponents(startButton, rulesButton);
  const row2 = new ActionRowBuilder().addComponents(statusButton, helpButton);

  const message = await channel.send({
    embeds: [mainEmbed, infoEmbed],
    components: [row1, row2]
  });
  
  ticketMessageId.set(channel.guild.id, message.id);
  
  // Atualizar informações periodicamente
  setInterval(async () => {
    try {
      const updatedInfoEmbed = new EmbedBuilder()
        .setColor('#4169E1')
        .setTitle('📊 INFORMAÇÕES DO SERVIDOR')
        .addFields(
          { name: '👥 Membros', value: `${channel.guild.memberCount}`, inline: true },
          { name: '✅ Aprovados Hoje', value: `${statistics.approved || 0}`, inline: true },
          { name: '⏳ Em Análise', value: `${activeTickets.size}`, inline: true },
          { name: '🏆 Taxa de Aprovação', value: `${calculateApprovalRate()}%`, inline: true }
        )
        .setFooter({ text: 'Atualizado automaticamente' });
      
      await message.edit({
        embeds: [mainEmbed, updatedInfoEmbed],
        components: [row1, row2]
      });
    } catch (error) {
      // Ignorar erros de edição
    }
  }, 300000); // Atualiza a cada 5 minutos
}

// ============================================
// CALCULAR TAXA DE APROVAÇÃO
// ============================================
function calculateApprovalRate() {
  const total = statistics.approved + statistics.rejected;
  if (total === 0) return 100;
  return Math.round((statistics.approved / total) * 100);
}

// ============================================
// EVENTO: GUILD CREATE (BOT ADICIONADO)
// ============================================
client.on(Events.GuildCreate, async (guild) => {
  console.log(`📥 Bot adicionado ao servidor: ${guild.name}`);
  
  try {
    // Procurar canal para enviar mensagem de boas-vindas
    let targetChannel = guild.systemChannel;
    
    if (!targetChannel) {
      const channels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText && 
               c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
      targetChannel = channels.first();
    }
    
    if (targetChannel) {
      const welcomeEmbed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('🤖 Bot Whitelist C.D.D - Instalado com Sucesso!')
        .setDescription('**O sistema de whitelist está ativo e configurado!**')
        .addFields(
          { name: '📋 Comando Principal', value: '`/whitelist` - Iniciar processo de whitelist', inline: true },
          { name: '🎮 Prefix Commands', value: '`!help` - Ver todos os comandos', inline: true },
          { name: '⚙️ Configuração', value: 'Configure as variáveis no arquivo `.env`', inline: true },
          { name: '📢 Canal de Whitelist', value: `Configure WHITELIST_CHANNEL no .env`, inline: true },
          { name: '👑 Owner', value: `<@${config.ownerId}>`, inline: true },
          { name: '🌆 Servidor', value: 'Cidade de Deus RP', inline: true }
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: 'Sistema Profissional de Whitelist • v2.0' })
        .setTimestamp();
      
      await targetChannel.send({ embeds: [welcomeEmbed] });
    }
    
    // Criar embed de whitelist
    const whitelistChannel = await guild.channels.fetch(config.whitelistChannel).catch(() => null);
    if (whitelistChannel) {
      await createWhitelistEmbed(whitelistChannel);
    }
    
  } catch (error) {
    console.error('Erro ao enviar mensagem de boas-vindas:', error);
  }
});

// ============================================
// REGISTRAR COMANDOS SLASH
// ============================================
async function registerSlashCommands() {
  try {
    const commands = [
      {
        name: 'whitelist',
        description: '📋 Iniciar processo de whitelist para Cidade de Deus RP'
      },
      {
        name: 'fechar',
        description: '🔒 Fechar ticket de whitelist (Apenas STAFF)'
      },
      {
        name: 'status',
        description: '📊 Verificar status de uma whitelist'
      },
      {
        name: 'revisar',
        description: '📝 Revisar whitelists pendentes (Apenas STAFF)'
      },
      {
        name: 'estatisticas',
        description: '📈 Ver estatísticas do sistema (Apenas STAFF)'
      },
      {
        name: 'limpar',
        description: '🧹 Limpar tickets inativos (Apenas STAFF)'
      },
      {
        name: 'setup',
        description: '⚙️ Configurar sistema de whitelist (Apenas Owner)'
      }
    ];
    
    // Registrar globalmente
    await client.application.commands.set(commands);
    console.log('✅ Comandos slash registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
}

// ============================================
// EVENTO: INTERACTION CREATE
// ============================================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    }
    
    // Botões
    else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
    
    // Modals
    else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
    
    // Select Menu
    else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    }
  } catch (error) {
    console.error('Erro na interação:', error);
    await handleError(interaction, error);
  }
});

// ============================================
// HANDLER: SLASH COMMANDS
// ============================================
async function handleSlashCommand(interaction) {
  const command = interaction.commandName;
  
  switch (command) {
    case 'whitelist':
      await handleWhitelistCommand(interaction);
      break;
    case 'fechar':
      await handleCloseCommand(interaction);
      break;
    case 'status':
      await handleStatusCommand(interaction);
      break;
    case 'revisar':
      await handleReviewCommand(interaction);
      break;
    case 'estatisticas':
      await handleStatsCommand(interaction);
      break;
    case 'limpar':
      await handleCleanCommand(interaction);
      break;
    case 'setup':
      await handleSetupCommand(interaction);
      break;
  }
}

// ============================================
// COMANDO: STATUS
// ============================================
async function handleStatusCommand(interaction) {
  const userId = interaction.user.id;
  const session = whitelistSessions.get(userId);
  const member = await interaction.guild.members.fetch(userId);
  
  if (member.roles.cache.has(config.approvedRole)) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Whitelist Aprovada')
          .setDescription('Sua whitelist já foi aprovada! Bem-vindo à Cidade de Deus!')
      ],
      ephemeral: true
    });
  }
  
  if (activeTickets.has(userId)) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⏳ Whitelist em Análise')
          .setDescription(`Sua whitelist está em análise pela equipe STAFF.`)
          .addFields(
            { name: '📋 Ticket', value: `<#${activeTickets.get(userId)}>`, inline: true },
            { name: '⏰ Iniciado', value: session ? `<t:${Math.floor(session.startedAt / 1000)}:R>` : 'Desconhecido', inline: true }
          )
      ],
      ephemeral: true
    });
  }
  
  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Nenhuma Whitelist Ativa')
        .setDescription('Você não possui nenhuma whitelist em andamento.')
        .addFields(
          { name: '🌟 Iniciar', value: 'Use `/whitelist` para começar o processo' }
        )
    ],
    ephemeral: true
  });
}

// ============================================
// COMANDO: REVISAR (STAFF)
// ============================================
async function handleReviewCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas membros da STAFF podem usar este comando.',
      ephemeral: true
    });
  }
  
  if (activeTickets.size === 0) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Nenhuma Whitelist Pendente')
          .setDescription('Não há whitelists aguardando análise no momento.')
      ],
      ephemeral: true
    });
  }
  
  const pendingList = [];
  for (const [userId, channelId] of activeTickets) {
    const session = whitelistSessions.get(userId);
    pendingList.push(
      `• <@${userId}> - Ticket: <#${channelId}> - ${session ? `<t:${Math.floor(session.startedAt / 1000)}:R>` : 'Em andamento'}`
    );
  }
  
  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('📋 Whitelists Pendentes')
    .setDescription(pendingList.join('\n') || 'Nenhuma')
    .setFooter({ text: `Total: ${activeTickets.size} whitelist(s)` });
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ============================================
// COMANDO: ESTATÍSTICAS (STAFF)
// ============================================
async function handleStatsCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas membros da STAFF podem usar este comando.',
      ephemeral: true
    });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#4169E1')
    .setTitle('📊 Estatísticas do Sistema de Whitelist')
    .addFields(
      { name: '📋 Total de Whitelists', value: `${statistics.totalWhitelists}`, inline: true },
      { name: '✅ Aprovadas', value: `${statistics.approved}`, inline: true },
      { name: '❌ Reprovadas', value: `${statistics.rejected}`, inline: true },
      { name: '⏳ Pendentes', value: `${activeTickets.size}`, inline: true },
      { name: '📈 Taxa de Aprovação', value: `${calculateApprovalRate()}%`, inline: true },
      { name: '🎫 Tickets Ativos', value: `${activeTickets.size}`, inline: true },
      { name: '🌐 Servidores', value: `${client.guilds.cache.size}`, inline: true },
      { name: '⏰ Uptime', value: formatUptime(client.uptime), inline: true },
      { name: '📊 Ping', value: `${client.ws.ping}ms`, inline: true }
    )
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ============================================
// COMANDO: LIMPAR (STAFF)
// ============================================
async function handleCleanCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas membros da STAFF podem usar este comando.',
      ephemeral: true
    });
  }
  
  await interaction.deferReply({ ephemeral: true });
  
  const category = await interaction.guild.channels.fetch(config.categoryId);
  const channels = category.children.cache.filter(c => c.name.startsWith('whitelist-'));
  
  let deleted = 0;
  for (const channel of channels.values()) {
    // Verificar se o canal está vazio ou inativo
    const messages = await channel.messages.fetch({ limit: 1 });
    if (messages.size === 0 || Date.now() - messages.first().createdTimestamp > 86400000) {
      try {
        await channel.delete();
        deleted++;
      } catch (error) {
        console.error(`Erro ao deletar canal ${channel.name}:`, error);
      }
    }
  }
  
  // Limpar cache
  for (const [userId, channelId] of activeTickets) {
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      activeTickets.delete(userId);
      whitelistSessions.delete(userId);
    }
  }
  
  await interaction.editReply({
    content: `✅ Limpeza concluída! ${deleted} canais removidos.`
  });
}

// ============================================
// COMANDO: SETUP (OWNER)
// ============================================
async function handleSetupCommand(interaction) {
  if (interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas o Owner do bot pode usar este comando.',
      ephemeral: true
    });
  }
  
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const whitelistChannel = await interaction.guild.channels.fetch(config.whitelistChannel);
    await createWhitelistEmbed(whitelistChannel);
    
    await interaction.editReply({
      content: '✅ Embed de whitelist criado/atualizado com sucesso!'
    });
  } catch (error) {
    await interaction.editReply({
      content: `❌ Erro ao criar embed: ${error.message}`
    });
  }
}

// ============================================
// EVENTO: MESSAGE CREATE (PREFIX COMMANDS)
// ============================================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;
  
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  switch (command) {
    case 'status':
      await handlePrefixStatus(message);
      break;
    case 'ping':
      await handlePrefixPing(message);
      break;
    case 'help':
      await handlePrefixHelp(message);
      break;
    case 'info':
      await handlePrefixInfo(message);
      break;
    case 'regras':
      await handlePrefixRules(message);
      break;
    case 'equipe':
      await handlePrefixStaff(message);
      break;
    case 'convite':
      await handlePrefixInvite(message);
      break;
  }
});

// ============================================
// PREFIX: STATUS
// ============================================
async function handlePrefixStatus(message) {
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('📊 Status do Sistema - Cidade de Deus RP')
    .setDescription('Sistema de Whitelist Operacional')
    .addFields(
      { name: '🤖 Bot', value: client.user.tag, inline: true },
      { name: '📋 Tickets Ativos', value: `${activeTickets.size}`, inline: true },
      { name: '📝 Sessões Ativas', value: `${whitelistSessions.size}`, inline: true },
      { name: '🏓 Ping', value: `${client.ws.ping}ms`, inline: true },
      { name: '⏰ Uptime', value: formatUptime(client.uptime), inline: true },
      { name: '✅ Aprovados Hoje', value: `${statistics.approved}`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'Cidade de Deus RP • Sistema Profissional' });
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// PREFIX: PING
// ============================================
async function handlePrefixPing(message) {
  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle('🏓 Pong!')
    .addFields(
      { name: '📡 Latência', value: `${client.ws.ping}ms`, inline: true },
      { name: '💓 Heartbeat', value: `${Math.round(client.ws.ping)}ms`, inline: true }
    );
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// PREFIX: HELP
// ============================================
async function handlePrefixHelp(message) {
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('📚 Central de Ajuda - Cidade de Deus RP')
    .setDescription('**Sistema de Whitelist Automatizado**\n\nTodos os comandos disponíveis:')
    .addFields(
      { 
        name: '📋 **COMANDOS SLASH**', 
        value: 
        '`/whitelist` - Iniciar processo de whitelist\n' +
        '`/status` - Verificar status da sua whitelist\n' +
        '`/fechar` - Fechar ticket (STAFF)\n' +
        '`/revisar` - Listar whitelists pendentes (STAFF)\n' +
        '`/estatisticas` - Ver estatísticas (STAFF)\n' +
        '`/limpar` - Limpar tickets inativos (STAFF)',
        inline: false
      },
      { 
        name: '🔧 **COMANDOS PREFIX (!)**', 
        value: 
        '`!status` - Status do sistema\n' +
        '`!ping` - Verificar latência\n' +
        '`!help` - Esta mensagem\n' +
        '`!info` - Informações do servidor\n' +
        '`!regras` - Regras do servidor\n' +
        '`!equipe` - Lista da equipe STAFF\n' +
        '`!convite` - Link de convite do servidor',
        inline: false
      },
      {
        name: '🌆 **SOBRE A CIDADE DE DEUS**',
        value: 'Servidor de Roleplay focado em realismo e imersão.',
        inline: false
      }
    )
    .setThumbnail(message.guild.iconURL())
    .setFooter({ text: 'Desenvolvido para C.D.D Roleplay • v2.0' });
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// PREFIX: INFO
// ============================================
async function handlePrefixInfo(message) {
  const embed = new EmbedBuilder()
    .setColor('#4169E1')
    .setTitle('🌆 Cidade de Deus Roleplay')
    .setDescription('**O maior servidor de Roleplay do Brasil!**')
    .addFields(
      { name: '👑 Owner', value: `<@${config.ownerId}>`, inline: true },
      { name: '👥 Membros', value: `${message.guild.memberCount}`, inline: true },
      { name: '📅 Criado em', value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:D>`, inline: true },
      { name: '🌟 Boost', value: `Nível ${message.guild.premiumTier}`, inline: true },
      { name: '🎮 Sistema', value: 'Whitelist Obrigatória', inline: true },
      { name: '⏰ Análise', value: 'Até 48 horas', inline: true }
    )
    .setImage('https://i.imgur.com/your-city-banner.png')
    .setFooter({ text: 'Junte-se a nós e faça história!' });
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// PREFIX: REGRAS
// ============================================
async function handlePrefixRules(message) {
  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('📜 REGRAS DA CIDADE DE DEUS RP')
    .setDescription('**Leia atentamente todas as regras!**')
    .addFields(
      { name: '🚫 REGRAS GERAIS', value: '• Respeito acima de tudo\n• Sem preconceito ou discriminação\n• Proibido qualquer tipo de assédio' },
      { name: '🎭 REGRAS DE RP', value: '• **RDM** (Random Deathmatch) - PROIBIDO\n• **VDM** (Vehicle Deathmatch) - PROIBIDO\n• **Metagaming** - PROIBIDO\n• **Powergaming** - PROIBIDO\n• **Combat Logging** - PROIBIDO' },
      { name: '👮 REGRAS POLICIAIS', value: '• Respeitar abordagens policiais\n• Seguir comandos da polícia\n• Não reagir a abordagens sem motivo RP' },
      { name: '💰 REGRAS ECONÔMICAS', value: '• Farm de dinheiro proibido\n• Scam apenas com RP\n• Respeitar a economia do servidor' },
      { name: '⚠️ PUNIÇÕES', value: '1ª - Aviso\n2ª - Kick\n3ª - Ban Temporário\n4ª - Ban Permanente' }
    )
    .setFooter({ text: 'O descumprimento das regras resultará em punições' });
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// PREFIX: EQUIPE
// ============================================
async function handlePrefixStaff(message) {
  const staffRole = await message.guild.roles.fetch(config.staffRole);
  const staffMembers = staffRole.members;
  
  const onlineStaff = staffMembers.filter(m => m.presence?.status === 'online').size;
  const totalStaff = staffMembers.size;
  
  const staffList = staffMembers.map(m => `• ${m.user.tag} ${m.presence?.status === 'online' ? '🟢' : '🔴'}`).join('\n');
  
  const embed = new EmbedBuilder()
    .setColor('#9370DB')
    .setTitle('👥 Equipe STAFF - Cidade de Deus RP')
    .setDescription('**Nossa equipe está aqui para ajudar!**')
    .addFields(
      { name: `📊 Total STAFF (${totalStaff})`, value: staffList || 'Nenhum membro encontrado' },
      { name: '🟢 Online', value: `${onlineStaff} membros`, inline: true },
      { name: '🔴 Offline', value: `${totalStaff - onlineStaff} membros`, inline: true }
    )
    .setFooter({ text: 'Respeite a hierarquia da equipe' });
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// PREFIX: CONVITE
// ============================================
async function handlePrefixInvite(message) {
  const invite = await message.channel.createInvite({
    maxAge: 0,
    maxUses: 0,
    reason: 'Convite gerado pelo sistema de whitelist'
  });
  
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🔗 Convite - Cidade de Deus RP')
    .setDescription(`**Compartilhe este link com seus amigos!**\n\n${invite.url}`)
    .addFields(
      { name: '⏰ Expira em', value: 'Nunca', inline: true },
      { name: '👥 Usos', value: 'Ilimitado', inline: true }
    )
    .setFooter({ text: 'Convide pessoas que respeitem as regras!' });
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// HANDLER: COMANDO WHITELIST
// ============================================
async function handleWhitelistCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const userId = interaction.user.id;
  const guild = interaction.guild;
  const member = await guild.members.fetch(userId);
  
  // Verificar se já tem whitelist aprovada
  if (member.roles.cache.has(config.approvedRole)) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Whitelist já Aprovada')
          .setDescription('Você já possui whitelist aprovada! Bem-vindo à Cidade de Deus RP.')
          .setFooter({ text: 'Aproveite o servidor!' })
      ],
      ephemeral: true
    });
  }
  
  // Verificar se já tem ticket ativo
  if (activeTickets.has(userId)) {
    const existingChannel = activeTickets.get(userId);
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Ticket já Existente')
          .setDescription(`Você já possui um ticket de whitelist ativo em <#${existingChannel}>`)
          .setFooter({ text: 'Acesse seu ticket para continuar' })
      ],
      ephemeral: true
    });
  }
  
  // Verificar cooldown (1 hora)
  if (cooldowns.has(userId)) {
    const cooldownTime = cooldowns.get(userId);
    const timeLeft = Math.ceil((cooldownTime - Date.now()) / 1000 / 60);
    if (timeLeft > 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⏰ Em Cooldown')
            .setDescription(`Aguarde **${timeLeft} minutos** antes de abrir um novo ticket.`)
            .setFooter({ text: 'Use este tempo para estudar as regras!' })
        ],
        ephemeral: true
      });
    }
  }
  
  try {
    // Criar canal privado
    const category = await guild.channels.fetch(config.categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({
        content: '❌ Erro: Categoria de whitelist não configurada corretamente.',
        ephemeral: true
      });
    }
    
    const channelName = `🎫-whitelist-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Whitelist de ${interaction.user.tag} | ID: ${interaction.user.id}`,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: config.staffRole,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ]
    });
    
    // Registrar ticket
    activeTickets.set(userId, channel.id);
    
    // Inicializar sessão
    whitelistSessions.set(userId, {
      step: 0,
      answers: {},
      channelId: channel.id,
      startedAt: Date.now(),
      userId: userId,
      userTag: interaction.user.tag
    });
    
    statistics.totalWhitelists++;
    statistics.pending = activeTickets.size;
    
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Ticket Criado com Sucesso!')
          .setDescription(`Seu ticket foi criado em ${channel}`)
          .setFooter({ text: 'Boa sorte na sua whitelist!' })
      ],
      ephemeral: true
    });
    
    // Adicionar cargo pendente
    try {
      await member.roles.add(config.pendingRole);
    } catch (error) {
      console.error('Erro ao adicionar cargo pendente:', error);
    }
    
    // Enviar mensagem de boas-vindas no ticket
    await sendTicketWelcomeMessage(channel, interaction.user);
    
    // Notificar STAFF
    await notifyStaffNewWhitelist(guild, interaction.user, channel);
    
  } catch (error) {
    console.error('Erro ao criar ticket:', error);
    await interaction.editReply({
      content: '❌ Erro ao criar ticket. Contate um administrador.',
      ephemeral: true
    });
  }
}

// ============================================
// ENVIAR MENSAGEM DE BOAS-VINDAS NO TICKET
// ============================================
async function sendTicketWelcomeMessage(channel, user) {
  const welcomeEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🌆 BEM-VINDO À CIDADE DE DEUS RP')
    .setDescription(`**Olá ${user}, sua jornada começa agora!**`)
    .addFields(
      { 
        name: '📋 PROCESSO DE WHITELIST', 
        value: 'Você responderá **3 etapas** de perguntas para avaliarmos seu conhecimento e maturidade para o Roleplay.',
        inline: false 
      },
      { 
        name: '⏱️ TEMPO', 
        value: 'Não há limite de tempo. Responda com **calma e atenção**.', 
        inline: true 
      },
      { 
        name: '📝 DICA IMPORTANTE', 
        value: 'Quanto mais **detalhadas** forem suas respostas, maiores as chances de aprovação!', 
        inline: true 
      },
      {
        name: '🎯 ETAPAS',
        value: '```\n1️⃣ Regras de RP\n2️⃣ Raciocínio Lógico\n3️⃣ Lore do Personagem\n```',
        inline: false
      }
    )
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: 'Clique no botão abaixo para começar • Boa sorte!' })
    .setTimestamp();
  
  const startButton = new ButtonBuilder()
    .setCustomId('start_whitelist_form')
    .setLabel('📝 INICIAR WHITELIST')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🌟');
  
  const cancelButton = new ButtonBuilder()
    .setCustomId('cancel_whitelist')
    .setLabel('❌ CANCELAR')
    .setStyle(ButtonStyle.Danger);
  
  const row = new ActionRowBuilder().addComponents(startButton, cancelButton);
  
  await channel.send({
    content: `${user}`,
    embeds: [welcomeEmbed],
    components: [row]
  });
}

// ============================================
// NOTIFICAR STAFF SOBRE NOVA WHITELIST
// ============================================
async function notifyStaffNewWhitelist(guild, user, channel) {
  try {
    const logChannel = await client.channels.fetch(config.whitelistLog);
    
    const notifyEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('📋 Nova Whitelist Iniciada')
      .setDescription(`**${user.tag}** iniciou o processo de whitelist.`)
      .addFields(
        { name: '👤 Usuário', value: `${user}`, inline: true },
        { name: '🆔 ID', value: user.id, inline: true },
        { name: '🎫 Ticket', value: `${channel}`, inline: true },
        { name: '⏰ Início', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      )
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: 'Acompanhe o ticket para análise' })
      .setTimestamp();
    
    await logChannel.send({ 
      content: `<@&${config.staffRole}>`, 
      embeds: [notifyEmbed] 
    });
  } catch (error) {
    console.error('Erro ao notificar STAFF:', error);
  }
}

// ============================================
// HANDLER: COMANDO FECHAR (STAFF)
// ============================================
async function handleCloseCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  // Verificar permissão
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Acesso Negado')
          .setDescription('Apenas membros da STAFF podem usar este comando.')
      ],
      ephemeral: true
    });
  }
  
  const channel = interaction.channel;
  
  // Verificar se é um canal de whitelist
  if (!channel.name.startsWith('🎫-whitelist-')) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Canal Inválido')
          .setDescription('Este comando só pode ser usado em canais de whitelist.')
      ],
      ephemeral: true
    });
  }
  
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🔒 Fechando Ticket')
        .setDescription('O ticket será fechado em **5 segundos**...')
    ]
  });
  
  setTimeout(async () => {
    try {
      // Encontrar usuário do ticket
      for (const [userId, channelId] of activeTickets.entries()) {
        if (channelId === channel.id) {
          activeTickets.delete(userId);
          whitelistSessions.delete(userId);
          break;
        }
      }
      
      // Log de fechamento
      const logChannel = await client.channels.fetch(config.whitelistLog);
      const closeEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔒 Ticket Fechado')
        .setDescription(`Ticket ${channel.name} foi fechado por ${interaction.user.tag}`)
        .setTimestamp();
      
      await logChannel.send({ embeds: [closeEmbed] });
      
      await channel.delete();
    } catch (error) {
      console.error('Erro ao fechar canal:', error);
    }
  }, 5000);
}

// ============================================
// HANDLER: BOTÕES
// ============================================
async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  
  // Botão do Embed Principal - Iniciar Whitelist
  if (customId === 'start_whitelist_ticket') {
    await interaction.deferReply({ ephemeral: true });
    await handleWhitelistCommand(interaction);
  }
  
  // Botão: Mostrar Regras
  else if (customId === 'show_rules') {
    await interaction.deferReply({ ephemeral: true });
    await handlePrefixRules(interaction);
  }
  
  // Botão: Verificar Status
  else if (customId === 'check_status') {
    await interaction.deferReply({ ephemeral: true });
    await handleStatusCommand(interaction);
  }
  
  // Botão: Ajuda
  else if (customId === 'whitelist_help') {
    await interaction.deferReply({ ephemeral: true });
    await handlePrefixHelp(interaction);
  }
  
  // Botão: Iniciar Formulário (dentro do ticket)
  else if (customId === 'start_whitelist_form') {
    const session = whitelistSessions.get(userId);
    if (!session) {
      return interaction.reply({
        content: '❌ Sessão não encontrada. Use /whitelist para recomeçar.',
        ephemeral: true
      });
    }
    
    await showPage1(interaction);
  }
  
  // Botão: Cancelar Whitelist
  else if (customId === 'cancel_whitelist') {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Cancelar Whitelist?')
          .setDescription('Tem certeza que deseja cancelar sua whitelist?')
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_cancel')
            .setLabel('✅ Sim, Cancelar')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('keep_ticket')
            .setLabel('❌ Não, Continuar')
            .setStyle(ButtonStyle.Secondary)
        )
      ],
      ephemeral: true
    });
  }
  
  // Botão: Confirmar Cancelamento
  else if (customId === 'confirm_cancel') {
    const session = whitelistSessions.get(userId);
    if (session) {
      whitelistSessions.delete(userId);
      activeTickets.delete(userId);
      
      const member = await interaction.guild.members.fetch(userId);
      await member.roles.remove(config.pendingRole).catch(() => {});
      
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Whitelist Cancelada')
            .setDescription('Sua whitelist foi cancelada. O ticket será fechado em 5 segundos.')
        ],
        components: []
      });
      
      setTimeout(() => interaction.channel.delete(), 5000);
    }
  }
  
  // Botão: Manter Ticket
  else if (customId === 'keep_ticket') {
    await interaction.update({
      content: '✅ Continuando com a whitelist...',
      embeds: [],
      components: []
    });
  }
  
  // Botão: Próxima Página
  else if (customId === 'next_page') {
    const session = whitelistSessions.get(userId);
    if (!session) {
      return interaction.reply({
        content: '❌ Sessão não encontrada.',
        ephemeral: true
      });
    }
    
    if (session.step === 1) {
      await showPage1Modal(interaction);
    } else if (session.step === 2) {
      await showPage2Modal(interaction);
    }
  }
  
  // Botão: Enviar para Análise
  else if (customId === 'submit_whitelist') {
    await submitWhitelist(interaction);
  }
  
  // Botões STAFF - Aprovar/Reprovar
  else if (customId.startsWith('approve_') || customId.startsWith('reject_')) {
    await handleStaffDecision(interaction);
  }
  
  // Botão: Lore do Personagem
  else if (customId === 'submit_lore') {
    await showLoreModal(interaction);
  }
  
  // Botões do Painel de Controle
  else if (customId === 'control_stats') {
    const member = await interaction.guild.members.fetch(userId);
    if (!member.roles.cache.has(config.staffRole) && userId !== config.ownerId) {
      return interaction.reply({ content: '❌ Acesso negado.', ephemeral: true });
    }
    await handleStatsCommand(interaction);
  }
  
  else if (customId === 'control_report') {
    const member = await interaction.guild.members.fetch(userId);
    if (!member.roles.cache.has(config.staffRole) && userId !== config.ownerId) {
      return interaction.reply({ content: '❌ Acesso negado.', ephemeral: true });
    }
    
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#4169E1')
          .setTitle('📋 Relatório do Sistema')
          .setDescription('Gerando relatório completo...')
      ],
      ephemeral: true
    });
    
    // Gerar relatório em texto
    const report = generateSystemReport(interaction.guild);
    
    const attachment = new AttachmentBuilder(
      Buffer.from(report, 'utf-8'),
      { name: `whitelist-report-${Date.now()}.txt` }
    );
    
    await interaction.followUp({
      content: '📊 Relatório gerado com sucesso!',
      files: [attachment],
      ephemeral: true
    });
  }
}

// ============================================
// GERAR RELATÓRIO DO SISTEMA
// ============================================
function generateSystemReport(guild) {
  let report = '='.repeat(50) + '\n';
  report += 'RELATÓRIO DO SISTEMA DE WHITELIST\n';
  report += 'Cidade de Deus Roleplay\n';
  report += '='.repeat(50) + '\n\n';
  
  report += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
  report += `Servidor: ${guild.name}\n`;
  report += `Membros: ${guild.memberCount}\n\n`;
  
  report += 'ESTATÍSTICAS:\n';
  report += '-'.repeat(30) + '\n';
  report += `Total de Whitelists: ${statistics.totalWhitelists}\n`;
  report += `Aprovadas: ${statistics.approved}\n`;
  report += `Reprovadas: ${statistics.rejected}\n`;
  report += `Pendentes: ${activeTickets.size}\n`;
  report += `Taxa de Aprovação: ${calculateApprovalRate()}%\n\n`;
  
  report += 'TICKETS ATIVOS:\n';
  report += '-'.repeat(30) + '\n';
  for (const [userId, channelId] of activeTickets) {
    const session = whitelistSessions.get(userId);
    report += `- ${session?.userTag || userId}: Canal ${channelId}\n`;
    report += `  Iniciado: ${session ? new Date(session.startedAt).toLocaleString('pt-BR') : 'Desconhecido'}\n`;
  }
  
  report += '\n' + '='.repeat(50) + '\n';
  report += 'Fim do Relatório\n';
  report += '='.repeat(50);
  
  return report;
}

// ============================================
// PÁGINA 1 - REGRAS DE RP
// ============================================
async function showPage1(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle('📋 ETAPA 1 - REGRAS DE ROLEPLAY')
    .setDescription('**Responda as perguntas sobre regras básicas de Roleplay.**')
    .addFields(
      { 
        name: '📌 PERGUNTAS DESTA ETAPA', 
        value: 
        '```\n' +
        '1. Nome do personagem\n' +
        '2. Idade do personagem\n' +
        '3. Já jogou RP antes?\n' +
        '4. O que é RDM e VDM?\n' +
        '5. Cite regras importantes do servidor\n' +
        '```'
      },
      {
        name: '💡 DICA',
        value: 'Responda com sinceridade e demonstre conhecimento das regras!',
        inline: false
      }
    )
    .setFooter({ text: 'Clique no botão abaixo para responder • Etapa 1 de 3' });
  
  const button = new ButtonBuilder()
    .setCustomId('next_page')
    .setLabel('📝 RESPONDER ETAPA 1')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('1️⃣');
  
  const row = new ActionRowBuilder().addComponents(button);
  
  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: false
  });
}

async function showPage1Modal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('page1_modal')
    .setTitle('Etapa 1 - Regras de RP');
  
  const nameInput = new TextInputBuilder()
    .setCustomId('char_name')
    .setLabel('👤 Nome do personagem')
    .setPlaceholder('Ex: João Silva')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(50);
  
  const ageInput = new TextInputBuilder()
    .setCustomId('char_age')
    .setLabel('🎂 Idade do personagem')
    .setPlaceholder('Ex: 25')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);
  
  const rpExperienceInput = new TextInputBuilder()
    .setCustomId('rp_experience')
    .setLabel('🎮 Já jogou RP antes? Onde?')
    .setPlaceholder('Conte sua experiência com Roleplay...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const rdmVdmInput = new TextInputBuilder()
    .setCustomId('rdm_vdm')
    .setLabel('⚠️ O que é RDM e VDM?')
    .setPlaceholder('Explique os dois conceitos...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const rulesInput = new TextInputBuilder()
    .setCustomId('server_rules')
    .setLabel('📜 Cite regras importantes do servidor')
    .setPlaceholder('Liste as regras que você conhece...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(30)
    .setMaxLength(1000);
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(ageInput),
    new ActionRowBuilder().addComponents(rpExperienceInput),
    new ActionRowBuilder().addComponents(rdmVdmInput),
    new ActionRowBuilder().addComponents(rulesInput)
  );
  
  await interaction.showModal(modal);
}

// ============================================
// PÁGINA 2 - RACIOCÍNIO LÓGICO
// ============================================
async function showPage2Modal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('page2_modal')
    .setTitle('Etapa 2 - Raciocínio Lógico');
  
  const policeInput = new TextInputBuilder()
    .setCustomId('police_approach')
    .setLabel('👮 O que faria ao ser abordado pela polícia?')
    .setPlaceholder('Descreva sua reação em uma abordagem policial...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const robberyInput = new TextInputBuilder()
    .setCustomId('robbery_reaction')
    .setLabel('💰 Como reagiria a um assalto?')
    .setPlaceholder('Descreva sua reação durante um assalto...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const metagamingInput = new TextInputBuilder()
    .setCustomId('metagaming')
    .setLabel('🎭 O que é metagaming?')
    .setPlaceholder('Explique o conceito de metagaming...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const powergamingInput = new TextInputBuilder()
    .setCustomId('powergaming')
    .setLabel('💪 O que é powergaming?')
    .setPlaceholder('Explique o conceito de powergaming...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const rpSituationInput = new TextInputBuilder()
    .setCustomId('rp_situation')
    .setLabel('🎬 Descreva uma situação de RP vivida')
    .setPlaceholder('Conte uma experiência memorável de RP...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(30)
    .setMaxLength(1000);
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(policeInput),
    new ActionRowBuilder().addComponents(robberyInput),
    new ActionRowBuilder().addComponents(metagamingInput),
    new ActionRowBuilder().addComponents(powergamingInput),
    new ActionRowBuilder().addComponents(rpSituationInput)
  );
  
  await interaction.showModal(modal);
}

// ============================================
// MODAL: LORE DO PERSONAGEM
// ============================================
async function showLoreModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('lore_modal')
    .setTitle('Etapa 3 - Lore do Personagem');
  
  const historyInput = new TextInputBuilder()
    .setCustomId('char_history')
    .setLabel('📚 História do personagem (detalhada)')
    .setPlaceholder('Conte a história completa do seu personagem...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(100)
    .setMaxLength(4000);
  
  const personalityInput = new TextInputBuilder()
    .setCustomId('char_personality')
    .setLabel('🎭 Personalidade')
    .setPlaceholder('Descreva a personalidade do seu personagem...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(50)
    .setMaxLength(1000);
  
  const objectiveInput = new TextInputBuilder()
    .setCustomId('char_objective')
    .setLabel('🎯 Objetivo na cidade')
    .setPlaceholder('Quais os objetivos do seu personagem?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(30)
    .setMaxLength(1000);
  
  const professionInput = new TextInputBuilder()
    .setCustomId('char_profession')
    .setLabel('💼 Profissão pretendida')
    .setPlaceholder('Ex: Policial, Médico, Mecânico...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(100);
  
  const relationsInput = new TextInputBuilder()
    .setCustomId('char_relations')
    .setLabel('🤝 Relações e conexões')
    .setPlaceholder('Descreva relações importantes do personagem...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(1000);
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(historyInput),
    new ActionRowBuilder().addComponents(personalityInput),
    new ActionRowBuilder().addComponents(objectiveInput),
    new ActionRowBuilder().addComponents(professionInput),
    new ActionRowBuilder().addComponents(relationsInput)
  );
  
  await interaction.showModal(modal);
}

// ============================================
// HANDLER: SUBMIT DE MODAIS
// ============================================
async function handleModalSubmit(interaction) {
  const userId = interaction.user.id;
  const session = whitelistSessions.get(userId);
  
  if (!session) {
    return interaction.reply({
      content: '❌ Sessão expirada. Use /whitelist para recomeçar.',
      ephemeral: true
    });
  }
  
  // Página 1 Modal
  if (interaction.customId === 'page1_modal') {
    const charName = interaction.fields.getTextInputValue('char_name');
    const charAge = interaction.fields.getTextInputValue('char_age');
    const rpExperience = interaction.fields.getTextInputValue('rp_experience');
    const rdmVdm = interaction.fields.getTextInputValue('rdm_vdm');
    const serverRules = interaction.fields.getTextInputValue('server_rules');
    
    // Validar idade
    const age = parseInt(charAge);
    if (isNaN(age) || age < 16 || age > 100) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Idade Inválida')
            .setDescription('A idade do personagem deve ser entre **16 e 100 anos**.')
        ],
        ephemeral: true
      });
    }
    
    session.answers.page1 = {
      charName,
      charAge: age,
      rpExperience,
      rdmVdm,
      serverRules
    };
    
    session.step = 2;
    
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Etapa 1 Concluída!')
          .setDescription('Suas respostas foram registradas com sucesso.')
          .setFooter({ text: 'Preparando Etapa 2...' })
      ],
      ephemeral: true
    });
    
    // Mostrar Página 2
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('📋 ETAPA 2 - RACIOCÍNIO LÓGICO')
      .setDescription('**Agora vamos testar seu raciocínio em situações de RP.**')
      .addFields(
        { 
          name: '📌 PERGUNTAS DESTA ETAPA', 
          value: 
          '```\n' +
          '1. O que faria ao ser abordado pela polícia?\n' +
          '2. Como reagiria a um assalto?\n' +
          '3. O que é metagaming?\n' +
          '4. O que é powergaming?\n' +
          '5. Descreva uma situação de RP vivida\n' +
          '```'
        },
        {
          name: '💡 DICA',
          value: 'Seja realista em suas respostas! Pense como seu personagem agiria.',
          inline: false
        }
      )
      .setFooter({ text: 'Clique no botão para responder • Etapa 2 de 3' });
    
    const button = new ButtonBuilder()
      .setCustomId('next_page')
      .setLabel('📝 RESPONDER ETAPA 2')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('2️⃣');
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
  
  // Página 2 Modal
  else if (interaction.customId === 'page2_modal') {
    const policeApproach = interaction.fields.getTextInputValue('police_approach');
    const robberyReaction = interaction.fields.getTextInputValue('robbery_reaction');
    const metagaming = interaction.fields.getTextInputValue('metagaming');
    const powergaming = interaction.fields.getTextInputValue('powergaming');
    const rpSituation = interaction.fields.getTextInputValue('rp_situation');
    
    session.answers.page2 = {
      policeApproach,
      robberyReaction,
      metagaming,
      powergaming,
      rpSituation
    };
    
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Etapa 2 Concluída!')
          .setDescription('Suas respostas foram registradas com sucesso.')
          .setFooter({ text: 'Quase lá!' })
      ],
      ephemeral: true
    });
    
    // Mostrar opção para enviar ou adicionar lore
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📋 WHITELIST - QUASE LÁ!')
      .setDescription('**Você completou as etapas obrigatórias!**')
      .addFields(
        { 
          name: '✅ OPÇÃO 1', 
          value: '**Enviar para análise agora**\nSua whitelist será avaliada pela equipe STAFF.',
          inline: true 
        },
        { 
          name: '📖 OPÇÃO 2 (RECOMENDADO)', 
          value: '**Adicionar Lore do personagem**\nAumente significativamente suas chances de aprovação!',
          inline: true 
        }
      )
      .setFooter({ text: 'A Lore detalhada é um diferencial importante!' });
    
    const submitButton = new ButtonBuilder()
      .setCustomId('submit_whitelist')
      .setLabel('✅ ENVIAR PARA ANÁLISE')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📤');
    
    const loreButton = new ButtonBuilder()
      .setCustomId('submit_lore')
      .setLabel('📖 ADICIONAR LORE')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✨');
    
    const row = new ActionRowBuilder().addComponents(submitButton, loreButton);
    
    await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
  
  // Lore Modal
  else if (interaction.customId === 'lore_modal') {
    const charHistory = interaction.fields.getTextInputValue('char_history');
    const charPersonality = interaction.fields.getTextInputValue('char_personality');
    const charObjective = interaction.fields.getTextInputValue('char_objective');
    const charProfession = interaction.fields.getTextInputValue('char_profession');
    const charRelations = interaction.fields.getTextInputValue('char_relations');
    
    session.answers.lore = {
      charHistory,
      charPersonality,
      charObjective,
      charProfession,
      charRelations
    };
    
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Lore Adicionada com Sucesso!')
          .setDescription('Sua lore foi registrada e será avaliada pela equipe.')
          .setFooter({ text: 'Isso aumentará suas chances de aprovação!' })
      ],
      ephemeral: true
    });
    
    // Perguntar se quer enviar
    const embed = new EmbedBuilder()
      .setColor('#9370DB')
      .setTitle('✨ LORE ADICIONADA!')
      .setDescription('**Sua lore foi registrada com sucesso.**')
      .addFields(
        { name: '📊 Status', value: 'Pronto para envio', inline: true },
        { name: '📝 Personagem', value: session.answers.page1.charName, inline: true }
      )
      .setFooter({ text: 'Clique no botão abaixo para enviar para análise' });
    
    const submitButton = new ButtonBuilder()
      .setCustomId('submit_whitelist')
      .setLabel('✅ ENVIAR PARA ANÁLISE')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📤');
    
    const row = new ActionRowBuilder().addComponents(submitButton);
    
    await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
}

// ============================================
// SUBMIT WHITELIST PARA ANÁLISE
// ============================================
async function submitWhitelist(interaction) {
  const userId = interaction.user.id;
  const session = whitelistSessions.get(userId);
  
  if (!session || !session.answers.page1 || !session.answers.page2) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Formulário Incompleto')
          .setDescription('Você precisa completar as etapas 1 e 2 primeiro!')
      ],
      ephemeral: true
    });
  }
  
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('📤 Enviando Whitelist')
        .setDescription('Sua whitelist está sendo enviada para análise...')
    ],
    ephemeral: true
  });
  
  try {
    // Criar embed para o canal de logs
    const logChannel = await client.channels.fetch(config.whitelistLog);
    
    const mainEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle(`📋 WHITELIST - ${interaction.user.tag}`)
      .setDescription(`**ID:** ${interaction.user.id}\n**Menção:** ${interaction.user}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'C.D.D Roleplay - Sistema de Whitelist • v2.0' });
    
    // Adicionar campos da Página 1
    mainEmbed.addFields(
      { name: '━━━ 📄 ETAPA 1: REGRAS DE RP ━━━', value: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬' },
      { name: '👤 Personagem', value: session.answers.page1.charName, inline: true },
      { name: '🎂 Idade', value: `${session.answers.page1.charAge} anos`, inline: true },
      { name: '🎮 Experiência RP', value: session.answers.page1.rpExperience },
      { name: '⚠️ RDM e VDM', value: session.answers.page1.rdmVdm },
      { name: '📜 Regras do Servidor', value: session.answers.page1.serverRules }
    );
    
    // Adicionar campos da Página 2
    mainEmbed.addFields(
      { name: '━━━ 📄 ETAPA 2: RACIOCÍNIO LÓGICO ━━━', value: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬' },
      { name: '👮 Abordagem Policial', value: session.answers.page2.policeApproach },
      { name: '💰 Reação a Assalto', value: session.answers.page2.robberyReaction },
      { name: '🎭 Metagaming', value: session.answers.page2.metagaming },
      { name: '💪 Powergaming', value: session.answers.page2.powergaming },
      { name: '🎬 Situação RP', value: session.answers.page2.rpSituation }
    );
    
    // Enviar embed principal
    await logChannel.send({ embeds: [mainEmbed] });
    
    // Se tiver lore, enviar embed separado
    if (session.answers.lore) {
      const loreEmbed = new EmbedBuilder()
        .setColor('#9370DB')
        .setTitle(`📖 LORE - ${session.answers.page1.charName}`)
        .setDescription(`**Personagem de:** ${interaction.user}`)
        .addFields(
          { name: '📚 História', value: session.answers.lore.charHistory },
          { name: '🎭 Personalidade', value: session.answers.lore.charPersonality },
          { name: '🎯 Objetivo', value: session.answers.lore.charObjective },
          { name: '💼 Profissão', value: session.answers.lore.charProfession, inline: true },
          { name: '🤝 Relações', value: session.answers.lore.charRelations, inline: true }
        )
        .setTimestamp();
      
      await logChannel.send({ embeds: [loreEmbed] });
    }
    
    // Botões de aprovação
    const approveButton = new ButtonBuilder()
      .setCustomId(`approve_${userId}`)
      .setLabel('✅ APROVAR')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✔️');
    
    const rejectButton = new ButtonBuilder()
      .setCustomId(`reject_${userId}`)
      .setLabel('❌ REPROVAR')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('✖️');
    
    const row = new ActionRowBuilder().addComponents(approveButton, rejectButton);
    
    await logChannel.send({
      content: `📋 **NOVA WHITELIST PARA ANÁLISE**\n👤 Usuário: ${interaction.user}\n🎫 Ticket: ${interaction.channel}\n📊 Total Pendente: ${activeTickets.size}`,
      components: [row]
    });
    
    // Mensagem no ticket
    const pendingEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⏳ WHITELIST EM ANÁLISE')
      .setDescription('**Sua whitelist foi enviada para análise da equipe STAFF.**')
      .addFields(
        { name: '📊 Status', value: '```⏳ PENDENTE```', inline: true },
        { name: '👥 Equipe', value: '```Aguardando avaliação```', inline: true },
        { name: '⏱️ Prazo', value: '```Até 48 horas```', inline: true },
        { name: '📝 O que acontece agora?', value: 'A equipe STAFF analisará suas respostas. Você será notificado assim que houver uma decisão.' }
      )
      .setFooter({ text: 'Agradecemos sua paciência • Boa sorte!' })
      .setTimestamp();
    
    await interaction.channel.send({
      embeds: [pendingEmbed]
    });
    
    // Desabilitar botões da mensagem anterior
    await interaction.message.edit({
      components: []
    }).catch(() => {});
    
  } catch (error) {
    console.error('Erro ao enviar whitelist:', error);
    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Erro ao Processar')
          .setDescription('Ocorreu um erro ao enviar sua whitelist. Contate um administrador.')
      ],
      ephemeral: true
    });
  }
}

// ============================================
// HANDLER: DECISÃO DA STAFF
// ============================================
async function handleStaffDecision(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  // Verificar permissão
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Acesso Negado')
          .setDescription('Apenas membros da STAFF podem aprovar/reprovar whitelists.')
      ],
      ephemeral: true
    });
  }
  
  const isApproving = interaction.customId.startsWith('approve_');
  const targetUserId = interaction.customId.split('_')[1];
  
  try {
    const targetMember = await interaction.guild.members.fetch(targetUserId);
    const session = whitelistSessions.get(targetUserId);
    const ticketChannelId = activeTickets.get(targetUserId);
    
    // Modal para motivo (se reprovar)
    if (!isApproving) {
      const modal = new ModalBuilder()
        .setCustomId(`reject_reason_${targetUserId}`)
        .setTitle('Motivo da Reprovação');
      
      const reasonInput = new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('📝 Motivo da reprovação')
        .setPlaceholder('Explique detalhadamente o motivo da reprovação...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000);
      
      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      
      return await interaction.showModal(modal);
    }
    
    // APROVAÇÃO
    await interaction.deferUpdate();
    
    statistics.approved++;
    statistics.pending = activeTickets.size - 1;
    
    // Remover cargo pendente
    try {
      await targetMember.roles.remove(config.pendingRole);
    } catch (error) {
      console.error('Erro ao remover cargo pendente:', error);
    }
    
    // Adicionar cargo aprovado
    try {
      await targetMember.roles.add(config.approvedRole);
    } catch (error) {
      console.error('Erro ao adicionar cargo aprovado:', error);
    }
    
    // Embed de aprovação nos logs
    const approvedEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ WHITELIST APROVADA')
      .setDescription(`**Usuário:** ${targetMember.user.tag}\n**Aprovado por:** ${interaction.user.tag}`)
      .addFields(
        { name: '📊 Estatísticas', value: `Total Aprovadas: ${statistics.approved}`, inline: true },
        { name: '⏰ Tempo de Análise', value: session ? formatDuration(Date.now() - session.startedAt) : 'Desconhecido', inline: true }
      )
      .setTimestamp();
    
    await interaction.message.edit({
      embeds: [approvedEmbed],
      components: []
    });
    
    // Mensagem no ticket
    if (ticketChannelId) {
      const ticketChannel = await client.channels.fetch(ticketChannelId);
      if (ticketChannel) {
        const welcomeEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🎉 PARABÉNS! WHITELIST APROVADA!')
          .setDescription('**Sua whitelist foi aprovada! Bem-vindo à Cidade de Deus Roleplay!**')
          .addFields(
            { name: '🌆 Cidade de Deus', value: 'Sua jornada começa agora! A cidade está de portas abertas para você.' },
            { name: '📋 Próximos Passos', value: 'Você já pode acessar todos os canais do servidor. Leia as regras dos canais específicos.' },
            { name: '🎮 Comece a Jogar', value: 'Conecte-se ao servidor e crie sua história!' }
          )
          .setThumbnail(targetMember.user.displayAvatarURL())
          .setImage('https://i.imgur.com/your-welcome-image.png')
          .setFooter({ text: 'Divirta-se e respeite as regras • C.D.D RP' })
          .setTimestamp();
        
        await ticketChannel.send({
          content: `${targetMember.user}`,
          embeds: [welcomeEmbed]
        });
        
        // Botão para fechar ticket
        const closeButton = new ButtonBuilder()
          .setCustomId('close_ticket_staff')
          .setLabel('🔒 FECHAR TICKET')
          .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder().addComponents(closeButton);
        
        await ticketChannel.send({
          content: '✅ Whitelist aprovada! O ticket pode ser fechado.',
          components: [row]
        });
        
        // Fechar ticket automaticamente após 1 hora
        setTimeout(async () => {
          try {
            if (ticketChannel) {
              await ticketChannel.delete();
              activeTickets.delete(targetUserId);
              whitelistSessions.delete(targetUserId);
            }
          } catch (error) {
            console.error('Erro ao deletar canal:', error);
          }
        }, 3600000); // 1 hora
      }
    }
    
    // DM para o usuário
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 WHITELIST APROVADA!')
        .setDescription('**Parabéns! Sua whitelist para Cidade de Deus RP foi aprovada!**')
        .addFields(
          { name: '✅ Status', value: 'Aprovado', inline: true },
          { name: '🌆 Servidor', value: interaction.guild.name, inline: true },
          { name: '👤 Aprovado por', value: interaction.user.tag, inline: true }
        )
        .setFooter({ text: 'Bem-vindo à família C.D.D! • Boa jogatina!' })
        .setTimestamp();
      
      await targetMember.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.error('Erro ao enviar DM:', error);
    }
    
  } catch (error) {
    console.error('Erro na aprovação:', error);
    await interaction.followUp({
      content: '❌ Erro ao processar aprovação.',
      ephemeral: true
    });
  }
}

// ============================================
// HANDLER: SELECT MENU
// ============================================
async function handleSelectMenu(interaction) {
  // Para futuras expansões (ex: seleção de profissão)
}

// ============================================
// MODAL: MOTIVO DE REPROVAÇÃO
// ============================================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  if (interaction.customId.startsWith('reject_reason_')) {
    const targetUserId = interaction.customId.split('_')[2];
    const reason = interaction.fields.getTextInputValue('reject_reason');
    
    try {
      const targetMember = await interaction.guild.members.fetch(targetUserId);
      const ticketChannelId = activeTickets.get(targetUserId);
      
      statistics.rejected++;
      statistics.pending = activeTickets.size - 1;
      
      // Remover cargo pendente
      try {
        await targetMember.roles.remove(config.pendingRole);
      } catch (error) {
        console.error('Erro ao remover cargo pendente:', error);
      }
      
      // Embed de reprovação nos logs
      const rejectedEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ WHITELIST REPROVADA')
        .setDescription(`**Usuário:** ${targetMember.user.tag}\n**Reprovado por:** ${interaction.user.tag}`)
        .addFields({ name: '📝 Motivo', value: reason })
        .setTimestamp();
      
      // Encontrar mensagem original e editar
      const messages = await interaction.channel.messages.fetch({ limit: 10 });
      const targetMessage = messages.find(m => 
        m.components.length > 0 && 
        m.components[0].components.some(c => c.customId?.includes(targetUserId))
      );
      
      if (targetMessage) {
        await targetMessage.edit({
          embeds: [rejectedEmbed],
          components: []
        });
      }
      
      // Mensagem no ticket
      if (ticketChannelId) {
        const ticketChannel = await client.channels.fetch(ticketChannelId);
        if (ticketChannel) {
          const rejectTicketEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ WHITELIST REPROVADA')
            .setDescription('**Infelizmente sua whitelist não foi aprovada.**')
            .addFields(
              { name: '📝 Motivo da Reprovação', value: reason },
              { name: '🔄 Refazer Whitelist', value: 'Você pode abrir um novo ticket usando `/whitelist` após 1 hora.' },
              { name: '💡 Dica', value: 'Revise as regras e capriche mais nas respostas da próxima vez!' }
            )
            .setFooter({ text: 'Não desanime! Estude mais e tente novamente.' });
          
          await ticketChannel.send({
            content: `${targetMember.user}`,
            embeds: [rejectTicketEmbed]
          });
          
          // Botão para fechar ticket
          const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket_staff')
            .setLabel('🔒 FECHAR TICKET')
            .setStyle(ButtonStyle.Danger);
          
          const row = new ActionRowBuilder().addComponents(closeButton);
          
          await ticketChannel.send({
            components: [row]
          });
          
          // Fechar ticket após 10 minutos
          setTimeout(async () => {
            try {
              await ticketChannel.delete();
              activeTickets.delete(targetUserId);
              whitelistSessions.delete(targetUserId);
              
              // Adicionar cooldown de 1 hora
              cooldowns.set(targetUserId, Date.now() + 3600000);
              
              // Limpar cooldown após expirar
              setTimeout(() => cooldowns.delete(targetUserId), 3600000);
            } catch (error) {
              console.error('Erro ao deletar canal:', error);
            }
          }, 600000); // 10 minutos
        }
      }
      
      // DM para o usuário
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ WHITELIST REPROVADA')
          .setDescription('**Sua whitelist para Cidade de Deus RP foi reprovada.**')
          .addFields(
            { name: '📝 Motivo', value: reason },
            { name: '🔄 Próximos Passos', value: 'Você pode abrir um novo ticket e tentar novamente após 1 hora.' },
            { name: '📚 Recomendação', value: 'Estude as regras do servidor antes de reaplicar!' }
          )
          .setFooter({ text: 'Não desista! Aprimore-se e tente novamente.' })
          .setTimestamp();
        
        await targetMember.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.error('Erro ao enviar DM:', error);
      }
      
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Whitelist Reprovada')
            .setDescription(`Whitelist de ${targetMember.user.tag} foi reprovada com sucesso.`)
        ],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Erro na reprovação:', error);
      await interaction.reply({
        content: '❌ Erro ao reprovar whitelist.',
        ephemeral: true
      });
    }
  }
});

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400000);
  const hours = Math.floor(uptime / 3600000) % 24;
  const minutes = Math.floor(uptime / 60000) % 60;
  const seconds = Math.floor(uptime / 1000) % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

async function handleError(interaction, error) {
  console.error('Erro tratado:', error);
  
  const errorEmbed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('❌ ERRO NO SISTEMA')
    .setDescription('Ocorreu um erro ao processar sua solicitação.')
    .addFields({ name: '🔍 Detalhes', value: `\`\`\`${error.message || 'Erro desconhecido'}\`\`\`` })
    .setFooter({ text: 'Contate um administrador se o problema persistir' });
  
  try {
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else if (interaction.replied) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  } catch (e) {
    console.error('Erro ao enviar mensagem de erro:', e);
  }
}

// ============================================
// PROCESSO DE EXIT GRACEFUL
// ============================================
process.on('SIGINT', async () => {
  console.log('\n🔄 Encerrando bot graciosamente...');
  
  // Limpar todos os coletores
  activeTickets.clear();
  whitelistSessions.clear();
  cooldowns.clear();
  
  // Destruir cliente
  await client.destroy();
  
  console.log('👋 Bot encerrado com sucesso!');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Erro não tratado (Promise):', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
});

// ============================================
// INICIAR BOT
// ============================================
client.login(config.token).catch(error => {
  console.error('❌ Erro ao fazer login:', error);
  process.exit(1);
});

// ============================================
// EXPORTAÇÕES
// ============================================
module.exports = {
  client,
  config,
  activeTickets,
  whitelistSessions,
  statistics
};

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║         🤖 BOT WHITELIST C.D.D - CIDADE DE DEUS RP v2.0          ║
║                    Sistema Profissional Completo                 ║
║                                                                  ║
║         ✅ Discord.js v14                                        ║
║         ✅ Sistema de Whitelist Automatizado                     ║
║         ✅ Embed Interativo no Canal                             ║
║         ✅ Painel de Controle STAFF                              ║
║         ✅ Estatísticas em Tempo Real                            ║
║         ✅ Multi-servidor                                        ║
║         ✅ Totalmente Configurável via .env                      ║
║                                                                  ║
║         🌆 Cidade de Deus Roleplay                              ║
║         📋 Comandos Slash + Prefix                               ║
║         🎮 Sistema Completo de Whitelist                         ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

📋 Configuração carregada do .env
🎮 Iniciando bot...
🌆 Bem-vindo à Cidade de Deus!
`);