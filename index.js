// ============================================
// BOT WHITELIST C.D.D - Cidade de Deus RP
// Sistema completo de whitelist automatizado
// discord.js v14 - Versão Corrigida
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
  Events,
  AttachmentBuilder,
  MessageFlags
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
const activeTickets = new Collection();
const whitelistSessions = new Collection();
const cooldowns = new Collection();
const ticketMessageId = new Collection();

// ============================================
// SISTEMA DE ESTATÍSTICAS
// ============================================
const statistics = {
  totalWhitelists: 0,
  approved: 0,
  rejected: 0,
  pending: 0
};

// ============================================
// FUNÇÃO AUXILIAR PARA REPLY SEGURO
// ============================================
async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(options);
    } else {
      return await interaction.reply(options);
    }
  } catch (error) {
    console.error('Erro ao responder interação:', error);
    return null;
  }
}

// ============================================
// FUNÇÃO AUXILIAR PARA DEFER REPLY
// ============================================
async function safeDeferReply(interaction, ephemeral = true) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
      await interaction.deferReply({ flags });
    }
  } catch (error) {
    console.error('Erro ao deferir reply:', error);
  }
}

// ============================================
// EVENTO: BOT PRONTO
// ============================================
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.tag} está online!`);
  console.log(`📊 Servindo ${client.guilds.cache.size} servidores`);
  
  updateBotStatus();
  setInterval(updateBotStatus, 300000);
  
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
          { name: '📊 Status', value: '✅ Operacional', inline: true }
        )
        .setTimestamp();
      
      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem de inicialização:', error);
  }
  
  await registerSlashCommands();
  await setupWhitelistEmbeds();
});

// ============================================
// ATUALIZAR STATUS DO BOT
// ============================================
function updateBotStatus() {
  const activities = [
    { name: '🌆 Cidade de Deus RP', type: 3 },
    { name: `${activeTickets.size} whitelists ativas`, type: 3 },
    { name: '/whitelist para começar', type: 2 }
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
      
      const messages = await channel.messages.fetch({ limit: 10 });
      const existingEmbed = messages.find(m => 
        m.author.id === client.user.id && 
        m.embeds.length > 0
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
    `)
    .setFooter({ text: 'Cidade de Deus Roleplay • Sistema de Whitelist' })
    .setTimestamp();

  const startButton = new ButtonBuilder()
    .setCustomId('start_whitelist_ticket')
    .setLabel('📝 INICIAR WHITELIST')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🌟');

  const rulesButton = new ButtonBuilder()
    .setCustomId('show_rules')
    .setLabel('📜 REGRAS')
    .setStyle(ButtonStyle.Secondary);

  const statusButton = new ButtonBuilder()
    .setCustomId('check_status')
    .setLabel('🔍 STATUS')
    .setStyle(ButtonStyle.Primary);

  const helpButton = new ButtonBuilder()
    .setCustomId('whitelist_help')
    .setLabel('❓ AJUDA')
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(startButton, rulesButton);
  const row2 = new ActionRowBuilder().addComponents(statusButton, helpButton);

  const message = await channel.send({
    embeds: [mainEmbed],
    components: [row1, row2]
  });
  
  ticketMessageId.set(channel.guild.id, message.id);
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
// EVENTO: GUILD CREATE
// ============================================
client.on(Events.GuildCreate, async (guild) => {
  console.log(`📥 Bot adicionado ao servidor: ${guild.name}`);
  
  try {
    const whitelistChannel = await guild.channels.fetch(config.whitelistChannel).catch(() => null);
    if (whitelistChannel) {
      await createWhitelistEmbed(whitelistChannel);
    }
  } catch (error) {
    console.error('Erro ao configurar novo servidor:', error);
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
      }
    ];
    
    await client.application.commands.set(commands);
    console.log('✅ Comandos slash registrados!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
}

// ============================================
// EVENTO: INTERACTION CREATE
// ============================================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
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
  }
}

// ============================================
// HANDLER: COMANDO WHITELIST
// ============================================
async function handleWhitelistCommand(interaction) {
  await safeDeferReply(interaction);
  
  const userId = interaction.user.id;
  const guild = interaction.guild;
  const member = await guild.members.fetch(userId);
  
  if (member.roles.cache.has(config.approvedRole)) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Whitelist já Aprovada')
          .setDescription('Você já possui whitelist aprovada!')
      ]
    });
  }
  
  if (activeTickets.has(userId)) {
    const existingChannel = activeTickets.get(userId);
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Ticket já Existente')
          .setDescription(`Você já possui um ticket ativo em <#${existingChannel}>`)
      ]
    });
  }
  
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
        ]
      });
    }
  }
  
  try {
    const category = await guild.channels.fetch(config.categoryId);
    if (!category) {
      return interaction.editReply({
        content: '❌ Erro: Categoria de whitelist não configurada.'
      });
    }
    
    const channelName = `whitelist-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: userId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: config.staffRole,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
        }
      ]
    });
    
    activeTickets.set(userId, channel.id);
    whitelistSessions.set(userId, {
      step: 0,
      answers: {},
      channelId: channel.id,
      startedAt: Date.now(),
      userId: userId,
      userTag: interaction.user.tag
    });
    
    statistics.totalWhitelists++;
    
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Ticket Criado!')
          .setDescription(`Seu ticket foi criado em ${channel}`)
      ]
    });
    
    try {
      await member.roles.add(config.pendingRole);
    } catch (error) {
      console.error('Erro ao adicionar cargo pendente:', error);
    }
    
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🌆 BEM-VINDO À CIDADE DE DEUS RP')
      .setDescription(`**Olá ${interaction.user}, sua jornada começa agora!**`)
      .addFields(
        { name: '📋 PROCESSO', value: 'Responda as 3 etapas de perguntas.' },
        { name: '📝 DICA', value: 'Quanto mais detalhadas as respostas, maiores as chances!' }
      )
      .setFooter({ text: 'Clique no botão abaixo para começar' });
    
    const startButton = new ButtonBuilder()
      .setCustomId('start_whitelist_form')
      .setLabel('📝 INICIAR WHITELIST')
      .setStyle(ButtonStyle.Success);
    
    const row = new ActionRowBuilder().addComponents(startButton);
    
    await channel.send({
      content: `${interaction.user}`,
      embeds: [welcomeEmbed],
      components: [row]
    });
    
  } catch (error) {
    console.error('Erro ao criar ticket:', error);
    await interaction.editReply({
      content: '❌ Erro ao criar ticket. Contate um administrador.'
    });
  }
}

// ============================================
// HANDLER: COMANDO FECHAR
// ============================================
async function handleCloseCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('❌ Acesso Negado').setDescription('Apenas STAFF pode usar este comando.')],
      flags: MessageFlags.Ephemeral
    });
  }
  
  const channel = interaction.channel;
  
  if (!channel.name.startsWith('whitelist-')) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('❌ Canal Inválido')],
      flags: MessageFlags.Ephemeral
    });
  }
  
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor('#FFA500').setTitle('🔒 Fechando Ticket').setDescription('Fechando em 5 segundos...')]
  });
  
  setTimeout(async () => {
    try {
      for (const [userId, channelId] of activeTickets.entries()) {
        if (channelId === channel.id) {
          activeTickets.delete(userId);
          whitelistSessions.delete(userId);
          break;
        }
      }
      await channel.delete();
    } catch (error) {
      console.error('Erro ao fechar canal:', error);
    }
  }, 5000);
}

// ============================================
// HANDLER: COMANDO STATUS
// ============================================
async function handleStatusCommand(interaction) {
  const userId = interaction.user.id;
  const member = await interaction.guild.members.fetch(userId);
  
  if (member.roles.cache.has(config.approvedRole)) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#00FF00').setTitle('✅ Whitelist Aprovada').setDescription('Sua whitelist já foi aprovada!')],
      flags: MessageFlags.Ephemeral
    });
  }
  
  if (activeTickets.has(userId)) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#FFA500').setTitle('⏳ Whitelist em Análise').setDescription(`Sua whitelist está em análise. Ticket: <#${activeTickets.get(userId)}>`)],
      flags: MessageFlags.Ephemeral
    });
  }
  
  return interaction.reply({
    embeds: [new EmbedBuilder().setColor('#0099FF').setTitle('📋 Nenhuma Whitelist Ativa').setDescription('Use `/whitelist` para começar.')],
    flags: MessageFlags.Ephemeral
  });
}

// ============================================
// HANDLER: COMANDO REVISAR
// ============================================
async function handleReviewCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas STAFF pode usar este comando.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  if (activeTickets.size === 0) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#00FF00').setTitle('✅ Nenhuma Whitelist Pendente')],
      flags: MessageFlags.Ephemeral
    });
  }
  
  const pendingList = [];
  for (const [userId, channelId] of activeTickets) {
    pendingList.push(`• <@${userId}> - <#${channelId}>`);
  }
  
  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('📋 Whitelists Pendentes')
    .setDescription(pendingList.join('\n'))
    .setFooter({ text: `Total: ${activeTickets.size}` });
  
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================
// HANDLER: COMANDO ESTATÍSTICAS
// ============================================
async function handleStatsCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas STAFF pode usar este comando.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#4169E1')
    .setTitle('📊 Estatísticas do Sistema')
    .addFields(
      { name: '📋 Total', value: `${statistics.totalWhitelists}`, inline: true },
      { name: '✅ Aprovadas', value: `${statistics.approved}`, inline: true },
      { name: '❌ Reprovadas', value: `${statistics.rejected}`, inline: true },
      { name: '⏳ Pendentes', value: `${activeTickets.size}`, inline: true },
      { name: '📈 Taxa de Aprovação', value: `${calculateApprovalRate()}%`, inline: true }
    );
  
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================
// HANDLER: COMANDO LIMPAR
// ============================================
async function handleCleanCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas STAFF pode usar este comando.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  await safeDeferReply(interaction);
  
  const category = await interaction.guild.channels.fetch(config.categoryId);
  const channels = category.children.cache.filter(c => c.name.startsWith('whitelist-'));
  
  let deleted = 0;
  for (const channel of channels.values()) {
    const messages = await channel.messages.fetch({ limit: 1 });
    if (messages.size === 0 || Date.now() - messages.first().createdTimestamp > 86400000) {
      try {
        await channel.delete();
        deleted++;
      } catch (error) {
        console.error(`Erro ao deletar canal:`, error);
      }
    }
  }
  
  await interaction.editReply({ content: `✅ Limpeza concluída! ${deleted} canais removidos.` });
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
    case 'regras':
      await handlePrefixRules(message);
      break;
  }
});

// ============================================
// PREFIX: STATUS
// ============================================
async function handlePrefixStatus(message) {
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('📊 Status do Sistema')
    .addFields(
      { name: '📋 Tickets Ativos', value: `${activeTickets.size}`, inline: true },
      { name: '🏓 Ping', value: `${client.ws.ping}ms`, inline: true }
    );
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// PREFIX: PING
// ============================================
async function handlePrefixPing(message) {
  await message.reply(`🏓 Pong! Latência: ${client.ws.ping}ms`);
}

// ============================================
// PREFIX: HELP
// ============================================
async function handlePrefixHelp(message) {
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('📚 Central de Ajuda')
    .addFields(
      { name: '📋 Comandos Slash', value: '`/whitelist` - Iniciar whitelist\n`/status` - Verificar status\n`/fechar` - Fechar ticket (STAFF)' },
      { name: '🔧 Comandos Prefix', value: '`!status` - Status\n`!ping` - Ping\n`!help` - Ajuda\n`!regras` - Regras' }
    );
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// PREFIX: REGRAS
// ============================================
async function handlePrefixRules(message) {
  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('📜 REGRAS DA CIDADE DE DEUS RP')
    .setDescription('**Leia atentamente!**')
    .addFields(
      { name: '🚫 REGRAS GERAIS', value: '• Respeito acima de tudo\n• Sem preconceito ou discriminação' },
      { name: '🎭 REGRAS DE RP', value: '• RDM - PROIBIDO\n• VDM - PROIBIDO\n• Metagaming - PROIBIDO\n• Powergaming - PROIBIDO' }
    );
  
  await message.reply({ embeds: [embed] });
}

// ============================================
// HANDLER: BOTÕES
// ============================================
async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  
  // Botão do Embed Principal - Iniciar Whitelist
  if (customId === 'start_whitelist_ticket') {
    await safeDeferReply(interaction);
    await handleWhitelistCommand(interaction);
  }
  
  // Botão: Mostrar Regras
  else if (customId === 'show_rules') {
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('📜 REGRAS DA CIDADE DE DEUS RP')
      .addFields(
        { name: '🚫 REGRAS GERAIS', value: '• Respeito acima de tudo\n• Sem preconceito' },
        { name: '🎭 REGRAS DE RP', value: '• RDM - PROIBIDO\n• VDM - PROIBIDO\n• Metagaming - PROIBIDO' }
      );
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
  
  // Botão: Verificar Status
  else if (customId === 'check_status') {
    await handleStatusCommand(interaction);
  }
  
  // Botão: Ajuda
  else if (customId === 'whitelist_help') {
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('❓ Ajuda - Whitelist')
      .setDescription('Use `/whitelist` para iniciar o processo.')
      .addFields({ name: '📋 Etapas', value: '1. Regras de RP\n2. Raciocínio Lógico\n3. Lore do Personagem' });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
  
  // Botão: Iniciar Formulário
  else if (customId === 'start_whitelist_form') {
    const session = whitelistSessions.get(userId);
    if (!session) {
      return interaction.reply({
        content: '❌ Sessão não encontrada.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('📋 ETAPA 1 - REGRAS DE ROLEPLAY')
      .setDescription('**Responda as perguntas sobre regras básicas.**')
      .addFields({
        name: '📌 PERGUNTAS',
        value: '1. Nome do personagem\n2. Idade\n3. Já jogou RP?\n4. O que é RDM/VDM?\n5. Regras importantes'
      });
    
    const button = new ButtonBuilder()
      .setCustomId('next_page')
      .setLabel('📝 RESPONDER')
      .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await interaction.reply({ embeds: [embed], components: [row] });
  }
  
  // Botão: Próxima Página
  else if (customId === 'next_page') {
    const session = whitelistSessions.get(userId);
    if (!session) {
      return interaction.reply({
        content: '❌ Sessão não encontrada.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    if (session.step === 0 || session.step === 1) {
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
}

// ============================================
// PÁGINA 1 MODAL
// ============================================
async function showPage1Modal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('page1_modal')
    .setTitle('Etapa 1 - Regras de RP');
  
  const nameInput = new TextInputBuilder()
    .setCustomId('char_name')
    .setLabel('👤 Nome do personagem')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(50);
  
  const ageInput = new TextInputBuilder()
    .setCustomId('char_age')
    .setLabel('🎂 Idade do personagem')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);
  
  const rpExperienceInput = new TextInputBuilder()
    .setCustomId('rp_experience')
    .setLabel('🎮 Já jogou RP antes?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(500);
  
  const rdmVdmInput = new TextInputBuilder()
    .setCustomId('rdm_vdm')
    .setLabel('⚠️ O que é RDM e VDM?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const rulesInput = new TextInputBuilder()
    .setCustomId('server_rules')
    .setLabel('📜 Regras importantes do servidor')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
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
// PÁGINA 2 MODAL
// ============================================
async function showPage2Modal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('page2_modal')
    .setTitle('Etapa 2 - Raciocínio Lógico');
  
  const policeInput = new TextInputBuilder()
    .setCustomId('police_approach')
    .setLabel('👮 Abordado pela polícia?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const robberyInput = new TextInputBuilder()
    .setCustomId('robbery_reaction')
    .setLabel('💰 Como reagiria a um assalto?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const metagamingInput = new TextInputBuilder()
    .setCustomId('metagaming')
    .setLabel('🎭 O que é metagaming?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const powergamingInput = new TextInputBuilder()
    .setCustomId('powergaming')
    .setLabel('💪 O que é powergaming?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const rpSituationInput = new TextInputBuilder()
    .setCustomId('rp_situation')
    .setLabel('🎬 Situação de RP vivida')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
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
// LORE MODAL
// ============================================
async function showLoreModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('lore_modal')
    .setTitle('Etapa 3 - Lore do Personagem');
  
  const historyInput = new TextInputBuilder()
    .setCustomId('char_history')
    .setLabel('📚 História do personagem')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(50)
    .setMaxLength(4000);
  
  const personalityInput = new TextInputBuilder()
    .setCustomId('char_personality')
    .setLabel('🎭 Personalidade')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(1000);
  
  const objectiveInput = new TextInputBuilder()
    .setCustomId('char_objective')
    .setLabel('🎯 Objetivo na cidade')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(1000);
  
  const professionInput = new TextInputBuilder()
    .setCustomId('char_profession')
    .setLabel('💼 Profissão pretendida')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(100);
  
  const relationsInput = new TextInputBuilder()
    .setCustomId('char_relations')
    .setLabel('🤝 Relações e conexões')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
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
// HANDLER: MODAL SUBMIT
// ============================================
async function handleModalSubmit(interaction) {
  const userId = interaction.user.id;
  const session = whitelistSessions.get(userId);
  
  if (!session) {
    return interaction.reply({
      content: '❌ Sessão expirada.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  // Página 1 Modal
  if (interaction.customId === 'page1_modal') {
    const charName = interaction.fields.getTextInputValue('char_name');
    const charAge = interaction.fields.getTextInputValue('char_age');
    const rpExperience = interaction.fields.getTextInputValue('rp_experience');
    const rdmVdm = interaction.fields.getTextInputValue('rdm_vdm');
    const serverRules = interaction.fields.getTextInputValue('server_rules');
    
    const age = parseInt(charAge);
    if (isNaN(age) || age < 16 || age > 100) {
      return interaction.reply({
        content: '❌ Idade deve ser entre 16 e 100 anos.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    session.answers.page1 = { charName, charAge: age, rpExperience, rdmVdm, serverRules };
    session.step = 2;
    
    await interaction.reply({
      content: '✅ Etapa 1 concluída!',
      flags: MessageFlags.Ephemeral
    });
    
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('📋 ETAPA 2 - RACIOCÍNIO LÓGICO')
      .setDescription('**Agora vamos testar seu raciocínio.**')
      .addFields({
        name: '📌 PERGUNTAS',
        value: '1. Abordagem policial\n2. Reação a assalto\n3. Metagaming\n4. Powergaming\n5. Situação de RP'
      });
    
    const button = new ButtonBuilder()
      .setCustomId('next_page')
      .setLabel('📝 RESPONDER')
      .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await interaction.channel.send({ embeds: [embed], components: [row] });
  }
  
  // Página 2 Modal
  else if (interaction.customId === 'page2_modal') {
    const policeApproach = interaction.fields.getTextInputValue('police_approach');
    const robberyReaction = interaction.fields.getTextInputValue('robbery_reaction');
    const metagaming = interaction.fields.getTextInputValue('metagaming');
    const powergaming = interaction.fields.getTextInputValue('powergaming');
    const rpSituation = interaction.fields.getTextInputValue('rp_situation');
    
    session.answers.page2 = { policeApproach, robberyReaction, metagaming, powergaming, rpSituation };
    
    await interaction.reply({
      content: '✅ Etapa 2 concluída!',
      flags: MessageFlags.Ephemeral
    });
    
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📋 WHITELIST - QUASE LÁ!')
      .setDescription('**Você completou as etapas obrigatórias!**')
      .addFields(
        { name: '✅ OPÇÃO 1', value: 'Enviar para análise', inline: true },
        { name: '📖 OPÇÃO 2', value: 'Adicionar Lore (recomendado)', inline: true }
      );
    
    const submitButton = new ButtonBuilder()
      .setCustomId('submit_whitelist')
      .setLabel('✅ ENVIAR')
      .setStyle(ButtonStyle.Success);
    
    const loreButton = new ButtonBuilder()
      .setCustomId('submit_lore')
      .setLabel('📖 ADICIONAR LORE')
      .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(submitButton, loreButton);
    
    await interaction.channel.send({ embeds: [embed], components: [row] });
  }
  
  // Lore Modal
  else if (interaction.customId === 'lore_modal') {
    const charHistory = interaction.fields.getTextInputValue('char_history');
    const charPersonality = interaction.fields.getTextInputValue('char_personality');
    const charObjective = interaction.fields.getTextInputValue('char_objective');
    const charProfession = interaction.fields.getTextInputValue('char_profession');
    const charRelations = interaction.fields.getTextInputValue('char_relations');
    
    session.answers.lore = { charHistory, charPersonality, charObjective, charProfession, charRelations };
    
    await interaction.reply({
      content: '✅ Lore adicionada!',
      flags: MessageFlags.Ephemeral
    });
    
    const embed = new EmbedBuilder()
      .setColor('#9370DB')
      .setTitle('✨ LORE ADICIONADA!')
      .setDescription('**Clique abaixo para enviar para análise.**');
    
    const submitButton = new ButtonBuilder()
      .setCustomId('submit_whitelist')
      .setLabel('✅ ENVIAR')
      .setStyle(ButtonStyle.Success);
    
    const row = new ActionRowBuilder().addComponents(submitButton);
    
    await interaction.channel.send({ embeds: [embed], components: [row] });
  }
}

// ============================================
// SUBMIT WHITELIST
// ============================================
async function submitWhitelist(interaction) {
  const userId = interaction.user.id;
  const session = whitelistSessions.get(userId);
  
  if (!session || !session.answers.page1 || !session.answers.page2) {
    return interaction.reply({
      content: '❌ Complete as etapas 1 e 2 primeiro!',
      flags: MessageFlags.Ephemeral
    });
  }
  
  await interaction.reply({
    content: '📤 Enviando para análise...',
    flags: MessageFlags.Ephemeral
  });
  
  try {
    const logChannel = await client.channels.fetch(config.whitelistLog);
    
    const mainEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle(`📋 WHITELIST - ${interaction.user.tag}`)
      .setDescription(`**ID:** ${interaction.user.id}`)
      .addFields(
        { name: '━━━ ETAPA 1 ━━━', value: '**Regras de RP**' },
        { name: '👤 Personagem', value: session.answers.page1.charName, inline: true },
        { name: '🎂 Idade', value: `${session.answers.page1.charAge}`, inline: true },
        { name: '🎮 Experiência', value: session.answers.page1.rpExperience },
        { name: '⚠️ RDM/VDM', value: session.answers.page1.rdmVdm },
        { name: '📜 Regras', value: session.answers.page1.serverRules },
        { name: '━━━ ETAPA 2 ━━━', value: '**Raciocínio Lógico**' },
        { name: '👮 Abordagem', value: session.answers.page2.policeApproach },
        { name: '💰 Assalto', value: session.answers.page2.robberyReaction },
        { name: '🎭 Metagaming', value: session.answers.page2.metagaming },
        { name: '💪 Powergaming', value: session.answers.page2.powergaming },
        { name: '🎬 Situação', value: session.answers.page2.rpSituation }
      )
      .setTimestamp();
    
    await logChannel.send({ embeds: [mainEmbed] });
    
    if (session.answers.lore) {
      const loreEmbed = new EmbedBuilder()
        .setColor('#9370DB')
        .setTitle(`📖 LORE - ${session.answers.page1.charName}`)
        .addFields(
          { name: '📚 História', value: session.answers.lore.charHistory },
          { name: '🎭 Personalidade', value: session.answers.lore.charPersonality },
          { name: '🎯 Objetivo', value: session.answers.lore.charObjective },
          { name: '💼 Profissão', value: session.answers.lore.charProfession }
        );
      
      await logChannel.send({ embeds: [loreEmbed] });
    }
    
    const approveButton = new ButtonBuilder()
      .setCustomId(`approve_${userId}`)
      .setLabel('✅ APROVAR')
      .setStyle(ButtonStyle.Success);
    
    const rejectButton = new ButtonBuilder()
      .setCustomId(`reject_${userId}`)
      .setLabel('❌ REPROVAR')
      .setStyle(ButtonStyle.Danger);
    
    const row = new ActionRowBuilder().addComponents(approveButton, rejectButton);
    
    await logChannel.send({
      content: `📋 **NOVA WHITELIST**\n👤 ${interaction.user}\n🎫 ${interaction.channel}`,
      components: [row]
    });
    
    const pendingEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⏳ WHITELIST EM ANÁLISE')
      .setDescription('Sua whitelist foi enviada para análise.')
      .addFields(
        { name: '📊 Status', value: '⏳ Pendente' },
        { name: '⏱️ Prazo', value: 'Até 48 horas' }
      );
    
    await interaction.channel.send({ embeds: [pendingEmbed] });
    
  } catch (error) {
    console.error('Erro ao enviar whitelist:', error);
  }
}

// ============================================
// HANDLER: DECISÃO DA STAFF
// ============================================
async function handleStaffDecision(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas STAFF pode aprovar/reprovar.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  const isApproving = interaction.customId.startsWith('approve_');
  const targetUserId = interaction.customId.split('_')[1];
  
  try {
    const targetMember = await interaction.guild.members.fetch(targetUserId);
    const session = whitelistSessions.get(targetUserId);
    const ticketChannelId = activeTickets.get(targetUserId);
    
    if (!isApproving) {
      const modal = new ModalBuilder()
        .setCustomId(`reject_reason_${targetUserId}`)
        .setTitle('Motivo da Reprovação');
      
      const reasonInput = new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('📝 Motivo')
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
    
    try {
      await targetMember.roles.remove(config.pendingRole);
      await targetMember.roles.add(config.approvedRole);
    } catch (error) {
      console.error('Erro ao gerenciar cargos:', error);
    }
    
    const approvedEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ WHITELIST APROVADA')
      .setDescription(`**Usuário:** ${targetMember.user.tag}\n**Aprovado por:** ${interaction.user.tag}`)
      .setTimestamp();
    
    await interaction.message.edit({ embeds: [approvedEmbed], components: [] });
    
    if (ticketChannelId) {
      const ticketChannel = await client.channels.fetch(ticketChannelId);
      if (ticketChannel) {
        const welcomeEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🎉 PARABÉNS! WHITELIST APROVADA!')
          .setDescription('Bem-vindo à Cidade de Deus Roleplay!');
        
        await ticketChannel.send({ content: `${targetMember.user}`, embeds: [welcomeEmbed] });
        
        setTimeout(async () => {
          try {
            await ticketChannel.delete();
            activeTickets.delete(targetUserId);
            whitelistSessions.delete(targetUserId);
          } catch (error) {
            console.error('Erro ao deletar canal:', error);
          }
        }, 3600000);
      }
    }
    
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 WHITELIST APROVADA!')
        .setDescription('Parabéns! Sua whitelist foi aprovada!');
      
      await targetMember.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.error('Erro ao enviar DM:', error);
    }
    
  } catch (error) {
    console.error('Erro na aprovação:', error);
  }
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
      
      try {
        await targetMember.roles.remove(config.pendingRole);
      } catch (error) {
        console.error('Erro ao remover cargo:', error);
      }
      
      const rejectedEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ WHITELIST REPROVADA')
        .setDescription(`**Usuário:** ${targetMember.user.tag}\n**Reprovado por:** ${interaction.user.tag}`)
        .addFields({ name: '📝 Motivo', value: reason })
        .setTimestamp();
      
      const messages = await interaction.channel.messages.fetch({ limit: 10 });
      const targetMessage = messages.find(m => 
        m.components.length > 0 && 
        m.components[0].components.some(c => c.customId?.includes(targetUserId))
      );
      
      if (targetMessage) {
        await targetMessage.edit({ embeds: [rejectedEmbed], components: [] });
      }
      
      if (ticketChannelId) {
        const ticketChannel = await client.channels.fetch(ticketChannelId);
        if (ticketChannel) {
          const rejectEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ WHITELIST REPROVADA')
            .setDescription('Infelizmente sua whitelist não foi aprovada.')
            .addFields({ name: '📝 Motivo', value: reason });
          
          await ticketChannel.send({ content: `${targetMember.user}`, embeds: [rejectEmbed] });
          
          setTimeout(async () => {
            try {
              await ticketChannel.delete();
              activeTickets.delete(targetUserId);
              whitelistSessions.delete(targetUserId);
              cooldowns.set(targetUserId, Date.now() + 3600000);
            } catch (error) {
              console.error('Erro ao deletar canal:', error);
            }
          }, 600000);
        }
      }
      
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ WHITELIST REPROVADA')
          .setDescription('Sua whitelist foi reprovada.')
          .addFields({ name: '📝 Motivo', value: reason });
        
        await targetMember.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.error('Erro ao enviar DM:', error);
      }
      
      await interaction.reply({
        content: '✅ Whitelist reprovada com sucesso.',
        flags: MessageFlags.Ephemeral
      });
      
    } catch (error) {
      console.error('Erro na reprovação:', error);
      await interaction.reply({
        content: '❌ Erro ao reprovar.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
});

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================
async function handleError(interaction, error) {
  console.error('Erro tratado:', error);
  
  const errorMessage = {
    content: '❌ Ocorreu um erro ao processar sua solicitação.',
    flags: MessageFlags.Ephemeral
  };
  
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(errorMessage);
    } else {
      await interaction.followUp(errorMessage);
    }
  } catch (e) {
    console.error('Erro ao enviar mensagem de erro:', e);
  }
}

// ============================================
// INICIAR BOT
// ============================================
client.login(config.token).catch(error => {
  console.error('❌ Erro ao fazer login:', error);
  process.exit(1);
});

console.log(`
╔══════════════════════════════════════════════════════════╗
║         🤖 BOT WHITELIST C.D.D - CIDADE DE DEUS RP       ║
║                    Sistema Profissional v2.0             ║
║         ✅ Discord.js v14                                ║
║         ✅ Sistema Corrigido e Otimizado                 ║
╚══════════════════════════════════════════════════════════╝
`);