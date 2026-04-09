// ============================================
// BOT WHITELIST C.D.D - Cidade de Deus RP
// SISTEMA COMPLETO - VERSÃO FINAL
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
  Events,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
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
// CONFIGURAÇÕES
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
// CLIENTE
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
// CACHE E COLETORES
// ============================================
const activeTickets = new Collection();
const whitelistSessions = new Collection();
const cooldowns = new Collection();
const statistics = {
  totalWhitelists: 0,
  approved: 0,
  rejected: 0,
  pending: 0
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400000);
  const hours = Math.floor(uptime / 3600000) % 24;
  const minutes = Math.floor(uptime / 60000) % 60;
  const seconds = Math.floor(uptime / 1000) % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function calculateApprovalRate() {
  const total = statistics.approved + statistics.rejected;
  if (total === 0) return 100;
  return Math.round((statistics.approved / total) * 100);
}

async function safeDeferReply(interaction, ephemeral = true) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
      await interaction.deferReply({ flags });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao deferir:', error);
    return false;
  }
}

async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(options);
    } else {
      return await interaction.reply(options);
    }
  } catch (error) {
    console.error('Erro ao responder:', error);
    return null;
  }
}

async function handleError(interaction, error) {
  console.error('Erro tratado:', error);
  try {
    const errorMessage = {
      content: '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente.',
      flags: MessageFlags.Ephemeral
    };
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(errorMessage);
    } else if (interaction.deferred) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.followUp(errorMessage);
    }
  } catch (e) {
    console.error('Erro ao enviar mensagem de erro:', e);
  }
}

// ============================================
// VERIFICAR PERMISSÕES DO BOT
// ============================================
async function checkBotPermissions(guild) {
  const botMember = await guild.members.fetchMe();
  const requiredPerms = [
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ViewChannel
  ];
  
  const missingPerms = requiredPerms.filter(perm => !botMember.permissions.has(perm));
  
  if (missingPerms.length > 0) {
    console.warn(`⚠️ Permissões faltando em ${guild.name}`);
  }
  
  const approvedRole = await guild.roles.fetch(config.approvedRole).catch(() => null);
  const pendingRole = await guild.roles.fetch(config.pendingRole).catch(() => null);
  
  if (approvedRole && botMember.roles.highest.position <= approvedRole.position) {
    console.warn(`⚠️ O cargo do bot precisa estar ACIMA do cargo ${approvedRole.name}!`);
  }
  if (pendingRole && botMember.roles.highest.position <= pendingRole.position) {
    console.warn(`⚠️ O cargo do bot precisa estar ACIMA do cargo ${pendingRole.name}!`);
  }
  
  return missingPerms.length === 0;
}

// ============================================
// EVENTO: BOT PRONTO
// ============================================
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.tag} está online!`);
  console.log(`📊 Servindo ${client.guilds.cache.size} servidores`);
  
  // Status dinâmico
  const updateStatus = () => {
    const activities = [
      { name: '🌆 Cidade de Deus RP', type: 3 },
      { name: `${activeTickets.size} whitelists ativas`, type: 3 },
      { name: '𝙼𝚊𝚍𝚎 𝚋𝚢 𝚈𝟸𝚔_𝙽𝚊𝚝', type: 2 },
      { name: `🏆 ${statistics.approved} aprovados`, type: 3 }
    ];
    const activity = activities[Math.floor(Math.random() * activities.length)];
    client.user.setActivity(activity.name, { type: activity.type });
  };
  
  updateStatus();
  setInterval(updateStatus, 5000);
  
  // Mensagem de inicialização no canal de logs
  try {
    const logChannel = await client.channels.fetch(config.whitelistLog);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🟢 BOT ONLINE - CIDADE DE DEUS RP')
        .setDescription('**Sistema de Whitelist ativo e operacional**')
        .addFields(
          { name: '🤖 Bot', value: client.user.tag, inline: true },
          { name: '🌐 Servidores', value: `${client.guilds.cache.size}`, inline: true },
          { name: '📊 Status', value: '✅ Operacional', inline: true },
          { name: '🏙️ Cidade', value: 'Cidade de Deus', inline: true },
          { name: '⏰ Inicializado', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: '📋 Versão', value: '5.0 Final', inline: true }
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'C.D.D Roleplay - Sistema Profissional de Whitelist' });
      
      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem de inicialização:', error);
  }
  
  // Registrar comandos
  await registerSlashCommands();
  
  // Verificar permissões e criar painéis
  for (const guild of client.guilds.cache.values()) {
    await checkBotPermissions(guild);
    await createWhitelistPanel(guild);
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
        name: 'status',
        description: '📊 Verificar status da sua whitelist'
      },
      {
        name: 'fechar',
        description: '🔒 Fechar ticket de whitelist (Apenas STAFF)'
      },
      {
        name: 'revisar',
        description: '📝 Listar whitelists pendentes (Apenas STAFF)'
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
        name: 'painel',
        description: '🎨 Recriar painel de whitelist (Apenas Owner)'
      },
      {
        name: 'permissoes',
        description: '🔧 Verificar permissões do bot (Apenas STAFF)'
      }
    ];
    
    await client.application.commands.set(commands);
    console.log('✅ Comandos slash registrados!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
}

// ============================================
// CRIAR PAINEL DE WHITELIST (APENAS EMBED PRINCIPAL + SELECT MENU)
// ============================================
async function createWhitelistPanel(guild) {
  try {
    const channel = await guild.channels.fetch(config.whitelistChannel).catch(() => null);
    if (!channel) return;
    
    // Limpar mensagens antigas do bot
    const messages = await channel.messages.fetch({ limit: 20 });
    const botMessages = messages.filter(m => m.author.id === client.user.id);
    for (const msg of botMessages.values()) {
      await msg.delete().catch(() => {});
    }
    
    // Embed Principal (APENAS ESTE)
    const mainEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🌟 SISTEMA DE WHITELIST - CIDADE DE DEUS RP 🌟')
      .setDescription(`
**🌆 Bem-vindo ao processo seletivo da Cidade de Deus!**

Para fazer parte da nossa comunidade, você precisa passar pelo nosso sistema de whitelist. 
Este processo garante que todos os membros estejam alinhados com nossas regras e filosofia de Roleplay.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📋 COMO FUNCIONA:**

📌 **1.** Use o menu abaixo para iniciar seu ticket
📌 **2.** Responda o formulário completo com atenção
📌 **3.** Aguarde a análise da nossa equipe (até 48h)
📌 **4.** Se aprovado, seja bem-vindo à cidade!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**⚠️ REQUISITOS IMPORTANTES:**

✅ Ter mais de **12 anos**
✅ Ler e concordar com todas as regras
✅ Responder o formulário com sinceridade
✅ Ter maturidade para o Roleplay
✅ Respeitar todos os jogadores

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📚 REGRAS PRINCIPAIS:**

🔹 **RDM** (Random Deathmatch) - PROIBIDO
🔹 **VDM** (Vehicle Deathmatch) - PROIBIDO
🔹 **Metagaming** - PROIBIDO
🔹 **Powergaming** - PROIBIDO
🔹 **Combat Logging** - PROIBIDO
🔹 Respeito acima de tudo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**⏰ TEMPO DE RESPOSTA:**

🕐 Análise em até **48 horas**
📢 Você será notificado no privado
🔄 Em caso de reprovação, pode tentar novamente após 1 hora
    `)
      .setFooter({ 
  text: 'Cidade de Deus Roleplay • Sistema de Whitelist • v5.0',
  iconURL: client.user.displayAvatarURL()
})
.setImage('https://criminal-emerald-khsklnrwda.edgeone.app/file_000000001f94720eb81e748bf079065a.png')
.setTimestamp();

    // SELECT MENU PRINCIPAL
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('whitelist_main_menu')
      .setPlaceholder('Cidade deDeus| WhiteList')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('📝 Iniciar Whitelist')
          .setDescription('Começar o processo de whitelist')
          .setValue('start_whitelist')
          .setEmoji('🌟'),
        new StringSelectMenuOptionBuilder()
          .setLabel('📜 Ver Regras')
          .setDescription('Consultar as regras do servidor')
          .setValue('view_rules')
          .setEmoji('📋'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🔍 Verificar Status')
          .setDescription('Consultar o status da sua whitelist')
          .setValue('check_status')
          .setEmoji('📊'),
        new StringSelectMenuOptionBuilder()
          .setLabel('❓ Ajuda')
          .setDescription('Obter ajuda sobre o sistema')
          .setValue('help')
          .setEmoji('💡'),
        new StringSelectMenuOptionBuilder()
          .setLabel('ℹ️ Estatísticas')
          .setDescription('Ver estatísticas do servidor')
          .setValue('server_stats')
          .setEmoji('📈')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await channel.send({
      embeds: [mainEmbed],
      components: [row]
    });

    console.log(`✅ Painel criado em ${guild.name}`);
  } catch (error) {
    console.error(`Erro ao criar painel em ${guild.name}:`, error);
  }
}

// ============================================
// EVENTO: GUILD CREATE (BOT ADICIONADO)
// ============================================
client.on(Events.GuildCreate, async (guild) => {
  console.log(`📥 Bot adicionado ao servidor: ${guild.name}`);
  
  try {
    await checkBotPermissions(guild);
    
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
        .setTitle('🤖 BOT WHITELIST C.D.D - INSTALADO COM SUCESSO!')
        .setDescription(`
**O sistema de whitelist está ativo e configurado!**

**⚠️ ATENÇÃO ÀS PERMISSÕES:**
- O cargo do bot deve estar **ACIMA** dos cargos de whitelist na hierarquia
- O bot precisa das permissões: Gerenciar Cargos, Gerenciar Canais, Enviar Mensagens

**📋 Comandos:**
- \`/whitelist\` - Iniciar processo
- \`/permissoes\` - Verificar permissões (STAFF)
- \`!help\` - Ver todos os comandos
        `)
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: 'Sistema Profissional de Whitelist • v5.0' })
        .setTimestamp();
      
      await targetChannel.send({ embeds: [welcomeEmbed] });
    }
    
    await createWhitelistPanel(guild);
    
    const logChannel = await client.channels.fetch(config.whitelistLog).catch(() => null);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('📥 Bot Adicionado a Novo Servidor')
        .addFields(
          { name: '🌐 Servidor', value: guild.name, inline: true },
          { name: '👥 Membros', value: `${guild.memberCount}`, inline: true },
          { name: '🛠 Dono do Sistema', value: `<@${guild.ownerId}>`, inline: true }
        )
        .setTimestamp();
      
      await logChannel.send({ embeds: [logEmbed] });
    }
    
  } catch (error) {
    console.error('Erro ao configurar novo servidor:', error);
  }
});

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
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    }
  } catch (error) {
    console.error('Erro na interação:', error);
    await handleError(interaction, error);
  }
});

// ============================================
// HANDLER: SELECT MENU
// ============================================
async function handleSelectMenu(interaction) {
  const selectedValue = interaction.values[0];
  
  switch (selectedValue) {
    case 'start_whitelist':
      await safeDeferReply(interaction);
      await handleWhitelistCommand(interaction);
      break;
      
    case 'view_rules':
      const rulesEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('📜 REGRAS DA CIDADE DE DEUS RP')
        .setDescription('**Leia atentamente todas as regras!**')
        .addFields(
          { name: '🚫 REGRAS GERAIS', value: '• Respeito acima de tudo\n• Sem preconceito ou discriminação\n• Proibido qualquer tipo de assédio' },
          { name: '🎭 REGRAS DE RP', value: '• **RDM** - PROIBIDO\n• **VDM** - PROIBIDO\n• **Metagaming** - PROIBIDO\n• **Powergaming** - PROIBIDO\n• **Combat Logging** - PROIBIDO' },
          { name: '⚠️ PUNIÇÕES', value: '1ª - Aviso\n2ª - Kick\n3ª - Ban Temporário\n4ª - Ban Permanente' }
        )
        .setFooter({ text: 'O descumprimento das regras resultará em punições' });
      
      await interaction.reply({ embeds: [rulesEmbed], flags: MessageFlags.Ephemeral });
      break;
      
    case 'check_status':
      await handleStatusCommand(interaction);
      break;
      
    case 'help':
      const helpEmbed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('❓ AJUDA - WHITELIST')
        .setDescription('**Como funciona o sistema de whitelist:**')
        .addFields(
          { name: '📋 Etapas', value: '1. Regras de RP\n2. Raciocínio Lógico\n3. Lore do Personagem' },
          { name: '⏰ Tempo', value: 'Análise em até 48 horas' },
          { name: '🔄 Reprovação', value: 'Pode tentar novamente após 1 hora' },
          { name: '📢 Comando', value: 'Use `/whitelist` ou o menu acima para começar' }
        );
      
      await interaction.reply({ embeds: [helpEmbed], flags: MessageFlags.Ephemeral });
      break;
      
    case 'server_stats':
      const statsEmbed = new EmbedBuilder()
        .setColor('#4169E1')
        .setTitle('📊 ESTATÍSTICAS DO SERVIDOR')
        .addFields(
          { name: '👥 Membros Totais', value: `${interaction.guild.memberCount}`, inline: true },
          { name: '✅ Aprovados', value: `${statistics.approved}`, inline: true },
          { name: '⏳ Em Análise', value: `${activeTickets.size}`, inline: true },
          { name: '🏆 Taxa de Aprovação', value: `${calculateApprovalRate()}%`, inline: true },
          { name: '📋 Total de Whitelists', value: `${statistics.totalWhitelists}`, inline: true },
          { name: '❌ Reprovadas', value: `${statistics.rejected}`, inline: true }
        )
        .setFooter({ text: 'Atualizado em tempo real' });
      
      await interaction.reply({ embeds: [statsEmbed], flags: MessageFlags.Ephemeral });
      break;
  }
}

// ============================================
// HANDLER: SLASH COMMANDS
// ============================================
async function handleSlashCommand(interaction) {
  const command = interaction.commandName;
  
  switch (command) {
    case 'whitelist':
      await safeDeferReply(interaction);
      await handleWhitelistCommand(interaction);
      break;
    case 'status':
      await handleStatusCommand(interaction);
      break;
    case 'fechar':
      await handleCloseCommand(interaction);
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
    case 'painel':
      await handlePanelCommand(interaction);
      break;
    case 'permissoes':
      await handlePermissionsCommand(interaction);
      break;
  }
}

// ============================================
// COMANDO: VERIFICAR PERMISSÕES
// ============================================
async function handlePermissionsCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas STAFF pode usar este comando.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  await safeDeferReply(interaction);
  
  const botMember = await interaction.guild.members.fetchMe();
  const approvedRole = await interaction.guild.roles.fetch(config.approvedRole).catch(() => null);
  const pendingRole = await interaction.guild.roles.fetch(config.pendingRole).catch(() => null);
  const staffRole = await interaction.guild.roles.fetch(config.staffRole).catch(() => null);
  
  const permsEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('🔧 VERIFICAÇÃO DE PERMISSÕES')
    .addFields(
      { 
        name: '📊 Hierarquia de Cargos', 
        value: `
**Bot:** Posição ${botMember.roles.highest.position}
**STAFF:** ${staffRole ? `Posição ${staffRole.position}` : '❌ Não encontrado'}
**Aprovado:** ${approvedRole ? `Posição ${approvedRole.position}` : '❌ Não encontrado'}
**Pendente:** ${pendingRole ? `Posição ${pendingRole.position}` : '❌ Não encontrado'}
        `,
        inline: false
      },
      {
        name: '✅ Status das Permissões',
        value: `
${botMember.roles.highest.position > (approvedRole?.position || 0) ? '✅' : '❌'} Bot acima do cargo Aprovado
${botMember.roles.highest.position > (pendingRole?.position || 0) ? '✅' : '❌'} Bot acima do cargo Pendente
${botMember.permissions.has(PermissionFlagsBits.ManageRoles) ? '✅' : '❌'} Gerenciar Cargos
${botMember.permissions.has(PermissionFlagsBits.ManageChannels) ? '✅' : '❌'} Gerenciar Canais
${botMember.permissions.has(PermissionFlagsBits.Administrator) ? '✅' : '❌'} Administrador
        `,
        inline: false
      }
    )
    .setFooter({ text: '❌ = Problema detectado. Corrija as permissões!' });
  
  await interaction.editReply({ embeds: [permsEmbed] });
}

// ============================================
// COMANDO: WHITELIST
// ============================================
async function handleWhitelistCommand(interaction) {
  const userId = interaction.user.id;
  const guild = interaction.guild;
  const member = await guild.members.fetch(userId);
  
  // Verificar permissões do bot
  const botMember = await guild.members.fetchMe();
  const approvedRole = await guild.roles.fetch(config.approvedRole).catch(() => null);
  
  if (approvedRole && botMember.roles.highest.position <= approvedRole.position) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ ERRO DE CONFIGURAÇÃO')
          .setDescription('O bot não tem permissão para gerenciar os cargos de whitelist.')
          .addFields({
            name: '🔧 Solução',
            value: 'O cargo do bot precisa estar **ACIMA** do cargo de whitelist aprovado na hierarquia do servidor.'
          })
          .setFooter({ text: 'Contate um administrador para corrigir.' })
      ]
    });
  }
  
  // Já aprovado
  if (member.roles.cache.has(config.approvedRole)) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ WHITELIST JÁ APROVADA')
          .setDescription('Você já possui whitelist aprovada! Bem-vindo à Cidade de Deus RP.')
          .setFooter({ text: 'Aproveite o servidor!' })
      ]
    });
  }
  
  // Ticket ativo
  if (activeTickets.has(userId)) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ TICKET JÁ EXISTENTE')
          .setDescription(`Você já possui um ticket de whitelist ativo em <#${activeTickets.get(userId)}>`)
          .setFooter({ text: 'Acesse seu ticket para continuar' })
      ]
    });
  }
  
  // Cooldown
  if (cooldowns.has(userId)) {
    const timeLeft = Math.ceil((cooldowns.get(userId) - Date.now()) / 1000 / 60);
    if (timeLeft > 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⏰ EM COOLDOWN')
            .setDescription(`Aguarde **${timeLeft} minutos** antes de abrir um novo ticket.`)
            .setFooter({ text: 'Use este tempo para estudar as regras!' })
        ]
      });
    }
  }
  
  try {
    const category = await guild.channels.fetch(config.categoryId);
    if (!category) {
      return interaction.editReply({ content: '❌ Categoria não configurada.' });
    }
    
    const channelName = `🎫・whitelist・${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Whitelist de ${interaction.user.tag} | ID: ${interaction.user.id}`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
      ]
    });
    
    activeTickets.set(userId, channel.id);
    whitelistSessions.set(userId, {
      step: 0,
      answers: {},
      channelId: channel.id,
      startedAt: Date.now(),
      userId,
      userTag: interaction.user.tag
    });
    
    statistics.totalWhitelists++;
    statistics.pending = activeTickets.size;
    
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ TICKET CRIADO COM SUCESSO!')
          .setDescription(`Seu ticket foi criado em ${channel}`)
          .setFooter({ text: 'Boa sorte na sua whitelist!' })
      ]
    });
    
    // Adicionar cargo pendente
    const pendingRole = await guild.roles.fetch(config.pendingRole).catch(() => null);
    if (pendingRole) {
      try {
        await member.roles.add(pendingRole);
      } catch (error) {
        console.error('Erro ao adicionar cargo pendente:', error);
      }
    }
    
    // Mensagem de boas-vindas no ticket
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🌆 BEM-VINDO À CIDADE DE DEUS RP')
      .setDescription(`**Olá ${interaction.user}, sua jornada começa agora!**`)
      .addFields(
        { name: '📋 PROCESSO DE WHITELIST', value: 'Você responderá **3 etapas** de perguntas para avaliarmos seu conhecimento e maturidade para o Roleplay.' },
        { name: '⏱️ TEMPO', value: 'Não há limite de tempo. Responda com **calma e atenção**.', inline: true },
        { name: '📝 DICA IMPORTANTE', value: 'Quanto mais **detalhadas** forem suas respostas, maiores as chances de aprovação!', inline: true },
        { name: '🎯 ETAPAS', value: '```\n1️⃣ Regras de RP\n2️⃣ Raciocínio Lógico\n3️⃣ Lore do Personagem\n```' }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
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
      content: `${interaction.user}`,
      embeds: [welcomeEmbed],
      components: [row]
    });
    
    // Notificar STAFF
    const logChannel = await client.channels.fetch(config.whitelistLog);
    if (logChannel) {
      const notifyEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('📋 Nova Whitelist Iniciada')
        .setDescription(`**${interaction.user.tag}** iniciou o processo.`)
        .addFields(
          { name: '👤 Usuário', value: `${interaction.user}`, inline: true },
          { name: '🆔 ID', value: interaction.user.id, inline: true },
          { name: '🎫 Ticket', value: `${channel}`, inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();
      
      await logChannel.send({ content: `<@&${config.staffRole}>`, embeds: [notifyEmbed] });
    }
    
  } catch (error) {
    console.error('Erro ao criar ticket:', error);
    await interaction.editReply({ content: '❌ Erro ao criar ticket.' });
  }
}

// ============================================
// COMANDO: STATUS
// ============================================
async function handleStatusCommand(interaction) {
  const userId = interaction.user.id;
  const member = await interaction.guild.members.fetch(userId);
  
  if (member.roles.cache.has(config.approvedRole)) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ WHITELIST APROVADA')
          .setDescription('Sua whitelist já foi aprovada! Bem-vindo à Cidade de Deus!')
      ],
      flags: MessageFlags.Ephemeral
    });
  }
  
  if (activeTickets.has(userId)) {
    const session = whitelistSessions.get(userId);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⏳ WHITELIST EM ANÁLISE')
          .setDescription(`Sua whitelist está em análise pela equipe STAFF.`)
          .addFields(
            { name: '📋 Ticket', value: `<#${activeTickets.get(userId)}>`, inline: true },
            { name: '⏰ Iniciado', value: session ? `<t:${Math.floor(session.startedAt / 1000)}:R>` : 'Desconhecido', inline: true }
          )
      ],
      flags: MessageFlags.Ephemeral
    });
  }
  
  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 NENHUMA WHITELIST ATIVA')
        .setDescription('Você não possui nenhuma whitelist em andamento.')
        .addFields({ name: '🌟 Iniciar', value: 'Use o menu no canal de whitelist ou `/whitelist`' })
    ],
    flags: MessageFlags.Ephemeral
  });
}

// ============================================
// COMANDO: FECHAR (STAFF)
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
  
  if (!channel.name.startsWith('🎫・whitelist・')) {
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
// COMANDO: REVISAR (STAFF)
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
    const session = whitelistSessions.get(userId);
    pendingList.push(`• <@${userId}> - <#${channelId}> - ${session ? `<t:${Math.floor(session.startedAt / 1000)}:R>` : 'Em andamento'}`);
  }
  
  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('📋 Whitelists Pendentes')
    .setDescription(pendingList.join('\n'))
    .setFooter({ text: `Total: ${activeTickets.size}` });
  
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================
// COMANDO: ESTATÍSTICAS (STAFF)
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
    .setTitle('📊 ESTATÍSTICAS DO SISTEMA')
    .addFields(
      { name: '📋 Total', value: `${statistics.totalWhitelists}`, inline: true },
      { name: '✅ Aprovadas', value: `${statistics.approved}`, inline: true },
      { name: '❌ Reprovadas', value: `${statistics.rejected}`, inline: true },
      { name: '⏳ Pendentes', value: `${activeTickets.size}`, inline: true },
      { name: '📈 Taxa de Aprovação', value: `${calculateApprovalRate()}%`, inline: true },
      { name: '🏓 Ping', value: `${client.ws.ping}ms`, inline: true },
      { name: '⏰ Uptime', value: formatUptime(client.uptime), inline: true }
    )
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================
// COMANDO: LIMPAR (STAFF)
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
  const channels = category.children.cache.filter(c => c.name.startsWith('🎫・whitelist・'));
  
  let deleted = 0;
  for (const channel of channels.values()) {
    const messages = await channel.messages.fetch({ limit: 1 });
    if (messages.size === 0 || Date.now() - messages.first().createdTimestamp > 86400000) {
      try {
        await channel.delete();
        deleted++;
      } catch (error) {
        console.error('Erro ao deletar:', error);
      }
    }
  }
  
  for (const [userId, channelId] of activeTickets) {
    if (!interaction.guild.channels.cache.has(channelId)) {
      activeTickets.delete(userId);
      whitelistSessions.delete(userId);
    }
  }
  
  await interaction.editReply({ content: `✅ Limpeza concluída! ${deleted} canais removidos.` });
}

// ============================================
// COMANDO: PAINEL (OWNER)
// ============================================
async function handlePanelCommand(interaction) {
  if (interaction.user.id !== config.ownerId) {
    return interaction.reply({
      content: '❌ Apenas o Dono do Sistema pode usar este comando.',
      flags: MessageFlags.Ephemeral
    });
  }
  
  await safeDeferReply(interaction);
  await createWhitelistPanel(interaction.guild);
  await interaction.editReply({ content: '✅ Painel de whitelist recriado com sucesso!' });
}

// ============================================
// EVENTO: MESSAGE CREATE (PREFIX !)
// ============================================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;
  
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  switch (command) {
    case 'ping':
      await message.reply(`🏓 Pong! **${client.ws.ping}ms**`);
      break;
      
    case 'status':
      const statusEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('📊 STATUS DO SISTEMA')
        .addFields(
          { name: '🤖 Bot', value: client.user.tag, inline: true },
          { name: '📋 Tickets Ativos', value: `${activeTickets.size}`, inline: true },
          { name: '✅ Aprovados', value: `${statistics.approved}`, inline: true },
          { name: '🏓 Ping', value: `${client.ws.ping}ms`, inline: true },
          { name: '⏰ Uptime', value: formatUptime(client.uptime), inline: true }
        )
        .setTimestamp();
      await message.reply({ embeds: [statusEmbed] });
      break;
      
    case 'help':
      const helpEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('📚 CENTRAL DE AJUDA - CIDADE DE DEUS RP')
        .setDescription('**Sistema de Whitelist Automatizado**')
        .addFields(
          { 
            name: '📋 **COMANDOS SLASH**', 
            value: '`/whitelist` - Iniciar whitelist\n`/status` - Verificar status\n`/permissoes` - Verificar permissões (STAFF)' 
          },
          { 
            name: '🔧 **COMANDOS PREFIX (!)**', 
            value: '`!ping` - Latência\n`!status` - Status\n`!help` - Ajuda\n`!regras` - Regras' 
          }
        )
        .setFooter({ text: 'C.D.D Roleplay • v5.0' });
      await message.reply({ embeds: [helpEmbed] });
      break;
      
    case 'regras':
      const rulesEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('📜 REGRAS DA CIDADE DE DEUS RP')
        .setDescription('**Leia atentamente todas as regras!**')
        .addFields(
          { name: '🚫 REGRAS GERAIS', value: '• Respeito acima de tudo\n• Sem preconceito ou discriminação' },
          { name: '🎭 REGRAS DE RP', value: '• RDM - PROIBIDO\n• VDM - PROIBIDO\n• Metagaming - PROIBIDO\n• Powergaming - PROIBIDO' }
        );
      await message.reply({ embeds: [rulesEmbed] });
      break;
  }
});

// ============================================
// HANDLER: BOTÕES
// ============================================
async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  
  // Iniciar Formulário
  if (customId === 'start_whitelist_form') {
    const session = whitelistSessions.get(userId);
    if (!session) {
      return interaction.reply({ content: '❌ Sessão não encontrada. Use /whitelist para recomeçar.', flags: MessageFlags.Ephemeral });
    }
    
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('📋 ETAPA 1 - REGRAS DE ROLEPLAY')
      .setDescription('**Responda as perguntas sobre regras básicas.**')
      .addFields({
        name: '📌 PERGUNTAS',
        value: '```\n1. Nome do personagem\n2. Idade\n3. Já jogou RP?\n4. O que é RDM/VDM?\n5. Regras importantes\n```'
      })
      .setFooter({ text: 'Clique no botão para responder • Etapa 1/3' });
    
    const button = new ButtonBuilder()
      .setCustomId('next_page')
      .setLabel('📝 RESPONDER ETAPA 1')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('1️⃣');
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await interaction.reply({ embeds: [embed], components: [row] });
  }
  
  // Cancelar
  else if (customId === 'cancel_whitelist') {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Cancelar Whitelist?')
          .setDescription('Tem certeza que deseja cancelar?')
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirm_cancel').setLabel('✅ Sim, Cancelar').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('keep_ticket').setLabel('❌ Não, Continuar').setStyle(ButtonStyle.Secondary)
        )
      ],
      flags: MessageFlags.Ephemeral
    });
  }
  
  // Confirmar Cancelamento
  else if (customId === 'confirm_cancel') {
    const session = whitelistSessions.get(userId);
    if (session) {
      whitelistSessions.delete(userId);
      activeTickets.delete(userId);
      
      const member = await interaction.guild.members.fetch(userId);
      const pendingRole = await interaction.guild.roles.fetch(config.pendingRole).catch(() => null);
      if (pendingRole) {
        await member.roles.remove(pendingRole).catch(() => {});
      }
      
      await interaction.update({
        embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('❌ Whitelist Cancelada').setDescription('O ticket será fechado em 5 segundos...')],
        components: []
      });
      
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  }
  
  // Manter Ticket
  else if (customId === 'keep_ticket') {
    await interaction.update({ content: '✅ Continuando com a whitelist...', embeds: [], components: [] });
  }
  
  // Próxima Página
  else if (customId === 'next_page') {
    const session = whitelistSessions.get(userId);
    if (!session) {
      return interaction.reply({ content: '❌ Sessão não encontrada.', flags: MessageFlags.Ephemeral });
    }
    
    if (session.step === 0 || session.step === 1) {
      await showPage1Modal(interaction);
    } else if (session.step === 2) {
      await showPage2Modal(interaction);
    }
  }
  
  // Enviar para Análise
  else if (customId === 'submit_whitelist') {
    await submitWhitelist(interaction);
  }
  
  // Adicionar Lore
  else if (customId === 'submit_lore') {
    await showLoreModal(interaction);
  }
  
  // Aprovar/Reprovar (STAFF)
  else if (customId.startsWith('approve_') || customId.startsWith('reject_')) {
    await handleStaffDecision(interaction);
  }
}

// ============================================
// MODAIS
// ============================================
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
    .setLabel('🎂 Idade do personagem (mínimo 12 anos)')
    .setPlaceholder('Ex: 18')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);
  
  const rpExperienceInput = new TextInputBuilder()
    .setCustomId('rp_experience')
    .setLabel('🎮 Já jogou RP antes? Onde?')
    .setPlaceholder('Conte sua experiência...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(500);
  
  const rdmVdmInput = new TextInputBuilder()
    .setCustomId('rdm_vdm')
    .setLabel('⚠️ O que é RDM e VDM?')
    .setPlaceholder('Explique os conceitos...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const rulesInput = new TextInputBuilder()
    .setCustomId('server_rules')
    .setLabel('📜 Cite regras importantes')
    .setPlaceholder('Liste as regras que você conhece...')
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

async function showPage2Modal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('page2_modal')
    .setTitle('Etapa 2 - Raciocínio Lógico');
  
  const policeInput = new TextInputBuilder()
    .setCustomId('police_approach')
    .setLabel('👮 Abordado pela polícia?')
    .setPlaceholder('Como reagiria?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const robberyInput = new TextInputBuilder()
    .setCustomId('robbery_reaction')
    .setLabel('💰 Como reagiria a um assalto?')
    .setPlaceholder('Descreva sua reação...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const metagamingInput = new TextInputBuilder()
    .setCustomId('metagaming')
    .setLabel('🎭 O que é metagaming?')
    .setPlaceholder('Explique o conceito...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const powergamingInput = new TextInputBuilder()
    .setCustomId('powergaming')
    .setLabel('💪 O que é powergaming?')
    .setPlaceholder('Explique o conceito...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);
  
  const rpSituationInput = new TextInputBuilder()
    .setCustomId('rp_situation')
    .setLabel('🎬 Situação de RP vivida')
    .setPlaceholder('Conte uma experiência...')
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

async function showLoreModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('lore_modal')
    .setTitle('Etapa 3 - Lore do Personagem');
  
  const historyInput = new TextInputBuilder()
    .setCustomId('char_history')
    .setLabel('📚 História do personagem')
    .setPlaceholder('Conte a história completa...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(50)
    .setMaxLength(4000);
  
  const personalityInput = new TextInputBuilder()
    .setCustomId('char_personality')
    .setLabel('🎭 Personalidade')
    .setPlaceholder('Descreva a personalidade...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(1000);
  
  const objectiveInput = new TextInputBuilder()
    .setCustomId('char_objective')
    .setLabel('🎯 Objetivo na cidade')
    .setPlaceholder('Quais os objetivos?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(1000);
  
  const professionInput = new TextInputBuilder()
    .setCustomId('char_profession')
    .setLabel('💼 Profissão pretendida')
    .setPlaceholder('Ex: Policial, Médico...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(100);
  
  const relationsInput = new TextInputBuilder()
    .setCustomId('char_relations')
    .setLabel('🤝 Relações e conexões')
    .setPlaceholder('Descreva relações importantes...')
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
    return interaction.reply({ content: '❌ Sessão expirada. Use /whitelist para recomeçar.', flags: MessageFlags.Ephemeral });
  }
  
  // Página 1
  if (interaction.customId === 'page1_modal') {
    const charName = interaction.fields.getTextInputValue('char_name');
    const charAge = interaction.fields.getTextInputValue('char_age');
    const rpExperience = interaction.fields.getTextInputValue('rp_experience');
    const rdmVdm = interaction.fields.getTextInputValue('rdm_vdm');
    const serverRules = interaction.fields.getTextInputValue('server_rules');
    
    const age = parseInt(charAge);
    if (isNaN(age) || age < 12 || age > 100) {
      return interaction.reply({ content: '❌ Idade deve ser entre 12 e 100 anos.', flags: MessageFlags.Ephemeral });
    }
    
    session.answers.page1 = { charName, charAge: age, rpExperience, rdmVdm, serverRules };
    session.step = 2;
    
    await interaction.reply({ content: '✅ Etapa 1 concluída! Preparando Etapa 2...', flags: MessageFlags.Ephemeral });
    
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('📋 ETAPA 2 - RACIOCÍNIO LÓGICO')
      .setDescription('**Agora vamos testar seu raciocínio em situações de RP.**')
      .addFields({
        name: '📌 PERGUNTAS',
        value: '```\n1. Abordagem policial\n2. Reação a assalto\n3. Metagaming\n4. Powergaming\n5. Situação de RP\n```'
      })
      .setFooter({ text: 'Clique no botão para responder • Etapa 2/3' });
    
    const button = new ButtonBuilder()
      .setCustomId('next_page')
      .setLabel('📝 RESPONDER ETAPA 2')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('2️⃣');
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await interaction.channel.send({ embeds: [embed], components: [row] });
  }
  
  // Página 2
  else if (interaction.customId === 'page2_modal') {
    session.answers.page2 = {
      policeApproach: interaction.fields.getTextInputValue('police_approach'),
      robberyReaction: interaction.fields.getTextInputValue('robbery_reaction'),
      metagaming: interaction.fields.getTextInputValue('metagaming'),
      powergaming: interaction.fields.getTextInputValue('powergaming'),
      rpSituation: interaction.fields.getTextInputValue('rp_situation')
    };
    
    await interaction.reply({ content: '✅ Etapa 2 concluída!', flags: MessageFlags.Ephemeral });
    
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📋 WHITELIST - QUASE LÁ!')
      .setDescription('**Você completou as etapas obrigatórias!**')
      .addFields(
        { name: '✅ OPÇÃO 1', value: 'Enviar para análise agora', inline: true },
        { name: '📖 OPÇÃO 2 (RECOMENDADO)', value: 'Adicionar Lore do personagem', inline: true }
      )
      .setFooter({ text: 'A Lore detalhada aumenta suas chances de aprovação!' });
    
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
    
    await interaction.channel.send({ embeds: [embed], components: [row] });
  }
  
  // Lore
  else if (interaction.customId === 'lore_modal') {
    session.answers.lore = {
      charHistory: interaction.fields.getTextInputValue('char_history'),
      charPersonality: interaction.fields.getTextInputValue('char_personality'),
      charObjective: interaction.fields.getTextInputValue('char_objective'),
      charProfession: interaction.fields.getTextInputValue('char_profession'),
      charRelations: interaction.fields.getTextInputValue('char_relations')
    };
    
    await interaction.reply({ content: '✅ Lore adicionada com sucesso!', flags: MessageFlags.Ephemeral });
    
    const embed = new EmbedBuilder()
      .setColor('#9370DB')
      .setTitle('✨ LORE ADICIONADA!')
      .setDescription('**Sua lore foi registrada. Clique abaixo para enviar para análise.**');
    
    const submitButton = new ButtonBuilder()
      .setCustomId('submit_whitelist')
      .setLabel('✅ ENVIAR PARA ANÁLISE')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📤');
    
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
    return interaction.reply({ content: '❌ Complete as etapas 1 e 2 primeiro!', flags: MessageFlags.Ephemeral });
  }
  
  await interaction.deferUpdate();
  
  try {
    const logChannel = await client.channels.fetch(config.whitelistLog);
    
    const mainEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle(`📋 WHITELIST - ${interaction.user.tag}`)
      .setDescription(`**ID:** ${interaction.user.id}\n**Menção:** ${interaction.user}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '━━━ 📄 ETAPA 1: REGRAS DE RP ━━━', value: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬' },
        { name: '👤 Personagem', value: session.answers.page1.charName, inline: true },
        { name: '🎂 Idade', value: `${session.answers.page1.charAge} anos`, inline: true },
        { name: '🎮 Experiência RP', value: session.answers.page1.rpExperience },
        { name: '⚠️ RDM e VDM', value: session.answers.page1.rdmVdm },
        { name: '📜 Regras do Servidor', value: session.answers.page1.serverRules },
        { name: '━━━ 📄 ETAPA 2: RACIOCÍNIO LÓGICO ━━━', value: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬' },
        { name: '👮 Abordagem Policial', value: session.answers.page2.policeApproach },
        { name: '💰 Reação a Assalto', value: session.answers.page2.robberyReaction },
        { name: '🎭 Metagaming', value: session.answers.page2.metagaming },
        { name: '💪 Powergaming', value: session.answers.page2.powergaming },
        { name: '🎬 Situação RP', value: session.answers.page2.rpSituation }
      )
      .setTimestamp()
      .setFooter({ text: 'C.D.D Roleplay - Sistema de Whitelist' });
    
    await logChannel.send({ embeds: [mainEmbed] });
    
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
      content: `📋 **NOVA WHITELIST PARA ANÁLISE**\n👤 ${interaction.user}\n🎫 ${interaction.channel}`,
      components: [row]
    });
    
    const pendingEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⏳ WHITELIST EM ANÁLISE')
      .setDescription('**Sua whitelist foi enviada para análise da equipe STAFF.**')
      .addFields(
        { name: '📊 Status', value: '```⏳ PENDENTE```', inline: true },
        { name: '👥 Equipe', value: '```Aguardando avaliação```', inline: true },
        { name: '⏱️ Prazo', value: '```Até 48 horas```', inline: true }
      )
      .setFooter({ text: 'Agradecemos sua paciência • Boa sorte!' })
      .setTimestamp();
    
    await interaction.channel.send({ embeds: [pendingEmbed] });
    
    await interaction.message.edit({ components: [] }).catch(() => {});
    
  } catch (error) {
    console.error('Erro ao enviar whitelist:', error);
    await interaction.followUp({ content: '❌ Erro ao enviar whitelist.', flags: MessageFlags.Ephemeral });
  }
}

// ============================================
// HANDLER: DECISÃO DA STAFF
// ============================================
async function handleStaffDecision(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  
  if (!member.roles.cache.has(config.staffRole) && interaction.user.id !== config.ownerId) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('❌ Acesso Negado').setDescription('Apenas STAFF pode aprovar/reprovar.')],
      flags: MessageFlags.Ephemeral
    });
  }
  
  const isApproving = interaction.customId.startsWith('approve_');
  const targetUserId = interaction.customId.split('_')[1];
  
  const botMember = await interaction.guild.members.fetchMe();
  const approvedRole = await interaction.guild.roles.fetch(config.approvedRole).catch(() => null);
  
  if (isApproving && approvedRole && botMember.roles.highest.position <= approvedRole.position) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ ERRO DE PERMISSÃO')
          .setDescription('O bot não tem permissão para adicionar o cargo de aprovado.')
          .addFields({
            name: '🔧 Solução',
            value: 'O cargo do bot precisa estar **ACIMA** do cargo de whitelist aprovado na hierarquia.'
          })
      ],
      flags: MessageFlags.Ephemeral
    });
  }
  
  try {
    const targetMember = await interaction.guild.members.fetch(targetUserId);
    const ticketChannelId = activeTickets.get(targetUserId);
    
    if (!isApproving) {
      const modal = new ModalBuilder()
        .setCustomId(`reject_reason_${targetUserId}`)
        .setTitle('Motivo da Reprovação');
      
      const reasonInput = new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('📝 Motivo da reprovação')
        .setPlaceholder('Explique detalhadamente o motivo...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000);
      
      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      
      return await interaction.showModal(modal);
    }
    
    await interaction.deferUpdate();
    
    statistics.approved++;
    statistics.pending = activeTickets.size - 1;
    
    const pendingRole = await interaction.guild.roles.fetch(config.pendingRole).catch(() => null);
    if (pendingRole) {
      try {
        await targetMember.roles.remove(pendingRole);
      } catch (error) {
        console.error('Erro ao remover cargo pendente:', error);
      }
    }
    
    if (approvedRole) {
      try {
        await targetMember.roles.add(approvedRole);
      } catch (error) {
        console.error('Erro ao adicionar cargo aprovado:', error);
      }
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
          .setDescription('**Sua whitelist foi aprovada! Bem-vindo à Cidade de Deus Roleplay!**')
          .addFields(
            { name: '🌆 Cidade de Deus', value: 'Sua jornada começa agora!' },
            { name: '📋 Próximos Passos', value: 'Você já pode acessar todos os canais.' }
          )
          .setFooter({ text: 'Divirta-se e respeite as regras!' });
        
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
        .setDescription('**Parabéns! Sua whitelist foi aprovada!**')
        .setFooter({ text: 'Bem-vindo à família C.D.D!' });
      
      await targetMember.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.error('Erro ao enviar DM:', error);
    }
    
    const logChannel = await client.channels.fetch(config.whitelistLog);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Whitelist Aprovada')
        .setDescription(`${targetMember.user.tag} foi aprovado por ${interaction.user.tag}`)
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
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
      statistics.pending = activeTickets.size - 1;
      
      const pendingRole = await interaction.guild.roles.fetch(config.pendingRole).catch(() => null);
      if (pendingRole) {
        try {
          await targetMember.roles.remove(pendingRole);
        } catch (error) {
          console.error('Erro ao remover cargo:', error);
        }
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
            .setDescription('**Infelizmente sua whitelist não foi aprovada.**')
            .addFields(
              { name: '📝 Motivo', value: reason },
              { name: '🔄 Refazer', value: 'Use `/whitelist` após 1 hora.' }
            )
            .setFooter({ text: 'Não desanime! Estude mais e tente novamente.' });
          
          await ticketChannel.send({ content: `${targetMember.user}`, embeds: [rejectEmbed] });
          
          setTimeout(async () => {
            try {
              await ticketChannel.delete();
              activeTickets.delete(targetUserId);
              whitelistSessions.delete(targetUserId);
              cooldowns.set(targetUserId, Date.now() + 3600000);
              setTimeout(() => cooldowns.delete(targetUserId), 3600000);
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
          .setDescription('**Sua whitelist foi reprovada.**')
          .addFields(
            { name: '📝 Motivo', value: reason },
            { name: '🔄 Próximos Passos', value: 'Você pode tentar novamente após 1 hora.' }
          )
          .setFooter({ text: 'Estude as regras antes de reaplicar!' });
        
        await targetMember.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.error('Erro ao enviar DM:', error);
      }
      
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor('#00FF00').setTitle('✅ Whitelist Reprovada').setDescription(`Whitelist de ${targetMember.user.tag} foi reprovada.`)],
        flags: MessageFlags.Ephemeral
      });
      
      const logChannel = await client.channels.fetch(config.whitelistLog);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Whitelist Reprovada')
          .setDescription(`${targetMember.user.tag} foi reprovado por ${interaction.user.tag}`)
          .addFields({ name: 'Motivo', value: reason })
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
      
    } catch (error) {
      console.error('Erro na reprovação:', error);
      await interaction.reply({ content: '❌ Erro ao reprovar.', flags: MessageFlags.Ephemeral });
    }
  }
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
module.exports = { client, config, activeTickets, whitelistSessions, statistics };

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║         🤖 BOT WHITELIST C.D.D - CIDADE DE DEUS RP v5.0          ║
║                    VERSÃO FINAL COMPLETA                         ║
║                                                                  ║
║         ✅ Discord.js v14                                        ║
║         ✅ Select Menu no Painel Principal                       ║
║         ✅ Verificação de Permissões                             ║
║         ✅ Sistema de Tickets                                    ║
║         ✅ Formulário 3 Etapas                                   ║
║         ✅ Idade Mínima: 12 anos                                 ║
║         ✅ Botões Corrigidos                                     ║
║         ✅ Aprovação/Reprovação STAFF                            ║
║         ✅ Logs Completos                                        ║
║         ✅ Totalmente Configurável via .env                      ║
║                                                                  ║
║         🌆 Cidade de Deus Roleplay                              ║
║         📋 Pronto para Produção                                  ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

⚠️  Use /permissoes para verificar a configuração do bot!
`);
