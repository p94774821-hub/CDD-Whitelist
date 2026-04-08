// ============================================
// BOT WHITELIST C.D.D - Cidade de Deus RP
// Sistema completo de whitelist automatizado
// discord.js v14
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
  Events
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
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// ============================================
// COLETORES E CACHE
// ============================================
const activeTickets = new Collection(); // userId -> channelId
const whitelistSessions = new Collection(); // userId -> sessionData
const cooldowns = new Collection(); // userId -> timestamp

// ============================================
// EVENTO: BOT PRONTO
// ============================================
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.tag} está online!`);
  console.log(`📊 Servindo ${client.guilds.cache.size} servidores`);
  
  // Enviar mensagem no canal de logs
  try {
    const logChannel = await client.channels.fetch(config.whitelistLog);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🟢 Bot Online')
        .setDescription('Sistema de whitelist ativo e pronto para uso.')
        .addFields(
          { name: 'Bot', value: client.user.tag, inline: true },
          { name: 'Servidores', value: `${client.guilds.cache.size}`, inline: true },
          { name: 'Status', value: 'Operacional', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'C.D.D Roleplay - Sistema de Whitelist' });
      
      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem de inicialização:', error);
  }
  
  // Registrar comandos slash
  await registerSlashCommands();
});

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
      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('🤖 Bot Whitelist C.D.D')
        .setDescription('**Obrigado por me adicionar!**\nSistema de whitelist ativo e pronto para uso.')
        .addFields(
          { name: '📋 Comando Principal', value: '`/whitelist` - Iniciar processo de whitelist' },
          { name: '⚙️ Configuração', value: 'Configure as variáveis no arquivo `.env`' },
          { name: '👑 Owner', value: `<@${config.ownerId}>` }
        )
        .setFooter({ text: 'Cidade de Deus RP - Sistema Profissional' })
        .setTimestamp();
      
      await targetChannel.send({ embeds: [embed] });
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
      if (interaction.commandName === 'whitelist') {
        await handleWhitelistCommand(interaction);
      } else if (interaction.commandName === 'fechar') {
        await handleCloseCommand(interaction);
      }
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
    
    // Prefix Commands (!)
    else if (interaction.isMessageContextMenuCommand() || interaction.isUserContextMenuCommand()) {
      // Não implementado
    }
  } catch (error) {
    console.error('Erro na interação:', error);
    await handleError(interaction, error);
  }
});

// ============================================
// EVENTO: MESSAGE CREATE (PREFIX COMMANDS)
// ============================================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;
  
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  // Comando: !status
  if (command === 'status') {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('📊 Status do Sistema')
      .setDescription('Sistema de Whitelist C.D.D RP')
      .addFields(
        { name: 'Tickets Ativos', value: `${activeTickets.size}`, inline: true },
        { name: 'Sessões Ativas', value: `${whitelistSessions.size}`, inline: true },
        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Uptime', value: formatUptime(client.uptime), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Cidade de Deus RP' });
    
    await message.reply({ embeds: [embed] });
  }
  
  // Comando: !ping
  else if (command === 'ping') {
    await message.reply(`🏓 Pong! Latência: ${client.ws.ping}ms`);
  }
  
  // Comando: !help
  else if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('📚 Ajuda - Bot Whitelist C.D.D')
      .setDescription('Sistema de whitelist automatizado para Cidade de Deus RP')
      .addFields(
        { name: '📋 Comandos Slash', value: '`/whitelist` - Iniciar whitelist\n`/fechar` - Fechar ticket (STAFF)' },
        { name: '🔧 Comandos Prefix (!)', value: '`!status` - Status do sistema\n`!ping` - Verificar latência\n`!help` - Esta mensagem' }
      )
      .setFooter({ text: 'Desenvolvido para C.D.D Roleplay' });
    
    await message.reply({ embeds: [embed] });
  }
});

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
      content: '✅ Você já possui whitelist aprovada! Bem-vindo à Cidade de Deus RP.',
      ephemeral: true
    });
  }
  
  // Verificar se já tem ticket ativo
  if (activeTickets.has(userId)) {
    const existingChannel = activeTickets.get(userId);
    return interaction.editReply({
      content: `❌ Você já possui um ticket de whitelist ativo em <#${existingChannel}>`,
      ephemeral: true
    });
  }
  
  // Verificar cooldown (1 hora)
  if (cooldowns.has(userId)) {
    const cooldownTime = cooldowns.get(userId);
    const timeLeft = Math.ceil((cooldownTime - Date.now()) / 1000 / 60);
    if (timeLeft > 0) {
      return interaction.editReply({
        content: `⏰ Aguarde ${timeLeft} minutos antes de abrir um novo ticket.`,
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
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          id: config.staffRole,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ]
    });
    
    // Registrar ticket
    activeTickets.set(userId, channel.id);
    
    // Inicializar sessão
    whitelistSessions.set(userId, {
      step: 1,
      answers: {},
      channelId: channel.id,
      startedAt: Date.now()
    });
    
    await interaction.editReply({
      content: `✅ Ticket criado com sucesso! Acesse ${channel}`,
      ephemeral: true
    });
    
    // Adicionar cargo pendente
    try {
      await member.roles.add(config.pendingRole);
    } catch (error) {
      console.error('Erro ao adicionar cargo pendente:', error);
    }
    
    // Enviar mensagem de boas-vindas
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🌆 Bem-vindo à Cidade de Deus RP')
      .setDescription(`Olá ${interaction.user}, inicie sua jornada na C.D.D!`)
      .addFields(
        { name: '📋 Processo de Whitelist', value: 'Você responderá a 3 páginas de perguntas para avaliarmos seu conhecimento de RP.' },
        { name: '⏱️ Tempo', value: 'Não há limite de tempo. Responda com calma e atenção.' },
        { name: '📝 Dica', value: 'Quanto mais detalhadas forem suas respostas, maiores as chances de aprovação!' }
      )
      .setFooter({ text: 'Clique no botão abaixo para começar' });
    
    const startButton = new ButtonBuilder()
      .setCustomId('start_whitelist')
      .setLabel('📝 Iniciar Whitelist')
      .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(startButton);
    
    await channel.send({
      content: `${interaction.user}`,
      embeds: [welcomeEmbed],
      components: [row]
    });
    
  } catch (error) {
    console.error('Erro ao criar ticket:', error);
    await interaction.editReply({
      content: '❌ Erro ao criar ticket. Contate um administrador.',
      ephemeral: true
    });
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
      content: '❌ Apenas membros da STAFF podem usar este comando.',
      ephemeral: true
    });
  }
  
  const channel = interaction.channel;
  
  // Verificar se é um canal de whitelist
  if (!channel.name.startsWith('whitelist-')) {
    return interaction.reply({
      content: '❌ Este comando só pode ser usado em canais de whitelist.',
      ephemeral: true
    });
  }
  
  await interaction.reply({
    content: '🔒 Fechando ticket em 5 segundos...',
    ephemeral: false
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
  const userId = interaction.user.id;
  const session = whitelistSessions.get(userId);
  
  // Botão: Iniciar Whitelist
  if (interaction.customId === 'start_whitelist') {
    if (!session || session.step !== 1) {
      return interaction.reply({
        content: '❌ Sessão inválida ou expirada.',
        ephemeral: true
      });
    }
    
    await showPage1(interaction);
  }
  
  // Botão: Próxima Página
  else if (interaction.customId === 'next_page') {
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
  else if (interaction.customId === 'submit_whitelist') {
    await submitWhitelist(interaction);
  }
  
  // Botões STAFF - Aprovar/Reprovar
  else if (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('reject_')) {
    await handleStaffDecision(interaction);
  }
  
  // Botão: Lore do Personagem
  else if (interaction.customId === 'submit_lore') {
    await showLoreModal(interaction);
  }
  
  // Botão: Fechar Ticket (STAFF)
  else if (interaction.customId === 'close_ticket_staff') {
    const member = await interaction.guild.members.fetch(userId);
    if (!member.roles.cache.has(config.staffRole) && userId !== config.ownerId) {
      return interaction.reply({
        content: '❌ Apenas STAFF pode usar este botão.',
        ephemeral: true
      });
    }
    
    await interaction.reply('🔒 Fechando ticket...');
    setTimeout(() => interaction.channel.delete(), 3000);
  }
}

// ============================================
// PÁGINA 1 - REGRAS DE RP
// ============================================
async function showPage1(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle('📋 Página 1 - Regras de RP')
    .setDescription('Responda as perguntas sobre regras básicas de Roleplay.')
    .addFields(
      { name: '📌 Perguntas', value: 
        '• Nome do personagem\n' +
        '• Idade do personagem\n' +
        '• Já jogou RP antes?\n' +
        '• O que é RDM e VDM?\n' +
        '• Cite regras importantes do servidor'
      }
    )
    .setFooter({ text: 'Clique no botão abaixo para responder' });
  
  const button = new ButtonBuilder()
    .setCustomId('next_page')
    .setLabel('📝 Responder Perguntas')
    .setStyle(ButtonStyle.Primary);
  
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
    .setTitle('Página 1 - Regras de RP');
  
  const nameInput = new TextInputBuilder()
    .setCustomId('char_name')
    .setLabel('Nome do personagem')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(50);
  
  const ageInput = new TextInputBuilder()
    .setCustomId('char_age')
    .setLabel('Idade do personagem')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);
  
  const rpExperienceInput = new TextInputBuilder()
    .setCustomId('rp_experience')
    .setLabel('Já jogou RP antes? Onde?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const rdmVdmInput = new TextInputBuilder()
    .setCustomId('rdm_vdm')
    .setLabel('O que é RDM e VDM?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const rulesInput = new TextInputBuilder()
    .setCustomId('server_rules')
    .setLabel('Cite regras importantes do servidor')
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
    .setTitle('Página 2 - Raciocínio Lógico');
  
  const policeInput = new TextInputBuilder()
    .setCustomId('police_approach')
    .setLabel('O que faria ao ser abordado pela polícia?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const robberyInput = new TextInputBuilder()
    .setCustomId('robbery_reaction')
    .setLabel('Como reagiria a um assalto?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const metagamingInput = new TextInputBuilder()
    .setCustomId('metagaming')
    .setLabel('O que é metagaming?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const powergamingInput = new TextInputBuilder()
    .setCustomId('powergaming')
    .setLabel('O que é powergaming?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500);
  
  const rpSituationInput = new TextInputBuilder()
    .setCustomId('rp_situation')
    .setLabel('Descreva uma situação de RP vivida')
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
    .setTitle('Página 3 - Lore do Personagem');
  
  const historyInput = new TextInputBuilder()
    .setCustomId('char_history')
    .setLabel('História do personagem (detalhada)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(100)
    .setMaxLength(4000);
  
  const personalityInput = new TextInputBuilder()
    .setCustomId('char_personality')
    .setLabel('Personalidade')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(50)
    .setMaxLength(1000);
  
  const objectiveInput = new TextInputBuilder()
    .setCustomId('char_objective')
    .setLabel('Objetivo na cidade')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(30)
    .setMaxLength(1000);
  
  const professionInput = new TextInputBuilder()
    .setCustomId('char_profession')
    .setLabel('Profissão pretendida')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(100);
  
  const relationsInput = new TextInputBuilder()
    .setCustomId('char_relations')
    .setLabel('Relações e conexões')
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
    if (isNaN(charAge) || parseInt(charAge) < 16 || parseInt(charAge) > 100) {
      return interaction.reply({
        content: '❌ Idade inválida. Deve ser entre 16 e 100 anos.',
        ephemeral: true
      });
    }
    
    session.answers.page1 = {
      charName,
      charAge: parseInt(charAge),
      rpExperience,
      rdmVdm,
      serverRules
    };
    
    session.step = 2;
    
    await interaction.reply({
      content: '✅ Página 1 concluída!',
      ephemeral: true
    });
    
    // Mostrar Página 2
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('📋 Página 2 - Raciocínio Lógico')
      .setDescription('Agora vamos testar seu raciocínio em situações de RP.')
      .addFields(
        { name: '📌 Perguntas', value: 
          '• O que faria ao ser abordado pela polícia?\n' +
          '• Como reagiria a um assalto?\n' +
          '• O que é metagaming?\n' +
          '• O que é powergaming?\n' +
          '• Descreva uma situação de RP vivida'
        }
      )
      .setFooter({ text: 'Clique no botão para responder' });
    
    const button = new ButtonBuilder()
      .setCustomId('next_page')
      .setLabel('📝 Responder Página 2')
      .setStyle(ButtonStyle.Primary);
    
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
      content: '✅ Página 2 concluída!',
      ephemeral: true
    });
    
    // Mostrar opção para enviar ou adicionar lore
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('📋 Whitelist - Quase lá!')
      .setDescription('Você completou as páginas obrigatórias!')
      .addFields(
        { name: '✅ Opção 1', value: 'Enviar para análise agora' },
        { name: '📖 Opção 2', value: 'Adicionar Lore do personagem (recomendado para aprovação)' }
      )
      .setFooter({ text: 'A Lore detalhada aumenta suas chances de aprovação!' });
    
    const submitButton = new ButtonBuilder()
      .setCustomId('submit_whitelist')
      .setLabel('✅ Enviar para Análise')
      .setStyle(ButtonStyle.Success);
    
    const loreButton = new ButtonBuilder()
      .setCustomId('submit_lore')
      .setLabel('📖 Adicionar Lore')
      .setStyle(ButtonStyle.Primary);
    
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
      content: '✅ Lore adicionada com sucesso!',
      ephemeral: true
    });
    
    // Perguntar se quer enviar
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Lore Adicionada!')
      .setDescription('Sua lore foi registrada. Deseja enviar para análise agora?')
      .setFooter({ text: 'Clique para enviar' });
    
    const submitButton = new ButtonBuilder()
      .setCustomId('submit_whitelist')
      .setLabel('✅ Enviar para Análise')
      .setStyle(ButtonStyle.Success);
    
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
      content: '❌ Você precisa completar as páginas 1 e 2 primeiro!',
      ephemeral: true
    });
  }
  
  await interaction.reply({
    content: '📤 Enviando sua whitelist para análise...',
    ephemeral: true
  });
  
  try {
    // Criar embed para o canal de logs
    const logChannel = await client.channels.fetch(config.whitelistLog);
    
    const mainEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle(`📋 Whitelist - ${interaction.user.tag}`)
      .setDescription(`**ID:** ${interaction.user.id}\n**Mencão:** ${interaction.user}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'C.D.D Roleplay - Sistema de Whitelist' });
    
    // Adicionar campos da Página 1
    mainEmbed.addFields(
      { name: '━━━ 📄 PÁGINA 1 ━━━', value: '**Regras de RP**' },
      { name: '👤 Personagem', value: session.answers.page1.charName, inline: true },
      { name: '🎂 Idade', value: `${session.answers.page1.charAge} anos`, inline: true },
      { name: '🎮 Experiência RP', value: session.answers.page1.rpExperience },
      { name: '⚠️ RDM e VDM', value: session.answers.page1.rdmVdm },
      { name: '📜 Regras do Servidor', value: session.answers.page1.serverRules }
    );
    
    // Adicionar campos da Página 2
    mainEmbed.addFields(
      { name: '━━━ 📄 PÁGINA 2 ━━━', value: '**Raciocínio Lógico**' },
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
        .setTitle(`📖 Lore - ${session.answers.page1.charName}`)
        .setDescription(`**Personagem de:** ${interaction.user}`)
        .addFields(
          { name: '📚 História', value: session.answers.lore.charHistory },
          { name: '🎭 Personalidade', value: session.answers.lore.charPersonality },
          { name: '🎯 Objetivo', value: session.answers.lore.charObjective },
          { name: '💼 Profissão', value: session.answers.lore.charProfession, inline: true },
          { name: '🤝 Relações', value: session.answers.lore.charRelations }
        )
        .setTimestamp();
      
      await logChannel.send({ embeds: [loreEmbed] });
    }
    
    // Botões de aprovação
    const approveButton = new ButtonBuilder()
      .setCustomId(`approve_${userId}`)
      .setLabel('✅ Aprovar')
      .setStyle(ButtonStyle.Success);
    
    const rejectButton = new ButtonBuilder()
      .setCustomId(`reject_${userId}`)
      .setLabel('❌ Reprovar')
      .setStyle(ButtonStyle.Danger);
    
    const row = new ActionRowBuilder().addComponents(approveButton, rejectButton);
    
    await logChannel.send({
      content: `📋 **Nova Whitelist para análise**\nUsuário: ${interaction.user}\nTicket: ${interaction.channel}`,
      components: [row]
    });
    
    // Mensagem no ticket
    const pendingEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⏳ Whitelist em Análise')
      .setDescription('Sua whitelist foi enviada para análise da equipe STAFF.')
      .addFields(
        { name: '📊 Status', value: '⏳ Pendente', inline: true },
        { name: '👥 Equipe', value: 'Aguarde a avaliação', inline: true },
        { name: '⏱️ Prazo', value: 'Até 48 horas', inline: true }
      )
      .setFooter({ text: 'Você receberá uma resposta em breve' });
    
    await interaction.channel.send({
      embeds: [pendingEmbed]
    });
    
    // Limpar botões do canal
    await interaction.message.edit({
      components: []
    }).catch(() => {});
    
  } catch (error) {
    console.error('Erro ao enviar whitelist:', error);
    await interaction.followUp({
      content: '❌ Erro ao processar whitelist. Contate um administrador.',
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
      content: '❌ Apenas membros da STAFF podem aprovar/reprovar whitelists.',
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
        .setLabel('Motivo da reprovação')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000)
        .setPlaceholder('Explique o motivo da reprovação...');
      
      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      
      return await interaction.showModal(modal);
    }
    
    // APROVAÇÃO
    await interaction.deferUpdate();
    
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
      .setTitle('✅ Whitelist Aprovada')
      .setDescription(`**Usuário:** ${targetMember.user.tag}\n**Aprovado por:** ${interaction.user.tag}`)
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
          .setTitle('🎉 Parabéns! Whitelist Aprovada!')
          .setDescription('Sua whitelist foi aprovada! Bem-vindo à Cidade de Deus Roleplay!')
          .addFields(
            { name: '🌆 Cidade de Deus', value: 'Sua jornada começa agora!' },
            { name: '📋 Próximos Passos', value: 'Você já pode acessar todos os canais do servidor.' }
          )
          .setFooter({ text: 'Divirta-se e respeite as regras!' });
        
        await ticketChannel.send({
          content: `${targetMember.user}`,
          embeds: [welcomeEmbed]
        });
        
        // Fechar ticket após 1 hora
        setTimeout(async () => {
          try {
            await ticketChannel.delete();
            activeTickets.delete(targetUserId);
            whitelistSessions.delete(targetUserId);
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
        .setTitle('🎉 Whitelist Aprovada!')
        .setDescription('Parabéns! Sua whitelist para Cidade de Deus RP foi aprovada!')
        .addFields(
          { name: '✅ Status', value: 'Aprovado' },
          { name: '🌆 Servidor', value: interaction.guild.name }
        )
        .setFooter({ text: 'Bem-vindo à família C.D.D!' });
      
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
  // Para futuras expansões
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
      
      // Remover cargo pendente
      try {
        await targetMember.roles.remove(config.pendingRole);
      } catch (error) {
        console.error('Erro ao remover cargo pendente:', error);
      }
      
      // Embed de reprovação nos logs
      const rejectedEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Whitelist Reprovada')
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
            .setTitle('❌ Whitelist Reprovada')
            .setDescription('Infelizmente sua whitelist não foi aprovada.')
            .addFields(
              { name: '📝 Motivo', value: reason },
              { name: '🔄 Refazer', value: 'Você pode abrir um novo ticket usando `/whitelist`' }
            )
            .setFooter({ text: 'Revise as regras e tente novamente' });
          
          await ticketChannel.send({
            content: `${targetMember.user}`,
            embeds: [rejectTicketEmbed]
          });
          
          // Fechar ticket após 10 minutos
          setTimeout(async () => {
            try {
              await ticketChannel.delete();
              activeTickets.delete(targetUserId);
              whitelistSessions.delete(targetUserId);
              
              // Adicionar cooldown de 1 hora
              cooldowns.set(targetUserId, Date.now() + 3600000);
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
          .setTitle('❌ Whitelist Reprovada')
          .setDescription('Sua whitelist para Cidade de Deus RP foi reprovada.')
          .addFields(
            { name: '📝 Motivo', value: reason },
            { name: '🔄 Próximos Passos', value: 'Você pode abrir um novo ticket e tentar novamente.' }
          )
          .setFooter({ text: 'Estude as regras antes de reaplicar' });
        
        await targetMember.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.error('Erro ao enviar DM:', error);
      }
      
      await interaction.reply({
        content: '✅ Whitelist reprovada com sucesso.',
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
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

async function handleError(interaction, error) {
  console.error('Erro tratado:', error);
  
  const errorEmbed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('❌ Erro')
    .setDescription('Ocorreu um erro ao processar sua solicitação.')
    .addFields({ name: 'Detalhes', value: error.message || 'Erro desconhecido' })
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
// EXPORTAÇÕES (para possíveis expansões)
// ============================================
module.exports = {
  client,
  config,
  activeTickets,
  whitelistSessions
};

console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║         🤖 BOT WHITELIST C.D.D - CIDADE DE DEUS RP       ║
║                    Sistema Profissional                  ║
║                                                          ║
║         ✅ Discord.js v14                                ║
║         ✅ Sistema de Whitelist Automatizado             ║
║         ✅ Multi-servidor                                ║
║         ✅ Totalmente Configurável                       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

📋 Configuração carregada do .env
🎮 Iniciando bot...
`);
