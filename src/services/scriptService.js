import fs from 'node:fs';
import path from 'node:path';
import { getDatabase, getGuildSettings } from '../database/db.js';
import {
  validateExtension,
  sanitizeFilename,
  generateSafeStoragePath,
  computeHash,
  ensureDirectoryExists,
  FileSecurityError,
  assertPathInStorage
} from '../utils/fileValidator.js';
import { config } from '../config.js';

export class ScriptService {
  /**
   * Helper to generate a clean URL/lookup slug from name
   */
  static slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Uploads and registers a new script
   */
  static async uploadScript({
    guildId,
    name,
    description = '',
    category = 'General',
    version = '1.0.0',
    originalFilename,
    buffer,
    uploaderId,
    uploaderTag = '',
    accessRoleId = null,
    targetChannelId = null,
    isPrivate = false,
  }) {
    if (!name || name.trim().length === 0) {
      throw new Error('Script name cannot be empty.');
    }
    if (!buffer || buffer.length === 0) {
      throw new Error('File content is empty or invalid.');
    }
    if (buffer.length > config.storage.maxScriptSizeBytes) {
      throw new Error(`File exceeds maximum permitted size of ${(config.storage.maxScriptSizeBytes / (1024 * 1024)).toFixed(0)}MB.`);
    }

    const guildSettings = getGuildSettings(guildId);
    let allowedExts = config.storage.defaultAllowedExtensions;
    if (guildSettings?.allowed_extensions) {
      try {
        const parsed = JSON.parse(guildSettings.allowed_extensions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allowedExts = parsed;
        }
      } catch {
        // fallback
      }
    }

    const ext = validateExtension(originalFilename, allowedExts);
    const safeOrigName = sanitizeFilename(originalFilename);
    const slug = this.slugify(name);
    const fileHash = computeHash(buffer);

    const db = getDatabase();

    // Check for duplicate slug in the same guild
    const existing = db.prepare('SELECT id FROM scripts WHERE guild_id = ? AND slug = ?').get(guildId, slug);
    if (existing) {
      throw new Error(`A script with the name "${name}" (slug: ${slug}) already exists in this server. Use /script update instead.`);
    }

    // Insert initial record to get auto-incremented ID
    const insertScript = db.prepare(`
      INSERT INTO scripts (
        guild_id, name, slug, description, category, version,
        current_filename, original_filename, file_size, file_hash,
        uploader_id, uploader_tag, access_role_id, target_channel_id, is_private
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Temporary filename before saving to disk
    const info = insertScript.run(
      guildId,
      name.trim(),
      slug,
      description?.trim() || 'No description provided.',
      category?.trim() || 'General',
      version?.trim() || '1.0.0',
      'pending',
      safeOrigName,
      buffer.length,
      fileHash,
      uploaderId,
      uploaderTag,
      accessRoleId || null,
      targetChannelId || null,
      isPrivate ? 1 : 0
    );

    const scriptId = info.lastInsertRowid;

    // Generate safe storage path and write file
    const { targetDir, fullPath, filename } = generateSafeStoragePath(guildId, scriptId, version, ext);
    ensureDirectoryExists(targetDir);
    fs.writeFileSync(fullPath, buffer);

    // Update current_filename in scripts table
    db.prepare('UPDATE scripts SET current_filename = ? WHERE id = ?').run(fullPath, scriptId);

    // Record initial version in script_versions table
    db.prepare(`
      INSERT INTO script_versions (
        script_id, version, filename, original_filename, changelog, file_size, file_hash, uploader_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scriptId,
      version.trim(),
      fullPath,
      safeOrigName,
      'Initial release',
      buffer.length,
      fileHash,
      uploaderId
    );

    return this.getScriptById(scriptId);
  }

  /**
   * Updates an existing script with a new version file
   */
  static async updateScript({
    guildId,
    scriptIdOrSlug,
    version,
    changelog = 'Version update',
    originalFilename,
    buffer,
    uploaderId,
  }) {
    const script = this.getScript(guildId, scriptIdOrSlug);
    if (!script) {
      throw new Error(`Script "${scriptIdOrSlug}" not found.`);
    }

    if (!buffer || buffer.length === 0) {
      throw new Error('File content is empty or invalid.');
    }
    if (buffer.length > config.storage.maxScriptSizeBytes) {
      throw new Error(`File exceeds maximum size limit.`);
    }

    const guildSettings = getGuildSettings(guildId);
    let allowedExts = config.storage.defaultAllowedExtensions;
    if (guildSettings?.allowed_extensions) {
      try {
        const parsed = JSON.parse(guildSettings.allowed_extensions);
        if (Array.isArray(parsed) && parsed.length > 0) allowedExts = parsed;
      } catch {
        // fallback
      }
    }

    const ext = validateExtension(originalFilename, allowedExts);
    const safeOrigName = sanitizeFilename(originalFilename);
    const fileHash = computeHash(buffer);

    const { targetDir, fullPath } = generateSafeStoragePath(guildId, script.id, version, ext);
    ensureDirectoryExists(targetDir);
    fs.writeFileSync(fullPath, buffer);

    const db = getDatabase();

    // Insert new version
    db.prepare(`
      INSERT INTO script_versions (
        script_id, version, filename, original_filename, changelog, file_size, file_hash, uploader_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      script.id,
      version.trim(),
      fullPath,
      safeOrigName,
      changelog.trim(),
      buffer.length,
      fileHash,
      uploaderId
    );

    // Update main script record
    db.prepare(`
      UPDATE scripts
      SET version = ?, current_filename = ?, original_filename = ?, file_size = ?, file_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      version.trim(),
      fullPath,
      safeOrigName,
      buffer.length,
      fileHash,
      script.id
    );

    return this.getScriptById(script.id);
  }

  /**
   * Updates metadata of a script (name, description, category, access role, target channel, is_private)
   */
  static updateMetadata(guildId, scriptIdOrSlug, fields = {}) {
    const script = this.getScript(guildId, scriptIdOrSlug);
    if (!script) {
      throw new Error(`Script "${scriptIdOrSlug}" not found.`);
    }

    const db = getDatabase();
    const updates = [];
    const values = [];

    if (fields.name) {
      const newSlug = this.slugify(fields.name);
      updates.push('name = ?', 'slug = ?');
      values.push(fields.name.trim(), newSlug);
    }
    if (fields.description !== undefined) {
      updates.push('description = ?');
      values.push(fields.description.trim());
    }
    if (fields.category) {
      updates.push('category = ?');
      values.push(fields.category.trim());
    }
    if (fields.access_role_id !== undefined) {
      updates.push('access_role_id = ?');
      values.push(fields.access_role_id);
    }
    if (fields.target_channel_id !== undefined) {
      updates.push('target_channel_id = ?');
      values.push(fields.target_channel_id);
    }
    if (fields.is_private !== undefined) {
      updates.push('is_private = ?');
      values.push(fields.is_private ? 1 : 0);
    }

    if (updates.length === 0) return script;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    const query = `UPDATE scripts SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values, script.id);

    return this.getScriptById(script.id);
  }

  /**
   * Fetches script by ID or Slug
   */
  static getScript(guildId, scriptIdOrSlug) {
    const db = getDatabase();
    if (!isNaN(scriptIdOrSlug) && Number.isInteger(Number(scriptIdOrSlug))) {
      return db.prepare('SELECT * FROM scripts WHERE guild_id = ? AND id = ?').get(guildId, Number(scriptIdOrSlug));
    }
    const slug = this.slugify(String(scriptIdOrSlug));
    return db.prepare('SELECT * FROM scripts WHERE guild_id = ? AND (slug = ? OR name = ?)').get(guildId, slug, String(scriptIdOrSlug));
  }

  static getScriptById(scriptId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
  }

  /**
   * Lists scripts for a guild with pagination, optional category filter, or search
   */
  static listScripts(guildId, { category = null, search = null, page = 1, limit = 10 } = {}) {
    const db = getDatabase();
    let whereClause = 'WHERE guild_id = ?';
    const params = [guildId];

    if (category && category !== 'all') {
      whereClause += ' AND LOWER(category) = LOWER(?)';
      params.push(category);
    }

    if (search && search.trim().length > 0) {
      whereClause += ' AND (name LIKE ? OR description LIKE ? OR slug LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM scripts ${whereClause}`).get(...params);
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (Math.max(1, page) - 1) * limit;

    const items = db.prepare(`
      SELECT * FROM scripts ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
      items,
      total,
      page,
      totalPages,
      limit,
    };
  }

  /**
   * Retrieves all unique categories for a guild
   */
  static getCategories(guildId) {
    const db = getDatabase();
    const rows = db.prepare('SELECT DISTINCT category FROM scripts WHERE guild_id = ? ORDER BY category ASC').all(guildId);
    return rows.map(r => r.category);
  }

  /**
   * Deletes a script and associated files
   */
  static deleteScript(guildId, scriptIdOrSlug) {
    const script = this.getScript(guildId, scriptIdOrSlug);
    if (!script) {
      throw new Error(`Script "${scriptIdOrSlug}" not found.`);
    }

    const db = getDatabase();
    // Retrieve all version files to delete from disk
    const versions = db.prepare('SELECT filename FROM script_versions WHERE script_id = ?').all(script.id);

    for (const v of versions) {
      try {
        if (v.filename && fs.existsSync(v.filename)) {
          assertPathInStorage(v.filename);
          fs.unlinkSync(v.filename);
        }
      } catch (err) {
        console.error('Failed to unlink script file:', err);
      }
    }

    db.prepare('DELETE FROM script_versions WHERE script_id = ?').run(script.id);
    db.prepare('DELETE FROM scripts WHERE id = ?').run(script.id);

    return script;
  }

  /**
   * Rollbacks a script to a previous version
   */
  static rollbackVersion(guildId, scriptIdOrSlug, targetVersion) {
    const script = this.getScript(guildId, scriptIdOrSlug);
    if (!script) {
      throw new Error(`Script "${scriptIdOrSlug}" not found.`);
    }

    const db = getDatabase();
    const versionRecord = db.prepare(
      'SELECT * FROM script_versions WHERE script_id = ? AND version = ?'
    ).get(script.id, targetVersion);

    if (!versionRecord) {
      throw new Error(`Version "${targetVersion}" does not exist for script "${script.name}".`);
    }

    if (!fs.existsSync(versionRecord.filename)) {
      throw new Error(`Version file on disk is missing.`);
    }

    db.prepare(`
      UPDATE scripts
      SET version = ?, current_filename = ?, original_filename = ?, file_size = ?, file_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      versionRecord.version,
      versionRecord.filename,
      versionRecord.original_filename,
      versionRecord.file_size,
      versionRecord.file_hash,
      script.id
    );

    return this.getScriptById(script.id);
  }

  /**
   * Fetches version history of a script
   */
  static getVersions(scriptId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM script_versions WHERE script_id = ? ORDER BY id DESC').all(scriptId);
  }

  /**
   * Increments download counter
   */
  static recordDownload(scriptId) {
    const db = getDatabase();
    db.prepare('UPDATE scripts SET download_count = download_count + 1 WHERE id = ?').run(scriptId);
  }
}
