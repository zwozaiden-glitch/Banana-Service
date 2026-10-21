import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { ensureDirectoryExists } from './fileValidator.js';

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates an HTML transcript of a Discord channel's message history.
 */
export async function generateHtmlTranscript(channel, ticketInfo) {
  ensureDirectoryExists(config.storage.transcriptsDir);

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => []);
  const sortedMessages = Array.from(messages.values()).reverse();

  const formattedDate = new Date().toUTCString();
  const ticketTitle = `Ticket #${ticketInfo.ticket_num} Transcript`;

  let messageRows = '';
  for (const msg of sortedMessages) {
    const authorName = escapeHtml(msg.author.tag || msg.author.username);
    const avatarUrl = msg.author.displayAvatarURL({ size: 64 });
    const timestamp = msg.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const botBadge = msg.author.bot ? '<span class="badge">BOT</span>' : '';

    let contentHtml = escapeHtml(msg.content);
    // Format simple code blocks
    contentHtml = contentHtml.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    contentHtml = contentHtml.replace(/`([^`]+)`/g, '<code>$1</code>');
    contentHtml = contentHtml.replace(/\n/g, '<br>');

    let attachmentsHtml = '';
    if (msg.attachments.size > 0) {
      attachmentsHtml = '<div class="attachments">';
      for (const att of msg.attachments.values()) {
        attachmentsHtml += `<a class="attachment-link" href="${escapeHtml(att.url)}" target="_blank">📎 ${escapeHtml(att.name)} (${(att.size / 1024).toFixed(1)} KB)</a><br>`;
      }
      attachmentsHtml += '</div>';
    }

    messageRows += `
      <div class="message">
        <img class="avatar" src="${avatarUrl}" alt="${authorName}" />
        <div class="message-body">
          <div class="message-header">
            <span class="author">${authorName}</span>
            ${botBadge}
            <span class="timestamp">${timestamp}</span>
          </div>
          <div class="message-content">${contentHtml || '<em>(No text content)</em>'}</div>
          ${attachmentsHtml}
        </div>
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>🍌 Banana Service — ${ticketTitle}</title>
  <style>
    body {
      background-color: #1e1f22;
      color: #dbdee1;
      font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
    }
    .header {
      background: linear-gradient(135deg, #2b2d31 0%, #1e1f22 100%);
      border: 1px solid #FFE135;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .header h1 {
      color: #FFE135;
      margin: 0 0 8px 0;
      font-size: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header p {
      margin: 4px 0;
      color: #949ba4;
      font-size: 14px;
    }
    .message {
      display: flex;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 8px;
      background-color: #2b2d31;
    }
    .message:hover {
      background-color: #313338;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      margin-right: 14px;
      flex-shrink: 0;
    }
    .message-body {
      flex-grow: 1;
      overflow: hidden;
    }
    .message-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
    }
    .author {
      font-weight: 600;
      color: #f2f3f5;
    }
    .badge {
      background-color: #5865F2;
      color: #ffffff;
      font-size: 10px;
      font-weight: bold;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .timestamp {
      font-size: 11px;
      color: #949ba4;
    }
    .message-content {
      font-size: 14px;
      line-height: 1.4;
      word-break: break-word;
    }
    pre {
      background-color: #111214;
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #3f4147;
      overflow-x: auto;
    }
    code {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 13px;
    }
    .attachments {
      margin-top: 8px;
    }
    .attachment-link {
      color: #00a8fc;
      text-decoration: none;
      font-size: 13px;
    }
    .attachment-link:hover {
      text-decoration: underline;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      color: #949ba4;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍌 ${ticketTitle}</h1>
    <p><strong>Channel:</strong> #${escapeHtml(channel.name)} (${channel.id})</p>
    <p><strong>Ticket Creator:</strong> &lt;@${escapeHtml(ticketInfo.creator_id)}&gt;</p>
    <p><strong>Closed By:</strong> &lt;@${escapeHtml(ticketInfo.closed_by || 'Staff')}&gt;</p>
    <p><strong>Reason:</strong> ${escapeHtml(ticketInfo.close_reason || 'Resolved')}</p>
    <p><strong>Generated At:</strong> ${formattedDate}</p>
  </div>

  <div class="messages">
    ${messageRows}
  </div>

  <div class="footer">
    🍌 Exported securely by Banana Service Discord Bot
  </div>
</body>
</html>`;

  const fileName = `transcript_ticket_${ticketInfo.ticket_num}_${Date.now()}.html`;
  const filePath = path.join(config.storage.transcriptsDir, fileName);
  fs.writeFileSync(filePath, html, 'utf-8');

  return { filePath, fileName, messageCount: sortedMessages.length };
}

/**
 * Generates plain text transcript as lightweight fallback
 */
export async function generateTextTranscript(channel, ticketInfo) {
  ensureDirectoryExists(config.storage.transcriptsDir);

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => []);
  const sortedMessages = Array.from(messages.values()).reverse();

  let text = `=========================================================\n`;
  text += `BANANA SERVICE - TICKET #${ticketInfo.ticket_num} TRANSCRIPT\n`;
  text += `Channel: #${channel.name} (${channel.id})\n`;
  text += `Creator: ${ticketInfo.creator_id}\n`;
  text += `Closed By: ${ticketInfo.closed_by || 'Staff'}\n`;
  text += `Reason: ${ticketInfo.close_reason || 'Resolved'}\n`;
  text += `Generated: ${new Date().toISOString()}\n`;
  text += `=========================================================\n\n`;

  for (const msg of sortedMessages) {
    const time = msg.createdAt.toISOString();
    text += `[${time}] ${msg.author.tag} (${msg.author.id}):\n${msg.content}\n`;
    if (msg.attachments.size > 0) {
      for (const att of msg.attachments.values()) {
        text += `  [Attachment: ${att.name} -> ${att.url}]\n`;
      }
    }
    text += `\n`;
  }

  const fileName = `transcript_ticket_${ticketInfo.ticket_num}_${Date.now()}.txt`;
  const filePath = path.join(config.storage.transcriptsDir, fileName);
  fs.writeFileSync(filePath, text, 'utf-8');

  return { filePath, fileName, messageCount: sortedMessages.length };
}
